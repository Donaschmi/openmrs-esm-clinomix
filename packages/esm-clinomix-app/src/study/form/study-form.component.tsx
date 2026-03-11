import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Checkbox,
  Form,
  FormGroup,
  InlineNotification,
  RadioButton,
  RadioButtonGroup,
  Stack,
  TextArea,
  TextInput,
  Tile,
} from '@carbon/react';
import { ArrowLeft, Save } from '@carbon/react/icons';
import { isDesktop, showSnackbar, useLayoutType } from '@openmrs/esm-framework';
import {
  type Study,
  countResponsesForQuestionnaires,
  useCreateStudy,
  useUpdateStudy,
  useStudy,
} from '../study.resource';
import { useQuestionnaires } from '../../questionnaire/questionnaire.resource';
import styles from './study-form.scss';

interface StudyFormProps {
  /** UUID of existing study to edit — undefined means create. */
  studyUuid?: string;
  onBack: () => void;
  onSaved: (uuid: string) => void;
}

const StudyForm: React.FC<StudyFormProps> = ({ studyUuid, onBack, onSaved }) => {
  const { t } = useTranslation();
  const layout = useLayoutType();
  const responsiveSize = isDesktop(layout) ? 'sm' : 'lg';
  const isEdit = Boolean(studyUuid);

  const { study: existing } = useStudy(isEdit ? studyUuid : undefined);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'CLOSED'>('ACTIVE');
  const [selectedQuestionnaireIds, setSelectedQuestionnaireIds] = useState<string[]>([]);
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setDescription(existing.description ?? '');
      setStatus(existing.status);
      setSelectedQuestionnaireIds(existing.questionnaireIds);
    }
  }, [existing]);
  const [isSaving, setIsSaving] = useState(false);

  const createStudy = useCreateStudy();
  const updateStudy = useUpdateStudy();

  const { questionnaires } = useQuestionnaires();

  // Questionnaire IDs that were in the original study but are now deselected
  const removedQIds = useMemo(
    () => (existing?.questionnaireIds ?? []).filter((qId) => !selectedQuestionnaireIds.includes(qId)),
    [existing, selectedQuestionnaireIds],
  );

  // Number of responses that will be auto-removed because their questionnaire was deselected
  const responsesAtRisk = useMemo(
    () => (existing ? countResponsesForQuestionnaires(existing, removedQIds) : 0),
    [existing, removedQIds],
  );

  const toggleQuestionnaire = (id: string, checked: boolean) => {
    setSelectedQuestionnaireIds((prev) => (checked ? [...prev, id] : prev.filter((q) => q !== id)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError(t('nameRequired', 'Name is required'));
      return;
    }
    setNameError('');
    setIsSaving(true);

    const payload = {
      name: trimmedName,
      description: description.trim() || undefined,
      status,
      questionnaireIds: selectedQuestionnaireIds,
    };

    const request: Promise<Study> = isEdit && studyUuid ? updateStudy(studyUuid, payload) : createStudy(payload);

    request
      .then((saved) => {
        showSnackbar({
          kind: 'success',
          title: isEdit ? t('studyUpdated', 'Study updated') : t('studyCreated', 'Study created'),
          subtitle: saved.name,
        });
        onSaved(saved.uuid);
      })
      .catch((err: unknown) => {
        showSnackbar({
          kind: 'error',
          title: t('saveFailed', 'Save failed'),
          subtitle: err instanceof Error ? err.message : String(err),
        });
      })
      .finally(() => setIsSaving(false));
  };

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <Button kind="ghost" renderIcon={ArrowLeft} size={responsiveSize} onClick={onBack}>
          {t('back', 'Back')}
        </Button>
        <h2 className={styles.pageTitle}>{isEdit ? t('editStudy', 'Edit study') : t('newStudy', 'New study')}</h2>
      </div>

      <div className={styles.body}>
        <Form onSubmit={handleSubmit}>
          <Stack gap={6}>
            <TextInput
              id="study-name"
              labelText={t('studyName', 'Study name')}
              placeholder={t('studyNamePlaceholder', 'e.g. Diabetes Screening 2025')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              invalid={Boolean(nameError)}
              invalidText={nameError}
              required
            />

            <TextArea
              id="study-description"
              labelText={t('description', 'Description')}
              placeholder={t('studyDescriptionPlaceholder', 'Optional description or objectives')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />

            <RadioButtonGroup
              legendText={t('status', 'Status')}
              name="study-status"
              valueSelected={status}
              onChange={(value) => setStatus(value as 'ACTIVE' | 'CLOSED')}
            >
              <RadioButton labelText={t('active', 'Active')} value="ACTIVE" id="status-active" />
              <RadioButton labelText={t('closed', 'Closed')} value="CLOSED" id="status-closed" />
            </RadioButtonGroup>

            <FormGroup legendText={t('questionnaires', 'Questionnaires')}>
              {questionnaires.length === 0 ? (
                <Tile className={styles.emptyTile}>
                  <p>{t('noQuestionnairesAvailable', 'No questionnaires available. Create some first.')}</p>
                </Tile>
              ) : (
                <div className={styles.checkboxGrid}>
                  {questionnaires.map((q) => (
                    <Checkbox
                      key={q.id}
                      id={`q-${q.id}`}
                      labelText={q.title ?? q.name ?? q.id}
                      checked={selectedQuestionnaireIds.includes(q.id)}
                      onChange={(_, { checked }) => toggleQuestionnaire(q.id, checked)}
                    />
                  ))}
                </div>
              )}
            </FormGroup>

            {responsesAtRisk > 0 && (
              <InlineNotification
                kind="warning"
                title={t('responsesWillBeRemoved', 'Responses will be removed —')}
                subtitle={t(
                  'responsesWillBeRemovedDetail',
                  `Saving will unlink ${responsesAtRisk} response(s) from this study because their questionnaire was deselected.`,
                )}
                hideCloseButton
                lowContrast
              />
            )}

            {selectedQuestionnaireIds.length === 0 && (
              <InlineNotification
                kind="warning"
                title={t('noQuestionnairesSelected', 'No questionnaires selected')}
                subtitle={t('addQuestionnairesHint', 'You can add questionnaires to this study later.')}
                hideCloseButton
                lowContrast
              />
            )}

            <div className={styles.formActions}>
              <Button kind="secondary" size={responsiveSize} onClick={onBack}>
                {t('cancel', 'Cancel')}
              </Button>
              <Button kind="primary" type="submit" renderIcon={Save} size={responsiveSize} disabled={isSaving}>
                {isSaving
                  ? t('saving', 'Saving…')
                  : isEdit
                    ? t('saveChanges', 'Save changes')
                    : t('createStudy', 'Create study')}
              </Button>
            </div>
          </Stack>
        </Form>
      </div>
    </div>
  );
};

export default StudyForm;
