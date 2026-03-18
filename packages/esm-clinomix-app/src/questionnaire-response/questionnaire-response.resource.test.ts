import { renderHook, act } from '@testing-library/react';
import { useConfig, openmrsFetch } from '@openmrs/esm-framework';
import {
  usePatientSearch,
  useResponses,
  useSaveResponse,
  useDeleteResponse,
  useImportResponses,
  type FhirQuestionnaireResponse,
} from './questionnaire-response.resource';
import type { Config } from '@/config-schema';

const mockUseConfig = jest.mocked(useConfig<Config>);
const mockOpenmrsFetch = jest.mocked(openmrsFetch);

jest.mock('swr', () => ({
  __esModule: true,
  default: jest.fn(),
}));

import useSWR from 'swr';
const mockUseSWR = jest.mocked(useSWR);

// ── usePatientSearch ──────────────────────────────────────────────────────────

describe('usePatientSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSWR.mockReturnValue({ data: undefined, isLoading: false } as any);
  });

  it('does not fetch when query is shorter than 2 characters', () => {
    renderHook(() => usePatientSearch('a'));

    expect(mockUseSWR).toHaveBeenCalledWith(null, openmrsFetch);
  });

  it('fetches when query is 2 or more characters', () => {
    renderHook(() => usePatientSearch('Jo'));

    const [url] = mockUseSWR.mock.calls[0];
    expect(url).toContain('Jo');
    expect(url).toContain('/patient');
  });

  it('encodes special characters in query', () => {
    renderHook(() => usePatientSearch('O Brien'));

    const [url] = mockUseSWR.mock.calls[0];
    expect(url as string).toContain(encodeURIComponent('O Brien'));
  });

  it('returns empty array when no results', () => {
    const { result } = renderHook(() => usePatientSearch('Jo'));

    expect(result.current.patients).toEqual([]);
  });

  it('returns patients from SWR data', () => {
    const patients = [
      { uuid: 'p1', display: 'John Doe' },
      { uuid: 'p2', display: 'Jane Doe' },
    ];
    mockUseSWR.mockReturnValue({
      data: { data: { results: patients } },
      isLoading: false,
    } as any);

    const { result } = renderHook(() => usePatientSearch('Doe'));

    expect(result.current.patients).toHaveLength(2);
    expect(result.current.patients[0].display).toBe('John Doe');
  });
});

// ── useResponses — devMode ────────────────────────────────────────────────────

describe('useResponses (devMode)', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUseConfig.mockReturnValue({ devMode: true } as Config);
    mockUseSWR.mockReturnValue({ data: undefined, error: undefined, isLoading: false, mutate: jest.fn() } as any);
  });

  it('returns empty array when localStorage has no responses', () => {
    const { result } = renderHook(() => useResponses());

    expect(result.current.responses).toHaveLength(0);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('returns responses from localStorage', () => {
    const stored: FhirQuestionnaireResponse[] = [
      { resourceType: 'QuestionnaireResponse', id: 'r1', status: 'completed', item: [] },
    ];
    localStorage.setItem('clinomix:responses', JSON.stringify(stored));

    const { result } = renderHook(() => useResponses());

    expect(result.current.responses).toHaveLength(1);
    expect(result.current.responses[0].id).toBe('r1');
  });
});

// ── useResponses — production mode ────────────────────────────────────────────

describe('useResponses (production mode)', () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue({ devMode: false } as Config);
  });

  it('returns loading state while fetching', () => {
    mockUseSWR.mockReturnValue({ data: undefined, error: undefined, isLoading: true, mutate: jest.fn() } as any);

    const { result } = renderHook(() => useResponses());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.responses).toHaveLength(0);
  });

  it('maps REST results to FHIR responses', () => {
    mockUseSWR.mockReturnValue({
      data: {
        data: {
          results: [
            { uuid: 'r1', status: 'completed', json: null },
            { uuid: 'r2', status: 'in-progress', json: null },
          ],
        },
      },
      error: undefined,
      isLoading: false,
      mutate: jest.fn(),
    } as any);

    const { result } = renderHook(() => useResponses());

    expect(result.current.responses).toHaveLength(2);
    expect(result.current.responses[0].id).toBe('r1');
    expect(result.current.responses[0].status).toBe('completed');
  });

  it('parses full FHIR JSON when json field is present', () => {
    const fhirJson = JSON.stringify({
      resourceType: 'QuestionnaireResponse',
      id: 'original-id',
      status: 'completed',
      questionnaire: 'Questionnaire/q1',
      item: [],
    });
    mockUseSWR.mockReturnValue({
      data: { data: { results: [{ uuid: 'db-uuid', status: 'completed', json: fhirJson }] } },
      error: undefined,
      isLoading: false,
      mutate: jest.fn(),
    } as any);

    const { result } = renderHook(() => useResponses());

    // DB uuid overrides the FHIR JSON id
    expect(result.current.responses[0].id).toBe('db-uuid');
    expect(result.current.responses[0].questionnaire).toBe('Questionnaire/q1');
  });
});

// ── useSaveResponse — devMode ─────────────────────────────────────────────────

describe('useSaveResponse (devMode)', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUseConfig.mockReturnValue({ devMode: true } as Config);
  });

  it('saves a new response to localStorage and returns a generated id', async () => {
    const { result } = renderHook(() => useSaveResponse());
    const response: FhirQuestionnaireResponse = {
      resourceType: 'QuestionnaireResponse',
      status: 'completed',
      item: [],
    };

    let id: string;
    await act(async () => {
      id = await result.current(response);
    });

    expect(id!).toBeTruthy();
    const stored = JSON.parse(localStorage.getItem('clinomix:responses') ?? '[]');
    expect(stored).toHaveLength(1);
  });

  it('updates an existing response by id', async () => {
    const existing: FhirQuestionnaireResponse = {
      resourceType: 'QuestionnaireResponse',
      id: 'r-existing',
      status: 'in-progress',
      item: [],
    };
    localStorage.setItem('clinomix:responses', JSON.stringify([existing]));

    const { result } = renderHook(() => useSaveResponse());
    const updated: FhirQuestionnaireResponse = { ...existing, status: 'completed' };

    await act(async () => {
      await result.current(updated);
    });

    const stored = JSON.parse(localStorage.getItem('clinomix:responses') ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].status).toBe('completed');
  });
});

// ── useSaveResponse — production mode ────────────────────────────────────────

describe('useSaveResponse (production mode)', () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue({ devMode: false } as Config);
    mockOpenmrsFetch.mockResolvedValue({ data: { uuid: 'server-uuid' } } as any);
  });

  it('POSTs to create endpoint for new response', async () => {
    const response: FhirQuestionnaireResponse = {
      resourceType: 'QuestionnaireResponse',
      status: 'completed',
      item: [],
    };
    const { result } = renderHook(() => useSaveResponse());

    await act(async () => {
      await result.current(response);
    });

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      expect.stringContaining('/questionnaireresponse'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('POSTs to update endpoint when response has id', async () => {
    const response: FhirQuestionnaireResponse = {
      resourceType: 'QuestionnaireResponse',
      id: 'r-abc',
      status: 'completed',
      item: [],
    };
    const { result } = renderHook(() => useSaveResponse());

    await act(async () => {
      await result.current(response);
    });

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      expect.stringContaining('/questionnaireresponse/r-abc'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('returns the uuid from the server response', async () => {
    const response: FhirQuestionnaireResponse = {
      resourceType: 'QuestionnaireResponse',
      status: 'completed',
      item: [],
    };
    const { result } = renderHook(() => useSaveResponse());

    let id: string;
    await act(async () => {
      id = await result.current(response);
    });

    expect(id!).toBe('server-uuid');
  });
});

// ── useDeleteResponse — devMode ───────────────────────────────────────────────

describe('useDeleteResponse (devMode)', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUseConfig.mockReturnValue({ devMode: true } as Config);
  });

  it('removes the response from localStorage', async () => {
    const responses: FhirQuestionnaireResponse[] = [
      { resourceType: 'QuestionnaireResponse', id: 'keep', status: 'completed', item: [] },
      { resourceType: 'QuestionnaireResponse', id: 'remove', status: 'completed', item: [] },
    ];
    localStorage.setItem('clinomix:responses', JSON.stringify(responses));

    const { result } = renderHook(() => useDeleteResponse());

    await act(async () => {
      await result.current('remove');
    });

    const stored = JSON.parse(localStorage.getItem('clinomix:responses') ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe('keep');
  });
});

// ── useImportResponses — devMode ──────────────────────────────────────────────

describe('useImportResponses (devMode)', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUseConfig.mockReturnValue({ devMode: true } as Config);
  });

  it('reports correct added and updated counts', async () => {
    const existing: FhirQuestionnaireResponse = {
      resourceType: 'QuestionnaireResponse',
      id: 'existing',
      status: 'in-progress',
      item: [],
    };
    localStorage.setItem('clinomix:responses', JSON.stringify([existing]));

    const { result } = renderHook(() => useImportResponses());

    const toImport: FhirQuestionnaireResponse[] = [
      { resourceType: 'QuestionnaireResponse', id: 'existing', status: 'completed', item: [] }, // update
      { resourceType: 'QuestionnaireResponse', id: 'new-one', status: 'draft', item: [] }, // add
    ];

    let counts: { added: number; updated: number };
    await act(async () => {
      counts = await result.current(toImport);
    });

    expect(counts!.updated).toBe(1);
    expect(counts!.added).toBe(1);
  });
});
