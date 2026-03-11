// FHIR R4 QuestionnaireResponse — https://www.hl7.org/fhir/questionnaireresponse.html

import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import useSWR from 'swr';
import type { Config } from '../../config-schema';

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

// ── localStorage helpers — private implementation detail ────────────────────

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

// ── Unified hooks — internally branch on devMode; components import only these

export function useResponses() {
  const { devMode } = useConfig<Config>();
  if (devMode) {
    const responses = localGetResponses();
    return { responses, error: null, isLoading: false };
  }
  // TODO: useSWR GET /ws/fhir2/R4/QuestionnaireResponse
  return { responses: [] as FhirQuestionnaireResponse[], error: null, isLoading: false };
}

export function useSaveResponse() {
  const { devMode } = useConfig<Config>();
  return (response: FhirQuestionnaireResponse): string => {
    if (devMode) return localSaveResponse(response);
    // TODO: POST /ws/fhir2/R4/QuestionnaireResponse
    return '';
  };
}

export function useDeleteResponse() {
  const { devMode } = useConfig<Config>();
  return (id: string): void => {
    if (devMode) {
      localDeleteResponse(id);
      return;
    }
    // TODO: DELETE /ws/fhir2/R4/QuestionnaireResponse/{id}
  };
}

export function useImportResponses() {
  const { devMode } = useConfig<Config>();
  return (resources: FhirQuestionnaireResponse[]): { added: number; updated: number } => {
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
    // TODO: batch import via FHIR transaction bundle
    return { added: 0, updated: 0 };
  };
}
