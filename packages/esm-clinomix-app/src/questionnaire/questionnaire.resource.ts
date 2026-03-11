// FHIR R4 Questionnaire — https://www.hl7.org/fhir/questionnaire.html
// HAPI FHIR docs   — https://hapifhir.io/hapi-fhir/docs/clinical_reasoning/questionnaires.html

import { useState, useMemo, useCallback } from 'react';
import { useConfig } from '@openmrs/esm-framework';
import type { Config } from '../config-schema';

export type QuestionnaireStatus = 'draft' | 'active' | 'retired' | 'unknown';
export type QuestionnaireItemType =
  | 'group'
  | 'display'
  | 'boolean'
  | 'decimal'
  | 'integer'
  | 'date'
  | 'dateTime'
  | 'time'
  | 'string'
  | 'text'
  | 'url'
  | 'choice'
  | 'open-choice'
  | 'attachment'
  | 'reference'
  | 'quantity';

export interface FhirCoding {
  system?: string;
  version?: string;
  code?: string;
  display?: string;
  userSelected?: boolean;
}

export interface FhirAnswerOption {
  valueCoding?: FhirCoding;
  valueString?: string;
  valueInteger?: number;
  valueDate?: string;
  valueTime?: string;
  initialSelected?: boolean;
}

export interface FhirQuestionnaireItem {
  linkId: string;
  definition?: string;
  code?: FhirCoding[];
  prefix?: string;
  text?: string;
  type: QuestionnaireItemType;
  enableWhen?: Array<{
    question: string;
    operator: 'exists' | '=' | '!=' | '>' | '<' | '>=' | '<=';
    answerBoolean?: boolean;
    answerDecimal?: number;
    answerInteger?: number;
    answerDate?: string;
    answerDateTime?: string;
    answerTime?: string;
    answerString?: string;
    answerCoding?: FhirCoding;
  }>;
  enableBehavior?: 'all' | 'any';
  required?: boolean;
  repeats?: boolean;
  readOnly?: boolean;
  maxLength?: number;
  answerValueSet?: string;
  answerOption?: FhirAnswerOption[];
  item?: FhirQuestionnaireItem[];
}

export interface FhirQuestionnaire {
  resourceType: 'Questionnaire';
  id: string;
  url?: string;
  identifier?: Array<{ system?: string; value?: string }>;
  version?: string;
  name?: string;
  title?: string;
  derivedFrom?: string[];
  status: QuestionnaireStatus;
  experimental?: boolean;
  subjectType?: string[];
  date?: string;
  publisher?: string;
  description?: string;
  purpose?: string;
  approvalDate?: string;
  lastReviewDate?: string;
  code?: FhirCoding[];
  item?: FhirQuestionnaireItem[];
}

export interface FhirBundle {
  resourceType: 'Bundle';
  total: number;
  entry?: Array<{ resource: FhirQuestionnaire }>;
}

// ---------------------------------------------------------------------------
// localStorage helpers — private implementation detail
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'clinomix:questionnaires';
const HISTORY_KEY = 'clinomix:questionnaire-history';

const SEED_QUESTIONNAIRES: FhirQuestionnaire[] = [
  {
    resourceType: 'Questionnaire',
    id: 'q-001',
    url: 'http://example.org/fhir/Questionnaire/patient-intake',
    version: '1.0.0',
    name: 'PatientIntake',
    title: 'Patient Intake Form',
    status: 'active',
    date: '2024-11-15T00:00:00Z',
    publisher: 'Clinomix',
    subjectType: ['Patient'],
    description: 'Initial patient intake questionnaire',
    item: [],
  },
  {
    resourceType: 'Questionnaire',
    id: 'q-002',
    url: 'http://example.org/fhir/Questionnaire/phq9',
    version: '2.1.0',
    name: 'PHQ9',
    title: 'PHQ-9 Depression Screening',
    status: 'active',
    date: '2024-09-01T00:00:00Z',
    publisher: 'Clinomix',
    subjectType: ['Patient'],
    description: 'Patient Health Questionnaire 9-item depression scale',
    item: [],
  },
  {
    resourceType: 'Questionnaire',
    id: 'q-003',
    url: 'http://example.org/fhir/Questionnaire/antenatal-visit',
    version: '0.3.0',
    name: 'AntenatalVisit',
    title: 'Antenatal Visit Assessment',
    status: 'draft',
    date: '2025-01-20T00:00:00Z',
    publisher: 'Clinomix',
    subjectType: ['Patient'],
    description: 'Routine antenatal visit data collection',
    item: [],
  },
];

function localGetQuestionnaires(): FhirQuestionnaire[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return JSON.parse(stored) as FhirQuestionnaire[];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_QUESTIONNAIRES));
  return SEED_QUESTIONNAIRES;
}

function localSaveQuestionnaires(questionnaires: FhirQuestionnaire[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(questionnaires));
}

function localGetVersionHistory(id: string): FhirQuestionnaire[] {
  const stored = localStorage.getItem(HISTORY_KEY);
  if (!stored) return [];
  return (JSON.parse(stored) as Record<string, FhirQuestionnaire[]>)[id] ?? [];
}

function localArchiveVersion(q: FhirQuestionnaire): void {
  const stored = localStorage.getItem(HISTORY_KEY);
  const all: Record<string, FhirQuestionnaire[]> = stored ? JSON.parse(stored) : {};
  all[q.id] = [...(all[q.id] ?? []), q];
  localStorage.setItem(HISTORY_KEY, JSON.stringify(all));
}

function localDeleteArchivedVersion(id: string, index: number): void {
  const stored = localStorage.getItem(HISTORY_KEY);
  if (!stored) return;
  const all = JSON.parse(stored) as Record<string, FhirQuestionnaire[]>;
  const snapshots = [...(all[id] ?? [])];
  snapshots.splice(index, 1);
  all[id] = snapshots;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(all));
}

// ---------------------------------------------------------------------------
// Pure utility — environment-agnostic
// ---------------------------------------------------------------------------

export function bumpVersion(current: string | undefined, type: 'major' | 'minor' | 'patch'): string {
  const parts = (current ?? '1.0.0').split('.').map((p) => parseInt(p, 10));
  const [major = 1, minor = 0, patch = 0] = parts;
  if (type === 'major') return `${major + 1}.0.0`;
  if (type === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

// ---------------------------------------------------------------------------
// Unified hooks — internally branch on devMode; components import only these
// ---------------------------------------------------------------------------

export function useQuestionnaires() {
  const { devMode } = useConfig<Config>();
  if (devMode) {
    const questionnaires = localGetQuestionnaires();
    return { questionnaires, total: questionnaires.length, error: null, isLoading: false, mutate: () => {} };
  }

  // TODO: uncomment once the backend endpoint is live
  // const { data, error, isLoading, mutate } = useSWR<{ data: FhirBundle }>(
  //   `${fhirBaseUrl}/Questionnaire?_count=100&_sort=title`,
  //   openmrsFetch,
  // );
  // return {
  //   questionnaires: data?.data?.entry?.map((e) => e.resource) ?? [],
  //   total: data?.data?.total ?? 0,
  //   error,
  //   isLoading,
  //   mutate,
  // };

  return { questionnaires: [] as FhirQuestionnaire[], total: 0, error: null, isLoading: false, mutate: () => {} };
}

export type VersionChoice = 'overwrite' | 'patch' | 'minor' | 'major';

export function useSaveQuestionnaire() {
  const { devMode } = useConfig<Config>();
  return (
    form: Omit<FhirQuestionnaire, 'id'>,
    options: { isEditing: boolean; original?: FhirQuestionnaire; versionChoice?: VersionChoice },
  ): string => {
    if (devMode) {
      const { isEditing, original, versionChoice = 'overwrite' } = options;
      const all = localGetQuestionnaires();
      let finalForm = { ...form, date: new Date().toISOString() };
      let id: string;

      if (isEditing && original) {
        if (versionChoice !== 'overwrite') {
          localArchiveVersion(original);
          finalForm = { ...finalForm, version: bumpVersion(original.version, versionChoice) };
        }
        id = original.id;
        localSaveQuestionnaires(all.map((q) => (q.id === id ? { ...finalForm, id } : q)));
      } else {
        id = `q-${Date.now()}`;
        localSaveQuestionnaires([...all, { ...finalForm, id }]);
      }
      return id;
    }
    // TODO: POST /ws/fhir2/R4/Questionnaire (create) or PUT (update)
    return '';
  };
}

export function useDeleteQuestionnaire() {
  const { devMode } = useConfig<Config>();
  return (id: string): void => {
    if (devMode) {
      localSaveQuestionnaires(localGetQuestionnaires().filter((q) => q.id !== id));
      return;
    }
    // TODO: DELETE /ws/fhir2/R4/Questionnaire/{id}
  };
}

export function useImportQuestionnaires() {
  const { devMode } = useConfig<Config>();
  return (resources: FhirQuestionnaire[]): { added: number; updated: number } => {
    if (devMode) {
      const merged = [...localGetQuestionnaires()];
      let added = 0;
      let updated = 0;
      for (const q of resources) {
        const id = q.id ?? `q-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const withId = { ...q, id };
        const idx = merged.findIndex((x) => x.id === id);
        if (idx >= 0) {
          merged[idx] = withId;
          updated++;
        } else {
          merged.push(withId);
          added++;
        }
      }
      localSaveQuestionnaires(merged);
      return { added, updated };
    }
    // TODO: batch import via FHIR transaction bundle
    return { added: 0, updated: 0 };
  };
}

export function useVersionHistory(id: string, skip = false) {
  const { devMode } = useConfig<Config>();
  const [refreshCount, setRefreshCount] = useState(0);

  const history = useMemo(
    () => (skip || !devMode ? ([] as FhirQuestionnaire[]) : localGetVersionHistory(id)),
    // refreshCount is intentionally included to allow manual refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, devMode, skip, refreshCount],
  );

  const refresh = useCallback(() => setRefreshCount((c) => c + 1), []);

  return { history, refresh };
}

export function useRestoreQuestionnaire() {
  const { devMode } = useConfig<Config>();
  return (current: FhirQuestionnaire, snapshot: FhirQuestionnaire, snapshotIndex: number): void => {
    if (devMode) {
      localArchiveVersion(current);
      localSaveQuestionnaires(
        localGetQuestionnaires().map((x) =>
          x.id === current.id ? { ...snapshot, date: new Date().toISOString() } : x,
        ),
      );
      localDeleteArchivedVersion(current.id, snapshotIndex);
      return;
    }
    // TODO: PUT /ws/fhir2/R4/Questionnaire/{id}
  };
}

export function useDeleteSnapshot() {
  const { devMode } = useConfig<Config>();
  return (questionnaireId: string, snapshotIndex: number): void => {
    if (devMode) {
      localDeleteArchivedVersion(questionnaireId, snapshotIndex);
      return;
    }
    // TODO: real API for snapshot management
  };
}
