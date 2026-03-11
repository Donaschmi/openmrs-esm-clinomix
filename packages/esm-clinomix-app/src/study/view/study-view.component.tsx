import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Checkbox,
  IconButton,
  InlineLoading,
  Modal,
  Stack,
  StructuredListBody,
  StructuredListCell,
  StructuredListHead,
  StructuredListRow,
  StructuredListWrapper,
  Tag,
  Tile,
} from '@carbon/react';
import { ArrowLeft, Download, Edit, TrashCan, View } from '@carbon/react/icons';
import { isDesktop, showSnackbar, useLayoutType } from '@openmrs/esm-framework';
import {
  buildQuestionnaireRefs,
  useAddStudyResponse,
  useExportStudy,
  useRemoveStudyResponse,
  useStudy,
} from '../study.resource';
import { useQuestionnaires } from '../../questionnaire/questionnaire.resource';
import { useResponses } from '../../questionnaire/response/questionnaire-response.resource';
import styles from './study-view.scss';

interface StudyViewProps {
  studyUuid: string;
  onBack: () => void;
  onEdit: () => void;
  onViewQuestionnaire: (id: string) => void;
  onViewResponse: (id: string) => void;
}

const StudyView: React.FC<StudyViewProps> = ({ studyUuid, onBack, onEdit, onViewQuestionnaire, onViewResponse }) => {
  const { t } = useTranslation();
  const layout = useLayoutType();
  const responsiveSize = isDesktop(layout) ? 'sm' : 'lg';

  const { study, isLoading, mutate } = useStudy(studyUuid);
  const addStudyResponse = useAddStudyResponse();
  const removeStudyResponse = useRemoveStudyResponse();
  const exportStudy = useExportStudy();
  const [addResponseOpen, setAddResponseOpen] = useState(false);
  const [selectedResponseIds, setSelectedResponseIds] = useState<string[]>([]);
  const [removeTarget, setRemoveTarget] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const { questionnaires } = useQuestionnaires();
  const { responses } = useResponses();

  // Responses not yet in the study AND belonging to one of the study's questionnaires
  const linkedResponseIds = new Set(study?.responses.map((r) => r.questionnaireResponseFhirId) ?? []);
  const studyQuestionnaireRefs = study ? buildQuestionnaireRefs(study.questionnaireIds) : new Set<string>();
  const availableResponses = responses.filter(
    (r) =>
      r.id && !linkedResponseIds.has(r.id) && r.questionnaire != null && studyQuestionnaireRefs.has(r.questionnaire),
  );

  if (isLoading) {
    return <InlineLoading description={t('loadingStudy', 'Loading study…')} />;
  }

  if (!study) {
    return (
      <Tile className={styles.errorTile}>
        <p>{t('studyNotFound', 'Study not found.')}</p>
        <Button kind="ghost" renderIcon={ArrowLeft} onClick={onBack}>
          {t('back', 'Back')}
        </Button>
      </Tile>
    );
  }

  const handleAddResponses = () => {
    const count = selectedResponseIds.length;
    Promise.all(selectedResponseIds.map((id) => addStudyResponse(study.uuid, id)))
      .then(() => {
        mutate();
        setSelectedResponseIds([]);
        setAddResponseOpen(false);
        showSnackbar({
          kind: 'success',
          title: t('responsesAdded', 'Responses added'),
          subtitle: t('responsesAddedCount', `${count} response(s) added to the study`),
        });
      })
      .catch((err: unknown) => {
        showSnackbar({
          kind: 'error',
          title: t('addFailed', 'Add failed'),
          subtitle: err instanceof Error ? err.message : String(err),
        });
      });
  };

  const handleRemoveResponse = () => {
    if (removeTarget === null) return;
    removeStudyResponse(study.uuid, removeTarget)
      .then(() => {
        mutate();
        setRemoveTarget(null);
        showSnackbar({ kind: 'success', title: t('responseRemoved', 'Response removed') });
      })
      .catch((err: unknown) => {
        showSnackbar({
          kind: 'error',
          title: t('removeFailed', 'Remove failed'),
          subtitle: err instanceof Error ? err.message : String(err),
        });
      });
  };

  const handleExport = () => {
    setIsExporting(true);
    exportStudy(study)
      .then((json) => {
        const blob = new Blob([json], { type: 'application/fhir+json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `study-${study.uuid}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showSnackbar({ kind: 'success', title: t('exported', 'Exported'), subtitle: study.name });
      })
      .catch((err: unknown) => {
        showSnackbar({
          kind: 'error',
          title: t('exportFailed', 'Export failed'),
          subtitle: err instanceof Error ? err.message : String(err),
        });
      })
      .finally(() => setIsExporting(false));
  };

  const toggleResponseSelection = (id: string, checked: boolean) => {
    setSelectedResponseIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  };

  const questionnaireTitle = (id: string) => {
    const q = questionnaires.find((x) => x.id === id);
    return q?.title ?? q?.name ?? id;
  };

  const responseLabel = (fhirId: string) => {
    const r = responses.find((x) => x.id === fhirId);
    const qTitle = r?.questionnaire ? questionnaireTitle(r.questionnaire) : '';
    const subject = r?.subject?.display ?? r?.subject?.reference ?? '';
    return [qTitle, subject, fhirId].filter(Boolean).join(' · ');
  };

  return (
    <>
      {/* ── Add responses modal ──────────────────────────────────────────── */}
      <Modal
        open={addResponseOpen}
        modalHeading={t('addResponses', 'Add responses')}
        primaryButtonText={t('add', 'Add')}
        secondaryButtonText={t('cancel', 'Cancel')}
        primaryButtonDisabled={selectedResponseIds.length === 0}
        onRequestSubmit={handleAddResponses}
        onRequestClose={() => {
          setAddResponseOpen(false);
          setSelectedResponseIds([]);
        }}
        onSecondarySubmit={() => {
          setAddResponseOpen(false);
          setSelectedResponseIds([]);
        }}
      >
        {availableResponses.length === 0 ? (
          <p>
            {study?.questionnaireIds.length === 0
              ? t(
                  'noQuestionnairesInStudyForResponse',
                  'Add questionnaires to this study first, then you can link their responses.',
                )
              : t('noAvailableResponses', "No unlinked responses found for this study's questionnaires.")}
          </p>
        ) : (
          <Stack gap={3}>
            <p className={styles.modalHint}>{t('selectResponsesToAdd', 'Select responses to add to this study:')}</p>
            {availableResponses.map((r) => (
              <Checkbox
                key={r.id}
                id={`add-r-${r.id}`}
                labelText={responseLabel(r.id!)}
                checked={selectedResponseIds.includes(r.id!)}
                onChange={(_, { checked }) => toggleResponseSelection(r.id!, checked)}
              />
            ))}
          </Stack>
        )}
      </Modal>

      {/* ── Remove response confirmation ─────────────────────────────────── */}
      <Modal
        open={removeTarget !== null}
        danger
        modalHeading={t('removeResponse', 'Remove response')}
        primaryButtonText={t('remove', 'Remove')}
        secondaryButtonText={t('cancel', 'Cancel')}
        onRequestSubmit={handleRemoveResponse}
        onRequestClose={() => setRemoveTarget(null)}
        onSecondarySubmit={() => setRemoveTarget(null)}
      >
        <p>{t('removeResponseConfirm', 'Remove this response from the study? The response itself is not deleted.')}</p>
      </Modal>

      <div className={styles.container}>
        {/* ── Top bar ─────────────────────────────────────────────────────── */}
        <div className={styles.topBar}>
          <Button kind="ghost" renderIcon={ArrowLeft} size={responsiveSize} onClick={onBack}>
            {t('back', 'Back')}
          </Button>
          <div className={styles.topBarCenter}>
            <h2 className={styles.pageTitle}>{study.name}</h2>
            <Tag type={study.status === 'ACTIVE' ? 'green' : 'gray'}>{study.status}</Tag>
          </div>
          <div className={styles.topBarActions}>
            <Button kind="tertiary" renderIcon={Edit} size={responsiveSize} onClick={onEdit}>
              {t('edit', 'Edit')}
            </Button>
            <Button
              kind="primary"
              renderIcon={isExporting ? InlineLoading : Download}
              size={responsiveSize}
              onClick={handleExport}
              disabled={isExporting}
            >
              {t('exportStudy', 'Export')}
            </Button>
          </div>
        </div>

        <div className={styles.body}>
          <Stack gap={6}>
            {/* ── Description ──────────────────────────────────────────────── */}
            {study.description && (
              <section>
                <p className={styles.description}>{study.description}</p>
              </section>
            )}

            {/* ── Metadata ─────────────────────────────────────────────────── */}
            <section>
              <h3 className={styles.sectionTitle}>{t('details', 'Details')}</h3>
              <Tile className={styles.metaTile}>
                <StructuredListWrapper>
                  <StructuredListBody>
                    <StructuredListRow>
                      <StructuredListCell noWrap className={styles.metaLabel}>
                        {t('created', 'Created')}
                      </StructuredListCell>
                      <StructuredListCell>{new Date(study.dateCreated).toLocaleString()}</StructuredListCell>
                    </StructuredListRow>
                    {study.dateChanged && (
                      <StructuredListRow>
                        <StructuredListCell noWrap className={styles.metaLabel}>
                          {t('lastModified', 'Last modified')}
                        </StructuredListCell>
                        <StructuredListCell>{new Date(study.dateChanged).toLocaleString()}</StructuredListCell>
                      </StructuredListRow>
                    )}
                    <StructuredListRow>
                      <StructuredListCell noWrap className={styles.metaLabel}>
                        {t('uuid', 'UUID')}
                      </StructuredListCell>
                      <StructuredListCell>
                        <code>{study.uuid}</code>
                      </StructuredListCell>
                    </StructuredListRow>
                  </StructuredListBody>
                </StructuredListWrapper>
              </Tile>
            </section>

            {/* ── Questionnaires ───────────────────────────────────────────── */}
            <section>
              <h3 className={styles.sectionTitle}>
                {t('questionnaires', 'Questionnaires')}
                <span className={styles.countBadge}>({study.questionnaireIds.length})</span>
              </h3>
              {study.questionnaireIds.length === 0 ? (
                <Tile className={styles.emptyTile}>
                  <p>{t('noQuestionnairesInStudy', 'No questionnaires assigned. Edit the study to add some.')}</p>
                </Tile>
              ) : (
                <Tile className={styles.metaTile}>
                  <StructuredListWrapper>
                    <StructuredListHead>
                      <StructuredListRow head>
                        <StructuredListCell head>{t('title', 'Title')}</StructuredListCell>
                        <StructuredListCell head>{t('status', 'Status')}</StructuredListCell>
                        <StructuredListCell head>{t('actions', 'Actions')}</StructuredListCell>
                      </StructuredListRow>
                    </StructuredListHead>
                    <StructuredListBody>
                      {study.questionnaireIds.map((qId) => {
                        const q = questionnaires.find((x) => x.id === qId);
                        return (
                          <StructuredListRow key={qId}>
                            <StructuredListCell>{q?.title ?? q?.name ?? qId}</StructuredListCell>
                            <StructuredListCell>
                              {q ? (
                                <Tag
                                  type={q.status === 'active' ? 'green' : q.status === 'draft' ? 'blue' : 'gray'}
                                  size="sm"
                                >
                                  {q.status}
                                </Tag>
                              ) : (
                                <Tag type="gray" size="sm">
                                  {t('notFound', 'Not found')}
                                </Tag>
                              )}
                            </StructuredListCell>
                            <StructuredListCell>
                              {q && (
                                <Button
                                  kind="ghost"
                                  size="sm"
                                  renderIcon={View}
                                  onClick={() => onViewQuestionnaire(qId)}
                                >
                                  {t('view', 'View')}
                                </Button>
                              )}
                            </StructuredListCell>
                          </StructuredListRow>
                        );
                      })}
                    </StructuredListBody>
                  </StructuredListWrapper>
                </Tile>
              )}
            </section>

            {/* ── Responses ────────────────────────────────────────────────── */}
            <section>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>
                  {t('responses', 'Responses')}
                  <span className={styles.countBadge}>({study.responses.length})</span>
                </h3>
                <Button kind="tertiary" size={responsiveSize} onClick={() => setAddResponseOpen(true)}>
                  {t('addResponse', 'Add response')}
                </Button>
              </div>
              {study.responses.length === 0 ? (
                <Tile className={styles.emptyTile}>
                  <p>{t('noResponsesInStudy', 'No responses linked yet. Responses can be added at any time.')}</p>
                </Tile>
              ) : (
                <Tile className={styles.metaTile}>
                  <StructuredListWrapper>
                    <StructuredListHead>
                      <StructuredListRow head>
                        <StructuredListCell head>{t('response', 'Response')}</StructuredListCell>
                        <StructuredListCell head>{t('dateAdded', 'Date added')}</StructuredListCell>
                        <StructuredListCell head>{t('actions', 'Actions')}</StructuredListCell>
                      </StructuredListRow>
                    </StructuredListHead>
                    <StructuredListBody>
                      {study.responses.map((ref) => (
                        <StructuredListRow key={ref.id}>
                          <StructuredListCell>
                            <code className={styles.responseId}>{ref.questionnaireResponseFhirId}</code>
                          </StructuredListCell>
                          <StructuredListCell noWrap>{new Date(ref.dateAdded).toLocaleString()}</StructuredListCell>
                          <StructuredListCell>
                            <div className={styles.responseActions}>
                              <Button
                                kind="ghost"
                                size="sm"
                                renderIcon={View}
                                onClick={() => onViewResponse(ref.questionnaireResponseFhirId)}
                              >
                                {t('view', 'View')}
                              </Button>
                              <IconButton
                                label={t('remove', 'Remove')}
                                kind="ghost"
                                size="sm"
                                onClick={() => setRemoveTarget(ref.id)}
                              >
                                <TrashCan />
                              </IconButton>
                            </div>
                          </StructuredListCell>
                        </StructuredListRow>
                      ))}
                    </StructuredListBody>
                  </StructuredListWrapper>
                </Tile>
              )}
            </section>
          </Stack>
        </div>
      </div>
    </>
  );
};

export default StudyView;
