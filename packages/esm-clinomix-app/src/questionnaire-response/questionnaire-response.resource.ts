// FHIR R4 QuestionnaireResponse — https://www.hl7.org/fhir/questionnaireresponse.html

import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import useSWR from 'swr';
import type { Config } from '@/config-schema';

export type QuestionnaireResponseStatus = 'in-progress' | 'completed' | 'amended' | 'entered-in-error' | 'stopped';

export interface QuestionnaireResponseAnswer {
  valueBoolean?: boolean;
  valueDecimal?: number;
  valueInteger?: number;
  valueDate?: string;
  valueDateTime?: string;
  valueTime?: string;
  valueString?: string;
  valueUri?: string;
  valueCoding?: { system?: string; code?: string; display?: string };
  valueQuantity?: { value?: number; unit?: string };
  item?: QuestionnaireResponseItem[];
}

export interface QuestionnaireResponseItem {
  linkId: string;
  text?: string;
  answer?: QuestionnaireResponseAnswer[];
  item?: QuestionnaireResponseItem[];
}

export interface FhirQuestionnaireResponse {
  resourceType: 'QuestionnaireResponse';
  id?: string;
  questionnaire?: string;
  status: QuestionnaireResponseStatus;
  subject?: { reference: string; display?: string };
  author?: { reference: string; display?: string };
  authored?: string;
  item: QuestionnaireResponseItem[];
}

// ── Patient search ──────────────────────────────────────────────────────────

export interface PatientSearchResult {
  uuid: string;
  display: string;
}

export function usePatientSearch(query: string) {
  const trimmed = query.trim();
  const url = trimmed.length >= 2 ? `${restBaseUrl}/patient?q=${encodeURIComponent(trimmed)}&v=default&limit=10` : null;

  const { data, isLoading } = useSWR<{ data: { results: PatientSearchResult[] } }>(url, openmrsFetch);

  return {
    patients: data?.data?.results ?? [],
    isLoading,
  };
}

// ── OpenMRS REST response shape ──────────────────────────────────────────────

interface QuestionnaireResponseRestResult {
  uuid: string;
  status?: string;
  questionnaire?: string;
  subject?: string;
  authored?: string;
  /** Full FHIR JSON string — only present when ?v=full */
  json?: string;
}

interface RestListResponse<T> {
  results: T[];
}

function restResultToFhirQuestionnaireResponse(r: QuestionnaireResponseRestResult): FhirQuestionnaireResponse {
  if (r.json) {
    try {
      const parsed = JSON.parse(r.json) as FhirQuestionnaireResponse;
      return { ...parsed, id: r.uuid };
    } catch {
      // fall through to flat mapping below
    }
  }
  return {
    resourceType: 'QuestionnaireResponse',
    id: r.uuid,
    status: (r.status as QuestionnaireResponseStatus) ?? 'in-progress',
    questionnaire: r.questionnaire,
    subject: r.subject ? { reference: r.subject } : undefined,
    authored: r.authored,
    item: [],
  };
}

// ── localStorage helpers — devMode only ─────────────────────────────────────

const RESPONSES_KEY = 'clinomix:responses';

function localGetResponses(): FhirQuestionnaireResponse[] {
  const stored = localStorage.getItem(RESPONSES_KEY);
  return stored ? (JSON.parse(stored) as FhirQuestionnaireResponse[]) : [];
}

function localSaveResponse(response: FhirQuestionnaireResponse): string {
  const all = localGetResponses();
  const id = response.id ?? `qr-${Date.now()}`;
  const withId: FhirQuestionnaireResponse = { ...response, id };
  const idx = all.findIndex((r) => r.id === id);
  if (idx >= 0) {
    all[idx] = withId;
  } else {
    all.push(withId);
  }
  localStorage.setItem(RESPONSES_KEY, JSON.stringify(all));
  return id;
}

function localDeleteResponse(id: string): void {
  localStorage.setItem(RESPONSES_KEY, JSON.stringify(localGetResponses().filter((r) => r.id !== id)));
}

// ── Unified hooks — always call hooks unconditionally; branch on devMode in body

export function useResponses() {
  const { devMode } = useConfig<Config>();

  if (devMode) {
    const responses = localGetResponses();
    return { responses, error: null, isLoading: false, mutate: () => {} };
  }

  const { data, error, isLoading, mutate } = useSWR<{ data: RestListResponse<QuestionnaireResponseRestResult> }>(
    devMode ? null : `${restBaseUrl}/questionnaireresponse?v=full`,
    openmrsFetch,
  );

  const responses = (data?.data?.results ?? []).map(restResultToFhirQuestionnaireResponse);
  return { responses, error, isLoading, mutate };
}

export function useSaveResponse() {
  const { devMode } = useConfig<Config>();
  return async (response: FhirQuestionnaireResponse): Promise<string> => {
    if (devMode) return localSaveResponse(response);

    const isUpdate = Boolean(response.id);
    const url = isUpdate
      ? `${restBaseUrl}/questionnaireresponse/${response.id}`
      : `${restBaseUrl}/questionnaireresponse`;

    const result = await openmrsFetch<QuestionnaireResponseRestResult>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ json: JSON.stringify(response) }),
    });

    return result.data.uuid;
  };
}

export function useDeleteResponse() {
  const { devMode } = useConfig<Config>();
  return async (id: string): Promise<void> => {
    if (devMode) {
      localDeleteResponse(id);
      return;
    }
    await openmrsFetch(`${restBaseUrl}/questionnaireresponse/${id}`, { method: 'DELETE' });
  };
}

export function useImportResponses() {
  const { devMode } = useConfig<Config>();
  return async (resources: FhirQuestionnaireResponse[]): Promise<{ added: number; updated: number }> => {
    if (devMode) {
      const existing = localGetResponses();
      let added = 0;
      let updated = 0;
      for (const r of resources) {
        const isNew = !r.id || !existing.find((x) => x.id === r.id);
        localSaveResponse(r);
        if (isNew) added++;
        else updated++;
      }
      return { added, updated };
    }

    let added = 0;
    let updated = 0;
    const headers = { 'Content-Type': 'application/json' };
    for (const r of resources) {
      const body = JSON.stringify({ json: JSON.stringify(r) });
      if (r.id) {
        try {
          await openmrsFetch(`${restBaseUrl}/questionnaireresponse/${r.id}`, { method: 'POST', headers, body });
          updated++;
        } catch {
          await openmrsFetch(`${restBaseUrl}/questionnaireresponse`, { method: 'POST', headers, body });
          added++;
        }
      } else {
        await openmrsFetch(`${restBaseUrl}/questionnaireresponse`, { method: 'POST', headers, body });
        added++;
      }
    }
    return { added, updated };
  };
}
