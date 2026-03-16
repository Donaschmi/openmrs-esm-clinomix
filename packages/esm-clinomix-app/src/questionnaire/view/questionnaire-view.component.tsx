import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  InlineNotification,
  Modal,
  Tag,
  Tile,
  StructuredListBody,
  StructuredListCell,
  StructuredListHead,
  StructuredListRow,
  StructuredListWrapper,
  Stack,
} from '@carbon/react';
import { ArrowLeft, Edit, Renew, TrashCan, View } from '@carbon/react/icons';
import { showSnackbar } from '@openmrs/esm-framework';
import {
  type FhirQuestionnaire,
  type FhirQuestionnaireItem,
  useVersionHistory,
  useRestoreQuestionnaire,
  useDeleteSnapshot,
} from '../questionnaire.resource';
import styles from './questionnaire-view.scss';

interface QuestionnaireViewProps {
  questionnaire: FhirQuestionnaire;
  onBack: () => void;
  onEdit: () => void;
  readOnly?: boolean;
  onViewSnapshot?: (snapshot: FhirQuestionnaire) => void;
  onRestored?: () => void;
}

const STATUS_TAG_TYPE: Record<string, 'green' | 'blue' | 'gray'> = {
  active: 'green',
  draft: 'blue',
  retired: 'gray',
  unknown: 'gray',
};

const QuestionnaireItemView: React.FC<{ item: FhirQuestionnaireItem; depth?: number }> = ({ item, depth = 0 }) => {
  const { t } = useTranslation();
  const isChoice = item.type === 'choice' || item.type === 'open-choice';

  return (
    <div className={styles.itemCard} style={{ marginLeft: depth * 16 }}>
      <div className={styles.itemHeader}>
        <div className={styles.itemMeta}>
          <span className={styles.itemLinkId}>{item.linkId}</span>
          <Tag type="blue" size="sm">
            {item.type}
          </Tag>
          {item.required && (
            <Tag type="red" size="sm">
              {t('required', 'Required')}
            </Tag>
          )}
          {item.repeats && (
            <Tag type="purple" size="sm">
              {t('repeats', 'Repeats')}
            </Tag>
          )}
          {item.readOnly && (
            <Tag type="gray" size="sm">
              {t('readOnly', 'Read only')}
            </Tag>
          )}
        </div>
      </div>
      {item.prefix && <p className={styles.itemPrefix}>{item.prefix}</p>}
      <p className={styles.itemText}>{item.text || <em>{t('noText', 'No text')}</em>}</p>
      {isChoice && item.answerOption && item.answerOption.length > 0 && (
        <ul className={styles.answerOptions}>
          {item.answerOption.map((opt, i) => (
            <li key={i} className={styles.answerOption}>
              {opt.valueString ?? opt.valueCoding?.display ?? opt.valueCoding?.code ?? '--'}
            </li>
          ))}
        </ul>
      )}
      {item.item?.map((child, i) => (
        <QuestionnaireItemView key={i} item={child} depth={depth + 1} />
      ))}
    </div>
  );
};

const QuestionnaireView: React.FC<QuestionnaireViewProps> = ({
  questionnaire: q,
  onBack,
  onEdit,
  readOnly = false,
  onViewSnapshot,
  onRestored,
}) => {
  const { t } = useTranslation();
  const { history, refresh: refreshHistory } = useVersionHistory(q.id, readOnly);
  const restoreQuestionnaire = useRestoreQuestionnaire();
  const deleteSnapshot = useDeleteSnapshot();

  const [restoreTarget, setRestoreTarget] = useState<{ snapshot: FhirQuestionnaire; index: number } | null>(null);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  const handleRestoreConfirm = async () => {
    if (!restoreTarget) return;
    const { snapshot, index } = restoreTarget;
    try {
      await restoreQuestionnaire(q, snapshot, index);
      setRestoreTarget(null);
      showSnackbar({
        kind: 'success',
        title: t('restored', 'Restored'),
        subtitle: t('snapshotRestored', 'Version restored successfully'),
      });
      onRestored?.();
    } catch (err) {
      showSnackbar({
        kind: 'error',
        title: t('error', 'Error'),
        subtitle: err instanceof Error ? err.message : t('restoreFailed', 'Failed to restore version'),
      });
    }
  };

  const handleDeleteConfirm = async () => {
    if (deleteIndex === null) return;
    try {
      await deleteSnapshot(q.id, deleteIndex);
      refreshHistory();
      setDeleteIndex(null);
      showSnackbar({
        kind: 'success',
        title: t('deleted', 'Deleted'),
        subtitle: t('snapshotDeleted', 'Snapshot deleted'),
      });
    } catch (err) {
      showSnackbar({
        kind: 'error',
        title: t('error', 'Error'),
        subtitle: err instanceof Error ? err.message : t('deleteFailed', 'Failed to delete snapshot'),
      });
    }
  };

  const metaRows: Array<{ label: string; value: React.ReactNode }> = [
    { label: t('status', 'Status'), value: <Tag type={STATUS_TAG_TYPE[q.status] ?? 'gray'}>{q.status}</Tag> },
    { label: t('version', 'Version'), value: q.version ?? '--' },
    { label: t('canonicalUrl', 'Canonical URL'), value: q.url ?? '--' },
    { label: t('name', 'Name'), value: q.name ?? '--' },
    { label: t('publisher', 'Publisher'), value: q.publisher ?? '--' },
    { label: t('subjectType', 'Subject type'), value: q.subjectType?.join(', ') ?? '--' },
    { label: t('lastUpdated', 'Last updated'), value: q.date ? new Date(q.date).toLocaleDateString() : '--' },
    { label: t('experimental', 'Experimental'), value: q.experimental ? t('yes', 'Yes') : t('no', 'No') },
    { label: t('description', 'Description'), value: q.description ?? '--' },
  ];

  return (
    <>
      {/* ── Restore confirm modal ────────────────────────────── */}
      <Modal
        open={Boolean(restoreTarget)}
        modalHeading={t('restoreVersion', 'Restore version')}
        primaryButtonText={t('restore', 'Restore')}
        secondaryButtonText={t('cancel', 'Cancel')}
        onRequestSubmit={handleRestoreConfirm}
        onRequestClose={() => setRestoreTarget(null)}
        onSecondarySubmit={() => setRestoreTarget(null)}
      >
        <p>
          {t('restoreConfirm', 'Are you sure you want to restore version')}{' '}
          <strong>{restoreTarget?.snapshot.version ?? '--'}</strong>?{' '}
          {t('restoreWarning', 'The current version will be archived.')}
        </p>
      </Modal>

      {/* ── Delete snapshot confirm modal ────────────────────── */}
      <Modal
        open={deleteIndex !== null}
        danger
        modalHeading={t('deleteSnapshot', 'Delete snapshot')}
        primaryButtonText={t('delete', 'Delete')}
        secondaryButtonText={t('cancel', 'Cancel')}
        onRequestSubmit={handleDeleteConfirm}
        onRequestClose={() => setDeleteIndex(null)}
        onSecondarySubmit={() => setDeleteIndex(null)}
      >
        <p>
          {t(
            'deleteSnapshotConfirm',
            'Are you sure you want to permanently delete this snapshot? This action cannot be undone.',
          )}
        </p>
      </Modal>

      <div className={styles.container}>
        {/* ── Top bar ──────────────────────────────────────────── */}
        <div className={styles.topBar}>
          <Button kind="ghost" renderIcon={ArrowLeft} onClick={onBack}>
            {t('back', 'Back')}
          </Button>
          <div className={styles.topBarTitle}>
            <h2 className={styles.pageTitle}>{q.title ?? t('untitled', 'Untitled')}</h2>
            <Tag type={STATUS_TAG_TYPE[q.status] ?? 'gray'}>{q.status}</Tag>
          </div>
          {!readOnly && (
            <Button kind="tertiary" renderIcon={Edit} onClick={onEdit}>
              {t('edit', 'Edit')}
            </Button>
          )}
        </div>

        {readOnly && (
          <div className={styles.snapshotBanner}>
            <InlineNotification
              kind="info"
              title={t('historicalSnapshot', 'Historical snapshot —')}
              subtitle={t('snapshotDesc', `Version ${q.version ?? ''} · read-only`)}
              hideCloseButton
            />
          </div>
        )}

        <div className={styles.body}>
          <Stack gap={6}>
            {/* ── Metadata ──────────────────────────────────────── */}
            <section>
              <h3 className={styles.sectionTitle}>{t('metadata', 'Metadata')}</h3>
              <Tile className={styles.metaTile}>
                <StructuredListWrapper>
                  <StructuredListHead>
                    <StructuredListRow head>
                      <StructuredListCell head>{t('field', 'Field')}</StructuredListCell>
                      <StructuredListCell head>{t('value', 'Value')}</StructuredListCell>
                    </StructuredListRow>
                  </StructuredListHead>
                  <StructuredListBody>
                    {metaRows.map(({ label, value }) => (
                      <StructuredListRow key={label}>
                        <StructuredListCell noWrap className={styles.metaLabel}>
                          {label}
                        </StructuredListCell>
                        <StructuredListCell>{value}</StructuredListCell>
                      </StructuredListRow>
                    ))}
                  </StructuredListBody>
                </StructuredListWrapper>
              </Tile>
            </section>

            {/* ── Items ─────────────────────────────────────────── */}
            <section>
              <h3 className={styles.sectionTitle}>
                {t('items', 'Items')}
                <span className={styles.itemCount}>({q.item?.length ?? 0})</span>
              </h3>
              {q.item && q.item.length > 0 ? (
                <Stack gap={3}>
                  {q.item.map((item, i) => (
                    <QuestionnaireItemView key={i} item={item} />
                  ))}
                </Stack>
              ) : (
                <Tile className={styles.emptyItems}>
                  <p>{t('noItems', 'This questionnaire has no items yet.')}</p>
                </Tile>
              )}
            </section>

            {/* ── Version History ───────────────────────────────── */}
            {!readOnly && (
              <section>
                <h3 className={styles.sectionTitle}>
                  {t('versionHistory', 'Version history')}
                  <span className={styles.itemCount}>({history.length})</span>
                </h3>
                {history.length === 0 ? (
                  <Tile className={styles.emptyItems}>
                    <p>
                      {t(
                        'noVersionHistory',
                        'No previous versions. When you save with a version bump, the old version will be archived here.',
                      )}
                    </p>
                  </Tile>
                ) : (
                  <Tile className={styles.metaTile}>
                    <StructuredListWrapper>
                      <StructuredListHead>
                        <StructuredListRow head>
                          <StructuredListCell head>{t('version', 'Version')}</StructuredListCell>
                          <StructuredListCell head>{t('date', 'Date')}</StructuredListCell>
                          <StructuredListCell head>{t('status', 'Status')}</StructuredListCell>
                          <StructuredListCell head>{t('actions', 'Actions')}</StructuredListCell>
                        </StructuredListRow>
                      </StructuredListHead>
                      <StructuredListBody>
                        {[...history].reverse().map((snapshot, reversedIndex) => {
                          const originalIndex = history.length - 1 - reversedIndex;
                          return (
                            <StructuredListRow key={originalIndex}>
                              <StructuredListCell noWrap>{snapshot.version ?? '--'}</StructuredListCell>
                              <StructuredListCell noWrap>
                                {snapshot.date ? new Date(snapshot.date).toLocaleDateString() : '--'}
                              </StructuredListCell>
                              <StructuredListCell noWrap>
                                <Tag type={STATUS_TAG_TYPE[snapshot.status] ?? 'gray'} size="sm">
                                  {snapshot.status}
                                </Tag>
                              </StructuredListCell>
                              <StructuredListCell>
                                <div className={styles.historyActions}>
                                  <Button
                                    kind="ghost"
                                    size="sm"
                                    renderIcon={View}
                                    onClick={() => onViewSnapshot?.(snapshot)}
                                  >
                                    {t('view', 'View')}
                                  </Button>
                                  <Button
                                    kind="ghost"
                                    size="sm"
                                    renderIcon={Renew}
                                    onClick={() => setRestoreTarget({ snapshot, index: originalIndex })}
                                  >
                                    {t('restore', 'Restore')}
                                  </Button>
                                  <Button
                                    kind="ghost"
                                    size="sm"
                                    renderIcon={TrashCan}
                                    onClick={() => setDeleteIndex(originalIndex)}
                                  >
                                    {t('delete', 'Delete')}
                                  </Button>
                                </div>
                              </StructuredListCell>
                            </StructuredListRow>
                          );
                        })}
                      </StructuredListBody>
                    </StructuredListWrapper>
                  </Tile>
                )}
              </section>
            )}
          </Stack>
        </div>
      </div>
    </>
  );
};

export default QuestionnaireView;
