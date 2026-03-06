import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Tag,
  Tile,
  StructuredListBody,
  StructuredListCell,
  StructuredListHead,
  StructuredListRow,
  StructuredListWrapper,
  Stack,
} from '@carbon/react';
import { ArrowLeft, Edit } from '@carbon/react/icons';
import { type FhirQuestionnaire, type FhirQuestionnaireItem } from '../questionnaire.resource';
import styles from './questionnaire-view.scss';

interface QuestionnaireViewProps {
  questionnaire: FhirQuestionnaire;
  onBack: () => void;
  onEdit: () => void;
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

const QuestionnaireView: React.FC<QuestionnaireViewProps> = ({ questionnaire: q, onBack, onEdit }) => {
  const { t } = useTranslation();

  const metaRows: Array<{ label: string; value: React.ReactNode }> = [
    { label: t('status', 'Status'), value: <Tag type={STATUS_TAG_TYPE[q.status] ?? 'gray'}>{q.status}</Tag> },
    { label: t('version', 'Version'), value: q.version ?? '--' },
    { label: t('canonicalUrl', 'Canonical URL'), value: q.url ?? '--' },
    { label: t('name', 'Name'), value: q.name ?? '--' },
    { label: t('publisher', 'Publisher'), value: q.publisher ?? '--' },
    { label: t('subjectType', 'Subject type'), value: q.subjectType?.join(', ') ?? '--' },
    { label: t('lastUpdated', 'Last updated'), value: q.date ? new Date(q.date).toLocaleDateString() : '--' },
    {
      label: t('experimental', 'Experimental'),
      value: q.experimental ? t('yes', 'Yes') : t('no', 'No'),
    },
    { label: t('description', 'Description'), value: q.description ?? '--' },
  ];

  return (
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
        <Button kind="tertiary" renderIcon={Edit} onClick={onEdit}>
          {t('edit', 'Edit')}
        </Button>
      </div>

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
        </Stack>
      </div>
    </div>
  );
};

export default QuestionnaireView;
