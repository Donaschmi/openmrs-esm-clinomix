import {
  type FhirQuestionnaireResponse,
  type QuestionnaireResponseAnswer,
  type QuestionnaireResponseItem,
} from './questionnaire-response.resource';

export type ExportFormat = 'json' | 'pdf';
export type GroupMode = 'none' | 'questionnaire' | 'patient' | 'questionnaire-patient';

// ── JSON Bundle ────────────────────────────────────────────────────────────────

export function exportJsonBundle(responses: FhirQuestionnaireResponse[]): void {
  const bundle = {
    resourceType: 'Bundle',
    type: 'collection',
    total: responses.length,
    entry: responses.map((r) => ({ resource: r })),
  };
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `responses-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── PDF helpers ────────────────────────────────────────────────────────────────

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

function itemsHtml(items: QuestionnaireResponseItem[], depth = 0): string {
  return items
    .map((item) => {
      const indent = depth * 14;
      if (item.item && item.item.length > 0) {
        return `<div style="margin-left:${indent}px;margin-bottom:10px;">
          <p style="font-weight:600;font-size:12px;margin:0 0 4px;">${item.text ?? item.linkId}</p>
          ${itemsHtml(item.item, depth + 1)}
        </div>`;
      }
      const txt = (item.answer ?? []).map(formatAnswer).join(', ') || '—';
      return `<div style="display:grid;grid-template-columns:180px 1fr;gap:6px;margin-left:${indent}px;margin-bottom:6px;border-bottom:1px solid #e0e0e0;padding-bottom:6px;">
        <span style="color:#525252;font-size:12px;">${item.text ?? item.linkId}</span>
        <span style="font-size:12px;">${txt}</span>
      </div>`;
    })
    .join('');
}

function responseBlock(r: FhirQuestionnaireResponse, titleTag: 'h3' | 'h4' = 'h3'): string {
  const meta = [
    r.subject?.display ? `<tr><td>Patient</td><td>${r.subject.display}</td></tr>` : '',
    r.author?.display ? `<tr><td>Author</td><td>${r.author.display}</td></tr>` : '',
    r.authored ? `<tr><td>Date</td><td>${new Date(r.authored).toLocaleString()}</td></tr>` : '',
    r.questionnaire ? `<tr><td>Questionnaire</td><td>${r.questionnaire}</td></tr>` : '',
    `<tr><td>Status</td><td>${r.status}</td></tr>`,
  ]
    .filter(Boolean)
    .join('');
  const answers =
    r.item && r.item.length > 0 ? itemsHtml(r.item) : '<p style="color:#6f6f6f;font-size:12px;">No answers.</p>';
  return `<div class="resp-block">
    <${titleTag} class="resp-title">${r.questionnaire ?? r.id ?? 'Response'}</${titleTag}>
    <table>${meta}</table>
    ${answers}
  </div>`;
}

const PDF_CSS = `
  body{font-family:'IBM Plex Sans',Arial,sans-serif;font-size:13px;color:#161616;margin:32px;}
  h1{font-size:20px;margin:0 0 4px;border-bottom:3px solid #0f62fe;padding-bottom:6px;}
  h2{font-size:16px;margin:24px 0 6px;border-bottom:2px solid #393939;padding-bottom:3px;}
  h3{font-size:14px;margin:16px 0 4px;border-bottom:1px solid #c6c6c6;padding-bottom:2px;}
  h4{font-size:13px;margin:12px 0 3px;font-style:italic;color:#393939;}
  table{border-collapse:collapse;width:100%;margin-bottom:8px;}
  td{padding:4px 8px;border-bottom:1px solid #e0e0e0;font-size:12px;}
  td:first-child{color:#525252;width:130px;}
  .resp-block{margin-bottom:16px;}
  .page-break{page-break-before:always;}
  @media print{body{margin:16px;}}
`;

function wrapHtml(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>${title}</title><style>${PDF_CSS}</style></head><body>${body}</body></html>`;
}

function printHtml(html: string): void {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.setTimeout(() => {
    win.print();
    win.close();
  }, 500);
}

// ── Grouped PDF export ─────────────────────────────────────────────────────────

export function exportPdfGrouped(responses: FhirQuestionnaireResponse[], groupBy: GroupMode): void {
  const date = new Date().toLocaleString();
  const subtitle = `<p style="color:#6f6f6f;font-size:11px;margin:4px 0 24px;">Exported: ${date} &nbsp;·&nbsp; ${responses.length} response(s)</p>`;

  let body = '';

  if (groupBy === 'none') {
    body =
      `<h1>Responses Export</h1>${subtitle}` +
      responses
        .map((r) => responseBlock(r))
        .join('<hr style="border:none;border-top:2px solid #e0e0e0;margin:16px 0;">');
  } else if (groupBy === 'questionnaire') {
    const groups = groupByKey(responses, (r) => r.questionnaire ?? '(Unknown questionnaire)');
    body = `<h1>Responses — by Questionnaire</h1>${subtitle}`;
    let first = true;
    for (const [q, items] of groups) {
      body += `${first ? '' : '<div class="page-break"></div>'}<h2>${q} (${items.length})</h2>`;
      body += items.map((r) => responseBlock(r, 'h4')).join('');
      first = false;
    }
  } else if (groupBy === 'patient') {
    const groups = groupByKey(responses, (r) => r.subject?.display ?? '(Unknown patient)');
    body = `<h1>Responses — by Patient</h1>${subtitle}`;
    let first = true;
    for (const [p, items] of groups) {
      body += `${first ? '' : '<div class="page-break"></div>'}<h2>${p} (${items.length})</h2>`;
      body += items.map((r) => responseBlock(r, 'h4')).join('');
      first = false;
    }
  } else {
    // questionnaire → patient two-level grouping
    const outer = groupByKey(responses, (r) => r.questionnaire ?? '(Unknown questionnaire)');
    body = `<h1>Responses — by Questionnaire &amp; Patient</h1>${subtitle}`;
    let firstQ = true;
    for (const [q, qItems] of outer) {
      body += `${firstQ ? '' : '<div class="page-break"></div>'}<h2>${q} (${qItems.length})</h2>`;
      const inner = groupByKey(qItems, (r) => r.subject?.display ?? '(Unknown patient)');
      for (const [p, pItems] of inner) {
        body += `<h3>${p} (${pItems.length})</h3>`;
        body += pItems.map((r) => responseBlock(r, 'h4')).join('');
      }
      firstQ = false;
    }
  }

  printHtml(wrapHtml('Responses Export', body));
}

function groupByKey<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = keyFn(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(item);
  }
  return map;
}
