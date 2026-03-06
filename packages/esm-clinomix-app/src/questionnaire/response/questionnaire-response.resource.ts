// FHIR R4 QuestionnaireResponse — https://www.hl7.org/fhir/questionnaireresponse.html

import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import useSWR from 'swr';

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

// ── Dev storage ─────────────────────────────────────────────────────────────

const RESPONSES_KEY = 'clinomix:responses';

export function devGetResponses(): FhirQuestionnaireResponse[] {
  const stored = localStorage.getItem(RESPONSES_KEY);
  return stored ? (JSON.parse(stored) as FhirQuestionnaireResponse[]) : [];
}

export function devSaveResponse(response: FhirQuestionnaireResponse): string {
  const all = devGetResponses();
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

export function devDeleteResponse(id: string): void {
  localStorage.setItem(RESPONSES_KEY, JSON.stringify(devGetResponses().filter((r) => r.id !== id)));
}
