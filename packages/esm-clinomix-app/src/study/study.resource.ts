// Study — groups FHIR Questionnaires and their QuestionnaireResponses.
// New responses can be added after a study has started.

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';

export interface StudyResponseRef {
  id: number;
  questionnaireResponseFhirId: string;
  dateAdded: string;
}

export interface Study {
  uuid: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'CLOSED';
  questionnaireIds: string[];
  responses: StudyResponseRef[];
  dateCreated: string;
  dateChanged?: string;
}

// ── Local storage (dev mode) ──────────────────────────────────────────────────

const STORAGE_KEY = 'clinomix:studies';

function localGetStudies(): Study[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? (JSON.parse(stored) as Study[]) : [];
}

function localSaveStudies(studies: Study[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(studies));
}

function localGetStudyByUuid(uuid: string): Study | undefined {
  return localGetStudies().find((s) => s.uuid === uuid);
}

function localCreateStudy(partial: Pick<Study, 'name' | 'description' | 'status' | 'questionnaireIds'>): Study {
  const study: Study = {
    uuid: `study-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: partial.name,
    description: partial.description,
    status: partial.status,
    questionnaireIds: partial.questionnaireIds,
    responses: [],
    dateCreated: new Date().toISOString(),
  };
  localSaveStudies([...localGetStudies(), study]);
  return study;
}

function localUpdateStudy(
  uuid: string,
  patch: Partial<Pick<Study, 'name' | 'description' | 'status' | 'questionnaireIds'>>,
): Study {
  const studies = localGetStudies();
  const idx = studies.findIndex((s) => s.uuid === uuid);
  if (idx < 0) throw new Error(`Study ${uuid} not found`);

  let updatedResponses = studies[idx].responses;

  if (patch.questionnaireIds !== undefined) {
    const removedQIds = studies[idx].questionnaireIds.filter((qId) => !patch.questionnaireIds!.includes(qId));
    if (removedQIds.length > 0) {
      const removedRefs = buildQuestionnaireRefs(removedQIds);
      const storedRs = localStorage.getItem('clinomix:responses');
      const allRs: Array<{ id?: string; questionnaire?: string }> = storedRs ? JSON.parse(storedRs) : [];
      const removedResponseIds = new Set(
        allRs.filter((r) => r.id && r.questionnaire && removedRefs.has(r.questionnaire)).map((r) => r.id!),
      );
      updatedResponses = updatedResponses.filter((r) => !removedResponseIds.has(r.questionnaireResponseFhirId));
    }
  }

  const updated: Study = {
    ...studies[idx],
    ...patch,
    responses: updatedResponses,
    dateChanged: new Date().toISOString(),
  };
  studies[idx] = updated;
  localSaveStudies(studies);
  return updated;
}

function localDeleteStudy(uuid: string): void {
  localSaveStudies(localGetStudies().filter((s) => s.uuid !== uuid));
}

function localAddResponse(studyUuid: string, questionnaireResponseFhirId: string): Study {
  const studies = localGetStudies();
  const idx = studies.findIndex((s) => s.uuid === studyUuid);
  if (idx < 0) throw new Error(`Study ${studyUuid} not found`);
  const nextId = Math.max(0, ...studies[idx].responses.map((r) => r.id)) + 1;
  const ref: StudyResponseRef = {
    id: nextId,
    questionnaireResponseFhirId,
    dateAdded: new Date().toISOString(),
  };
  studies[idx] = {
    ...studies[idx],
    responses: [...studies[idx].responses, ref],
    dateChanged: new Date().toISOString(),
  };
  localSaveStudies(studies);
  return studies[idx];
}

function localRemoveResponse(studyUuid: string, responseId: number): Study {
  const studies = localGetStudies();
  const idx = studies.findIndex((s) => s.uuid === studyUuid);
  if (idx < 0) throw new Error(`Study ${studyUuid} not found`);
  studies[idx] = {
    ...studies[idx],
    responses: studies[idx].responses.filter((r) => r.id !== responseId),
    dateChanged: new Date().toISOString(),
  };
  localSaveStudies(studies);
  return studies[idx];
}

function localExportStudy(study: Study): string {
  const storedQs = localStorage.getItem('clinomix:questionnaires');
  const allQuestionnaires: Array<{ id: string }> = storedQs ? JSON.parse(storedQs) : [];

  const storedRs = localStorage.getItem('clinomix:responses');
  const allResponses: Array<{ id?: string }> = storedRs ? JSON.parse(storedRs) : [];

  const entries: unknown[] = [];

  for (const qId of study.questionnaireIds) {
    const q = allQuestionnaires.find((x) => x.id === qId);
    if (q) entries.push({ resource: q });
  }

  for (const ref of study.responses) {
    const qr = allResponses.find((r) => r.id === ref.questionnaireResponseFhirId);
    if (qr) entries.push({ resource: qr });
  }

  return JSON.stringify(
    {
      resourceType: 'Bundle',
      id: study.uuid,
      type: 'collection',
      timestamp: new Date().toISOString(),
      meta: {
        tag: [
          {
            system: 'http://clinomix.org/study',
            code: study.uuid,
            display: study.name,
          },
        ],
      },
      entry: entries,
    },
    null,
    2,
  );
}

// ── Exported utilities ────────────────────────────────────────────────────────

/**
 * Builds the full set of canonical references for a list of questionnaire IDs.
 * A response's `questionnaire` field is stored as `q.url ?? "Questionnaire/${q.id}"`,
 * so we need to match on all variants.
 */
export function buildQuestionnaireRefs(questionnaireIds: string[]): Set<string> {
  const storedQs = localStorage.getItem('clinomix:questionnaires');
  const allQs: Array<{ id: string; url?: string }> = storedQs ? JSON.parse(storedQs) : [];
  const refs = new Set<string>();
  for (const qId of questionnaireIds) {
    refs.add(qId);
    refs.add(`Questionnaire/${qId}`);
    const q = allQs.find((x) => x.id === qId);
    if (q?.url) refs.add(q.url);
  }
  return refs;
}

/**
 * Returns how many study responses would be removed if the given questionnaire IDs
 * were removed from a study. Used to warn the user before saving.
 */
export function countResponsesForQuestionnaires(study: Study, removedQIds: string[]): number {
  if (removedQIds.length === 0 || study.responses.length === 0) return 0;
  const removedRefs = buildQuestionnaireRefs(removedQIds);
  const storedRs = localStorage.getItem('clinomix:responses');
  const allRs: Array<{ id?: string; questionnaire?: string }> = storedRs ? JSON.parse(storedRs) : [];
  const linkedIds = new Set(study.responses.map((r) => r.questionnaireResponseFhirId));
  return allRs.filter((r) => r.id && linkedIds.has(r.id) && r.questionnaire && removedRefs.has(r.questionnaire)).length;
}

// ── Real REST API (production) ────────────────────────────────────────────────

const STUDY_BASE = `${restBaseUrl}/clinomix/study`;

async function apiCreateStudy(
  partial: Pick<Study, 'name' | 'description' | 'status' | 'questionnaireIds'>,
): Promise<Study> {
  const { data } = await openmrsFetch<Study>(STUDY_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(partial),
  });
  return data;
}

async function apiUpdateStudy(
  uuid: string,
  patch: Partial<Pick<Study, 'name' | 'description' | 'status' | 'questionnaireIds'>>,
): Promise<Study> {
  const { data } = await openmrsFetch<Study>(`${STUDY_BASE}/${uuid}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return data;
}

async function apiDeleteStudy(uuid: string): Promise<void> {
  await openmrsFetch(`${STUDY_BASE}/${uuid}`, { method: 'DELETE' });
}

async function apiAddStudyResponse(studyUuid: string, questionnaireResponseFhirId: string): Promise<Study> {
  const { data } = await openmrsFetch<Study>(`${STUDY_BASE}/${studyUuid}/response`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionnaireResponseFhirId }),
  });
  return data;
}

async function apiRemoveStudyResponse(studyUuid: string, responseId: number): Promise<void> {
  await openmrsFetch(`${STUDY_BASE}/${studyUuid}/response/${responseId}`, { method: 'DELETE' });
}

async function apiFetchExportStudy(uuid: string): Promise<string> {
  const { data } = await openmrsFetch<unknown>(`${STUDY_BASE}/${uuid}/export`);
  return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
}

// ── Unified hooks ─────────────────────────────────────────────────────────────

export function useStudies() {
  const { devMode } = useConfig<Config>();
  const [version, setVersion] = useState(0);

  const swrResult = useSWR<{ data: { results: Study[] } }>(devMode ? null : `${STUDY_BASE}?v=full`, openmrsFetch);

  if (devMode) {
    const studies = localGetStudies();
    const mutate = () => setVersion((v) => v + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return { studies, error: null, isLoading: false, mutate };
  }

  return {
    studies: swrResult.data?.data?.results ?? [],
    error: swrResult.error,
    isLoading: swrResult.isLoading,
    mutate: swrResult.mutate,
  };
}

export function useStudy(uuid: string | undefined) {
  const { devMode } = useConfig<Config>();
  const [version, setVersion] = useState(0);

  const swrResult = useSWR<{ data: Study }>(devMode || !uuid ? null : `${STUDY_BASE}/${uuid}?v=full`, openmrsFetch);

  if (devMode) {
    const study = uuid ? localGetStudyByUuid(uuid) : undefined;
    const mutate = () => setVersion((v) => v + 1);
    return { study, error: null, isLoading: false, mutate };
  }

  return {
    study: swrResult.data?.data,
    error: swrResult.error,
    isLoading: swrResult.isLoading,
    mutate: swrResult.mutate,
  };
}

export function useCreateStudy() {
  const { devMode } = useConfig<Config>();
  return useCallback(
    (partial: Pick<Study, 'name' | 'description' | 'status' | 'questionnaireIds'>): Promise<Study> => {
      if (devMode) {
        return Promise.resolve(localCreateStudy(partial));
      }
      return apiCreateStudy(partial);
    },
    [devMode],
  );
}

export function useUpdateStudy() {
  const { devMode } = useConfig<Config>();
  return useCallback(
    (
      uuid: string,
      patch: Partial<Pick<Study, 'name' | 'description' | 'status' | 'questionnaireIds'>>,
    ): Promise<Study> => {
      if (devMode) {
        return Promise.resolve(localUpdateStudy(uuid, patch));
      }
      return apiUpdateStudy(uuid, patch);
    },
    [devMode],
  );
}

export function useDeleteStudy() {
  const { devMode } = useConfig<Config>();
  return useCallback(
    (uuid: string): Promise<void> => {
      if (devMode) {
        localDeleteStudy(uuid);
        return Promise.resolve();
      }
      return apiDeleteStudy(uuid);
    },
    [devMode],
  );
}

export function useAddStudyResponse() {
  const { devMode } = useConfig<Config>();
  return useCallback(
    (studyUuid: string, questionnaireResponseFhirId: string): Promise<Study> => {
      if (devMode) {
        return Promise.resolve(localAddResponse(studyUuid, questionnaireResponseFhirId));
      }
      return apiAddStudyResponse(studyUuid, questionnaireResponseFhirId);
    },
    [devMode],
  );
}

export function useRemoveStudyResponse() {
  const { devMode } = useConfig<Config>();
  return useCallback(
    (studyUuid: string, responseId: number): Promise<void> => {
      if (devMode) {
        localRemoveResponse(studyUuid, responseId);
        return Promise.resolve();
      }
      return apiRemoveStudyResponse(studyUuid, responseId);
    },
    [devMode],
  );
}

export function useExportStudy() {
  const { devMode } = useConfig<Config>();
  return useCallback(
    (study: Study): Promise<string> => {
      if (devMode) {
        return Promise.resolve(localExportStudy(study));
      }
      return apiFetchExportStudy(study.uuid);
    },
    [devMode],
  );
}
