import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Form,
  FormGroup,
  Modal,
  RadioButton,
  RadioButtonGroup,
  Select,
  SelectItem,
  Stack,
  TextArea,
  TextInput,
  Toggle,
} from '@carbon/react';
import { ArrowLeft, Add, GroupObjects } from '@carbon/react/icons';
import { showSnackbar } from '@openmrs/esm-framework';
import {
  type FhirQuestionnaire,
  type FhirQuestionnaireItem,
  devGetQuestionnaires,
  devSaveQuestionnaires,
  devArchiveVersion,
  bumpVersion,
} from '../questionnaire.resource';
import QuestionnaireItemCard from './questionnaire-item-card.component';
import styles from './questionnaire-form.scss';

const DEV_MODE = process.env.NODE_ENV === 'development';

type VersionChoice = 'overwrite' | 'patch' | 'minor' | 'major';

interface QuestionnaireFormProps {
  questionnaire?: FhirQuestionnaire;
  template?: FhirQuestionnaire;
  onBack: () => void;
}

function emptyQuestionnaire(): Omit<FhirQuestionnaire, 'id'> {
  return {
    resourceType: 'Questionnaire',
    title: '',
    name: '',
    url: '',
    version: '1.0.0',
    status: 'draft',
    publisher: '',
    description: '',
    subjectType: ['Patient'],
    experimental: false,
    item: [],
  };
}

function templateToNew(tpl: FhirQuestionnaire): Omit<FhirQuestionnaire, 'id'> {
  const { id: _id, ...rest } = tpl;
  return {
    ...rest,
    title: `${tpl.title ?? ''} (Copy)`.trim(),
    status: 'draft',
    version: '1.0.0',
    date: undefined,
  };
}

const QuestionnaireForm: React.FC<QuestionnaireFormProps> = ({ questionnaire, template, onBack }) => {
  const { t } = useTranslation();
  const isEditing = Boolean(questionnaire);

  const initialForm = questionnaire ?? (template ? templateToNew(template) : emptyQuestionnaire());
  const [form, setForm] = useState<Omit<FhirQuestionnaire, 'id'>>(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pendingVersionSave, setPendingVersionSave] = useState(false);
  const [versionChoice, setVersionChoice] = useState<VersionChoice>('patch');

  const set = (field: keyof Omit<FhirQuestionnaire, 'id'>, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!form.title?.trim()) next.title = t('titleRequired', 'Title is required');
    if (!form.status) next.status = t('statusRequired', 'Status is required');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const doSave = (choice: VersionChoice) => {
    setPendingVersionSave(false);

    if (DEV_MODE) {
      const all = devGetQuestionnaires();
      let finalForm = { ...form, date: new Date().toISOString() };

      if (isEditing && questionnaire) {
        if (choice !== 'overwrite') {
          devArchiveVersion(questionnaire);
          finalForm = { ...finalForm, version: bumpVersion(questionnaire.version, choice) };
        }
        devSaveQuestionnaires(all.map((q) => (q.id === questionnaire.id ? { ...finalForm, id: questionnaire.id } : q)));
      } else {
        devSaveQuestionnaires([...all, { ...finalForm, id: `q-${Date.now()}` }]);
      }

      showSnackbar({
        kind: 'success',
        title: t('saved', 'Saved'),
        subtitle: t('questionnaireSaved', 'Questionnaire saved successfully'),
      });
      onBack();
      return;
    }

    // TODO: call real API — POST /ws/fhir2/R4/Questionnaire (create) or PUT (update)
  };

  const handleSave = () => {
    if (!validate()) return;
    if (isEditing) {
      setPendingVersionSave(true);
      return;
    }
    doSave('overwrite');
  };

  const addItem = () => {
    const newItem: FhirQuestionnaireItem = {
      linkId: `item-${(form.item?.length ?? 0) + 1}`,
      type: 'string',
      text: '',
    };
    set('item', [...(form.item ?? []), newItem]);
  };

  const addGroup = () => {
    const newGroup: FhirQuestionnaireItem = {
      linkId: `group-${(form.item?.length ?? 0) + 1}`,
      type: 'group',
      text: '',
      item: [],
    };
    set('item', [...(form.item ?? []), newGroup]);
  };

  const updateItem = (index: number, updated: FhirQuestionnaireItem) => {
    const items = [...(form.item ?? [])];
    items[index] = updated;
    set('item', items);
  };

  const removeItem = (index: number) => {
    const items = [...(form.item ?? [])];
    items.splice(index, 1);
    set('item', items);
  };

  return (
    <>
      {/* ── Version save modal ───────────────────────────────── */}
      <Modal
        open={pendingVersionSave}
        modalHeading={t('saveVersion', 'Save version')}
        primaryButtonText={t('save', 'Save')}
        secondaryButtonText={t('cancel', 'Cancel')}
        onRequestSubmit={() => doSave(versionChoice)}
        onRequestClose={() => setPendingVersionSave(false)}
        onSecondarySubmit={() => setPendingVersionSave(false)}
      >
        <p style={{ marginBottom: '1rem' }}>
          {t('currentVersionIs', 'Current version:')} <strong>{questionnaire?.version ?? '—'}</strong>
        </p>
        <RadioButtonGroup
          name="version-choice"
          legendText={t('versionSaveChoice', 'How do you want to save your changes?')}
          valueSelected={versionChoice}
          onChange={(val) => setVersionChoice(val as VersionChoice)}
          orientation="vertical"
        >
          <RadioButton
            id="vc-overwrite"
            value="overwrite"
            labelText={t('overwriteChoice', 'Overwrite — replace the current version without creating a snapshot')}
          />
          <RadioButton
            id="vc-patch"
            value="patch"
            labelText={`${t('patch', 'Patch')} → ${bumpVersion(questionnaire?.version, 'patch')} — ${t('patchDesc', 'bug fixes, no new features')}`}
          />
          <RadioButton
            id="vc-minor"
            value="minor"
            labelText={`${t('minor', 'Minor')} → ${bumpVersion(questionnaire?.version, 'minor')} — ${t('minorDesc', 'new features, backward compatible')}`}
          />
          <RadioButton
            id="vc-major"
            value="major"
            labelText={`${t('major', 'Major')} → ${bumpVersion(questionnaire?.version, 'major')} — ${t('majorDesc', 'breaking changes')}`}
          />
        </RadioButtonGroup>
      </Modal>

      <div className={styles.container}>
        <div className={styles.topBar}>
          <Button kind="ghost" renderIcon={ArrowLeft} onClick={onBack}>
            {t('back', 'Back')}
          </Button>
          <h2 className={styles.pageTitle}>
            {isEditing ? t('editQuestionnaire', 'Edit questionnaire') : t('newQuestionnaire', 'New questionnaire')}
          </h2>
        </div>

        <Form className={styles.form}>
          <Stack gap={7}>
            {/* ── Metadata ─────────────────────────────────────── */}
            <FormGroup legendText={t('metadata', 'Metadata')} className={styles.formGroup}>
              <Stack gap={5}>
                <TextInput
                  id="q-title"
                  labelText={t('title', 'Title')}
                  value={form.title ?? ''}
                  onChange={(e) => set('title', e.target.value)}
                  invalid={Boolean(errors.title)}
                  invalidText={errors.title}
                  required
                />
                <TextInput
                  id="q-name"
                  labelText={t('name', 'Name')}
                  helperText={t('nameHelper', 'Computer-friendly identifier — no spaces (e.g. PatientIntake)')}
                  value={form.name ?? ''}
                  onChange={(e) => set('name', e.target.value)}
                />
                <TextInput
                  id="q-url"
                  labelText={t('canonicalUrl', 'Canonical URL')}
                  helperText={t('urlHelper', 'Globally unique identifier for this questionnaire')}
                  value={form.url ?? ''}
                  onChange={(e) => set('url', e.target.value)}
                />
                <div className={styles.row}>
                  <TextInput
                    id="q-version"
                    labelText={t('version', 'Version')}
                    value={form.version ?? ''}
                    onChange={(e) => set('version', e.target.value)}
                  />
                  <Select
                    id="q-status"
                    labelText={t('status', 'Status')}
                    value={form.status}
                    onChange={(e) => set('status', e.target.value)}
                    invalid={Boolean(errors.status)}
                    invalidText={errors.status}
                  >
                    <SelectItem value="draft" text={t('draft', 'Draft')} />
                    <SelectItem value="active" text={t('active', 'Active')} />
                    <SelectItem value="retired" text={t('retired', 'Retired')} />
                    <SelectItem value="unknown" text={t('unknown', 'Unknown')} />
                  </Select>
                </div>
                <TextInput
                  id="q-publisher"
                  labelText={t('publisher', 'Publisher')}
                  value={form.publisher ?? ''}
                  onChange={(e) => set('publisher', e.target.value)}
                />
                <TextArea
                  id="q-description"
                  labelText={t('description', 'Description')}
                  value={form.description ?? ''}
                  onChange={(e) => set('description', e.target.value)}
                  rows={3}
                />
                <Toggle
                  id="q-experimental"
                  labelText={t('experimental', 'Experimental')}
                  labelA={t('no', 'No')}
                  labelB={t('yes', 'Yes')}
                  toggled={form.experimental ?? false}
                  onToggle={(checked) => set('experimental', checked)}
                />
              </Stack>
            </FormGroup>

            {/* ── Items ────────────────────────────────────────── */}
            <FormGroup legendText={t('items', 'Items')} className={styles.formGroup}>
              <Stack gap={4}>
                {form.item?.map((item, index) => (
                  <QuestionnaireItemCard
                    key={`${item.linkId}-${index}`}
                    item={item}
                    index={index}
                    onChange={(updated) => updateItem(index, updated)}
                    onRemove={() => removeItem(index)}
                  />
                ))}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button kind="tertiary" renderIcon={Add} onClick={addItem}>
                    {t('addItem', 'Add item')}
                  </Button>
                  <Button kind="tertiary" renderIcon={GroupObjects} onClick={addGroup}>
                    {t('addGroup', 'Add group')}
                  </Button>
                </div>
              </Stack>
            </FormGroup>
          </Stack>

          <div className={styles.actions}>
            <Button kind="secondary" onClick={onBack}>
              {t('cancel', 'Cancel')}
            </Button>
            <Button kind="primary" onClick={handleSave}>
              {t('save', 'Save')}
            </Button>
          </div>
        </Form>
      </div>
    </>
  );
};

export default QuestionnaireForm;
