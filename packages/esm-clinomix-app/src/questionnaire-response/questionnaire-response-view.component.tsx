import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Stack,
  StructuredListBody,
  StructuredListCell,
  StructuredListRow,
  StructuredListWrapper,
  Tag,
} from '@carbon/react';
import { ArrowLeft, DocumentPdf, Download } from '@carbon/react/icons';
import {
  type FhirQuestionnaireResponse,
  type QuestionnaireResponseAnswer,
  type QuestionnaireResponseItem,
} from './questionnaire-response.resource';
import styles from './questionnaire-response.scss';

// ── Answer formatting ─────────────────────────────────────────────────────────

function formatAnswer(answer: QuestionnaireResponseAnswer): string {
  if (answer.valueBoolean !== undefined) return answer.valueBoolean ? 'Yes' : 'No';
  if (answer.valueCoding) return answer.valueCoding.display ?? answer.valueCoding.code ?? '—';
  if (answer.valueString !== undefined) return answer.valueString || '—';
  if (answer.valueInteger !== undefined) return String(answer.valueInteger);
  if (answer.valueDecimal !== undefined) return String(answer.valueDecimal);
  if (answer.valueDate !== undefined) return answer.valueDate;
  if (answer.valueDateTime !== undefined) return new Date(answer.valueDateTime).toLocaleString();
  if (answer.valueTime !== undefined) return answer.valueTime;
  if (answer.valueUri !== undefined) return answer.valueUri;
  if (answer.valueQuantity !== undefined)
    return `${answer.valueQuantity.value ?? ''} ${answer.valueQuantity.unit ?? ''}`.trim();
  return '—';
}

// ── PDF helpers ───────────────────────────────────────────────────────────────

function buildItemsHtml(items: QuestionnaireResponseItem[], depth = 0): string {
  return items
    .map((item) => {
      const indent = depth * 16;
      if (item.item && item.item.length > 0) {
        return `
          <div style="margin-left:${indent}px; margin-bottom:12px;">
            <p style="font-weight:600; font-size:13px; margin:0 0 6px;">${item.text ?? item.linkId}</p>
            ${buildItemsHtml(item.item, depth + 1)}
          </div>`;
      }
      const answerText = (item.answer ?? []).map(formatAnswer).join(', ') || '—';
      return `
        <div style="display:grid; grid-template-columns:200px 1fr; gap:8px; margin-left:${indent}px; margin-bottom:8px; border-bottom:1px solid #e0e0e0; padding-bottom:8px;">
          <span style="color:#525252; font-size:13px;">${item.text ?? item.linkId}</span>
          <span style="font-size:13px;">${answerText}</span>
        </div>`;
    })
    .join('');
}

function buildPrintHtml(response: FhirQuestionnaireResponse): string {
  const title = response.questionnaire ?? 'QuestionnaireResponse';
  const meta = [
    response.subject?.display ? `<tr><td>Patient</td><td>${response.subject.display}</td></tr>` : '',
    response.author?.display ? `<tr><td>Author</td><td>${response.author.display}</td></tr>` : '',
    response.authored ? `<tr><td>Date</td><td>${new Date(response.authored).toLocaleString()}</td></tr>` : '',
    response.questionnaire ? `<tr><td>Questionnaire</td><td>${response.questionnaire}</td></tr>` : '',
    `<tr><td>Status</td><td>${response.status}</td></tr>`,
  ]
    .filter(Boolean)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    body { font-family: 'IBM Plex Sans', Arial, sans-serif; font-size: 14px; color: #161616; margin: 32px; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .badge { display: inline-block; font-size: 11px; padding: 2px 8px; border-radius: 12px; background: #e0e0e0; margin-bottom: 20px; }
    h2 { font-size: 14px; font-weight: 600; border-bottom: 2px solid #0f62fe; padding-bottom: 4px; margin: 24px 0 12px; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
    td { padding: 6px 8px; border-bottom: 1px solid #e0e0e0; font-size: 13px; }
    td:first-child { color: #525252; width: 160px; }
    @media print { body { margin: 16px; } }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <span class="badge">${response.status}</span>

  <h2>Details</h2>
  <table>${meta}</table>

  <h2>Answers</h2>
  ${response.item && response.item.length > 0 ? buildItemsHtml(response.item) : '<p>No answers recorded.</p>'}
</body>
</html>`;
}

// ── Export functions ──────────────────────────────────────────────────────────

function exportJson(response: FhirQuestionnaireResponse) {
  const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `response-${response.id ?? 'unknown'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPdf(response: FhirQuestionnaireResponse) {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(buildPrintHtml(response));
  win.document.close();
  win.focus();
  // Give browser time to render before printing
  win.setTimeout(() => {
    win.print();
    win.close();
  }, 400);
}

// ── Recursive item renderer ───────────────────────────────────────────────────

interface ResponseItemViewProps {
  item: QuestionnaireResponseItem;
  depth?: number;
}

const ResponseItemView: React.FC<ResponseItemViewProps> = ({ item, depth = 0 }) => {
  const { t } = useTranslation();

  if (item.item && item.item.length > 0) {
    return (
      <div className={styles.group} style={depth > 0 ? { marginLeft: '1rem' } : undefined}>
        {item.text && <h4 className={styles.groupTitle}>{item.text}</h4>}
        <Stack gap={4}>
          {item.item.map((child) => (
            <ResponseItemView key={child.linkId} item={child} depth={depth + 1} />
          ))}
        </Stack>
      </div>
    );
  }

  const answers = item.answer ?? [];
  const answerText = answers.length > 0 ? answers.map(formatAnswer).join(', ') : t('noAnswer', '—');

  return (
    <StructuredListWrapper>
      <StructuredListBody>
        <StructuredListRow>
          <StructuredListCell noWrap className={styles.prefix}>
            {item.text ?? item.linkId}
          </StructuredListCell>
          <StructuredListCell>{answerText}</StructuredListCell>
        </StructuredListRow>
      </StructuredListBody>
    </StructuredListWrapper>
  );
};

// ── Status tag ────────────────────────────────────────────────────────────────

function statusTagType(status: FhirQuestionnaireResponse['status']) {
  const map = {
    completed: 'green',
    'in-progress': 'blue',
    amended: 'teal',
    'entered-in-error': 'red',
    stopped: 'cool-gray',
  } as const;
  return map[status] ?? 'cool-gray';
}

// ── Main component ────────────────────────────────────────────────────────────

interface QuestionnaireResponseViewProps {
  response: FhirQuestionnaireResponse;
  onBack: () => void;
}

const QuestionnaireResponseView: React.FC<QuestionnaireResponseViewProps> = ({ response, onBack }) => {
  const { t } = useTranslation();

  return (
    <div className={styles.container}>
      {/* ── Top bar ──────────────────────────────────────────── */}
      <div className={styles.topBar}>
        <Button kind="ghost" renderIcon={ArrowLeft} onClick={onBack}>
          {t('back', 'Back')}
        </Button>
        <div className={styles.topBarTitle}>
          <h2 className={styles.pageTitle}>{response.questionnaire ?? t('response', 'Response')}</h2>
          <Tag type={statusTagType(response.status)}>{response.status}</Tag>
        </div>
        <div className={styles.topBarActions}>
          <Button kind="ghost" renderIcon={Download} size="sm" onClick={() => exportJson(response)}>
            {t('exportJson', 'Export JSON')}
          </Button>
          <Button kind="ghost" renderIcon={DocumentPdf} size="sm" onClick={() => exportPdf(response)}>
            {t('exportPdf', 'Export PDF')}
          </Button>
        </div>
      </div>

      <div className={styles.body}>
        <Stack gap={7}>
          {/* ── Metadata ─────────────────────────────────────── */}
          <section>
            <h3 className={styles.sectionTitle}>{t('details', 'Details')}</h3>
            <StructuredListWrapper>
              <StructuredListBody>
                {response.subject?.display && (
                  <StructuredListRow>
                    <StructuredListCell noWrap className={styles.prefix}>
                      {t('patient', 'Patient')}
                    </StructuredListCell>
                    <StructuredListCell>{response.subject.display}</StructuredListCell>
                  </StructuredListRow>
                )}
                {response.author?.display && (
                  <StructuredListRow>
                    <StructuredListCell noWrap className={styles.prefix}>
                      {t('author', 'Author')}
                    </StructuredListCell>
                    <StructuredListCell>{response.author.display}</StructuredListCell>
                  </StructuredListRow>
                )}
                {response.authored && (
                  <StructuredListRow>
                    <StructuredListCell noWrap className={styles.prefix}>
                      {t('date', 'Date')}
                    </StructuredListCell>
                    <StructuredListCell>{new Date(response.authored).toLocaleString()}</StructuredListCell>
                  </StructuredListRow>
                )}
                {response.questionnaire && (
                  <StructuredListRow>
                    <StructuredListCell noWrap className={styles.prefix}>
                      {t('questionnaire', 'Questionnaire')}
                    </StructuredListCell>
                    <StructuredListCell>{response.questionnaire}</StructuredListCell>
                  </StructuredListRow>
                )}
              </StructuredListBody>
            </StructuredListWrapper>
          </section>

          {/* ── Answers ──────────────────────────────────────── */}
          <section>
            <h3 className={styles.sectionTitle}>{t('answers', 'Answers')}</h3>
            {response.item && response.item.length > 0 ? (
              <Stack gap={4}>
                {response.item.map((item) => (
                  <ResponseItemView key={item.linkId} item={item} />
                ))}
              </Stack>
            ) : (
              <p className={styles.displayText}>{t('noAnswers', 'No answers recorded.')}</p>
            )}
          </section>
        </Stack>
      </div>
    </div>
  );
};

export default QuestionnaireResponseView;
