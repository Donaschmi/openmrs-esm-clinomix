// FHIR R4 Questionnaire — https://www.hl7.org/fhir/questionnaire.html
// HAPI FHIR docs   — https://hapifhir.io/hapi-fhir/docs/clinical_reasoning/questionnaires.html

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
// TODO: Replace DEV_MODE flag and swap to the real API call once the backend
//       is available.
//       Expected endpoint: GET /ws/fhir2/R4/Questionnaire?_count=100&_sort=title
// ---------------------------------------------------------------------------
const DEV_MODE = process.env.NODE_ENV === 'development';
const STORAGE_KEY = 'clinomix:questionnaires';

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

// --- localStorage helpers (dev only) ---------------------------------------

export function devGetQuestionnaires(): FhirQuestionnaire[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    return JSON.parse(stored) as FhirQuestionnaire[];
  }
  // First visit: seed and persist
  localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_QUESTIONNAIRES));
  return SEED_QUESTIONNAIRES;
}

export function devSaveQuestionnaires(questionnaires: FhirQuestionnaire[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(questionnaires));
}

// ---------------------------------------------------------------------------

export function useQuestionnaires() {
  if (DEV_MODE) {
    const questionnaires = devGetQuestionnaires();
    return {
      questionnaires,
      total: questionnaires.length,
      error: null,
      isLoading: false,
      mutate: () => {},
    };
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

  return {
    questionnaires: [] as FhirQuestionnaire[],
    total: 0,
    error: null,
    isLoading: false,
    mutate: () => {},
  };
}

// ---------------------------------------------------------------------------
// Version history
// ---------------------------------------------------------------------------

const HISTORY_KEY = 'clinomix:questionnaire-history';

export function devGetVersionHistory(id: string): FhirQuestionnaire[] {
  const stored = localStorage.getItem(HISTORY_KEY);
  if (!stored) return [];
  const all = JSON.parse(stored) as Record<string, FhirQuestionnaire[]>;
  return all[id] ?? [];
}

export function devArchiveVersion(q: FhirQuestionnaire): void {
  const stored = localStorage.getItem(HISTORY_KEY);
  const all: Record<string, FhirQuestionnaire[]> = stored ? JSON.parse(stored) : {};
  const existing = all[q.id] ?? [];
  all[q.id] = [...existing, q];
  localStorage.setItem(HISTORY_KEY, JSON.stringify(all));
}

export function devDeleteArchivedVersion(id: string, index: number): void {
  const stored = localStorage.getItem(HISTORY_KEY);
  if (!stored) return;
  const all = JSON.parse(stored) as Record<string, FhirQuestionnaire[]>;
  const snapshots = [...(all[id] ?? [])];
  snapshots.splice(index, 1);
  all[id] = snapshots;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(all));
}

export function bumpVersion(current: string | undefined, type: 'major' | 'minor' | 'patch'): string {
  const parts = (current ?? '1.0.0').split('.').map((p) => parseInt(p, 10));
  const [major = 1, minor = 0, patch = 0] = parts;
  if (type === 'major') return `${major + 1}.0.0`;
  if (type === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}
