import { renderHook, act } from '@testing-library/react';
import { useConfig, openmrsFetch } from '@openmrs/esm-framework';
import { bumpVersion, useQuestionnaires, useDeleteQuestionnaire, useSaveQuestionnaire } from './questionnaire.resource';
import type { Config } from '../config-schema';

const mockUseConfig = jest.mocked(useConfig<Config>);
const mockOpenmrsFetch = jest.mocked(openmrsFetch);

// Mock useSWR so we control what it returns in production-mode tests
jest.mock('swr', () => ({
  __esModule: true,
  default: jest.fn(),
}));

import useSWR from 'swr';
const mockUseSWR = jest.mocked(useSWR);

// ── bumpVersion ───────────────────────────────────────────────────────────────

describe('bumpVersion', () => {
  it('increments major and resets minor and patch', () => {
    expect(bumpVersion('1.2.3', 'major')).toBe('2.0.0');
  });

  it('increments minor and resets patch', () => {
    expect(bumpVersion('1.2.3', 'minor')).toBe('1.3.0');
  });

  it('increments patch only', () => {
    expect(bumpVersion('1.2.3', 'patch')).toBe('1.2.4');
  });

  it('handles undefined version as 1.0.0', () => {
    expect(bumpVersion(undefined, 'major')).toBe('2.0.0');
    expect(bumpVersion(undefined, 'minor')).toBe('1.1.0');
    expect(bumpVersion(undefined, 'patch')).toBe('1.0.1');
  });

  it('handles zero-based versions', () => {
    expect(bumpVersion('0.0.0', 'major')).toBe('1.0.0');
    expect(bumpVersion('0.0.0', 'minor')).toBe('0.1.0');
    expect(bumpVersion('0.0.0', 'patch')).toBe('0.0.1');
  });

  it('handles large version numbers', () => {
    expect(bumpVersion('10.20.30', 'patch')).toBe('10.20.31');
    expect(bumpVersion('10.20.30', 'minor')).toBe('10.21.0');
    expect(bumpVersion('10.20.30', 'major')).toBe('11.0.0');
  });
});

// ── useQuestionnaires — devMode ───────────────────────────────────────────────

describe('useQuestionnaires (devMode)', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUseConfig.mockReturnValue({ devMode: true } as Config);
    // Provide a no-op SWR in case it gets called
    mockUseSWR.mockReturnValue({ data: undefined, error: undefined, isLoading: false, mutate: jest.fn() } as any);
  });

  it('returns seed questionnaires when localStorage is empty', () => {
    const { result } = renderHook(() => useQuestionnaires());
    expect(result.current.questionnaires.length).toBeGreaterThan(0);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('returns questionnaires stored in localStorage', () => {
    const stored = [{ resourceType: 'Questionnaire', id: 'test-1', title: 'Test Form', status: 'active' as const }];
    localStorage.setItem('clinomix:questionnaires', JSON.stringify(stored));

    const { result } = renderHook(() => useQuestionnaires());

    expect(result.current.questionnaires).toHaveLength(1);
    expect(result.current.questionnaires[0].title).toBe('Test Form');
    expect(result.current.total).toBe(1);
  });
});

// ── useQuestionnaires — production mode ───────────────────────────────────────

describe('useQuestionnaires (production mode)', () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue({ devMode: false } as Config);
  });

  it('returns loading state while fetching', () => {
    mockUseSWR.mockReturnValue({ data: undefined, error: undefined, isLoading: true, mutate: jest.fn() } as any);

    const { result } = renderHook(() => useQuestionnaires());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.questionnaires).toHaveLength(0);
  });

  it('maps REST results to FHIR questionnaires', () => {
    const restResults = {
      data: {
        results: [
          { uuid: 'uuid-1', title: 'Form A', status: 'active', json: null },
          { uuid: 'uuid-2', title: 'Form B', status: 'draft', json: null },
        ],
      },
    };
    mockUseSWR.mockReturnValue({
      data: { data: restResults.data },
      error: undefined,
      isLoading: false,
      mutate: jest.fn(),
    } as any);

    const { result } = renderHook(() => useQuestionnaires());

    expect(result.current.questionnaires).toHaveLength(2);
    expect(result.current.questionnaires[0].id).toBe('uuid-1');
    expect(result.current.questionnaires[0].title).toBe('Form A');
  });

  it('parses full FHIR JSON when json field is present', () => {
    const fhirJson = JSON.stringify({
      resourceType: 'Questionnaire',
      id: 'original-id',
      title: 'Full Form',
      status: 'active',
      version: '2.0.0',
    });
    mockUseSWR.mockReturnValue({
      data: { data: { results: [{ uuid: 'db-uuid', title: 'Full Form', status: 'active', json: fhirJson }] } },
      error: undefined,
      isLoading: false,
      mutate: jest.fn(),
    } as any);

    const { result } = renderHook(() => useQuestionnaires());

    // DB uuid overrides the FHIR JSON id
    expect(result.current.questionnaires[0].id).toBe('db-uuid');
    expect(result.current.questionnaires[0].version).toBe('2.0.0');
  });

  it('propagates error state', () => {
    const error = new Error('Network error');
    mockUseSWR.mockReturnValue({ data: undefined, error, isLoading: false, mutate: jest.fn() } as any);

    const { result } = renderHook(() => useQuestionnaires());

    expect(result.current.error).toBe(error);
  });
});

// ── useDeleteQuestionnaire — devMode ─────────────────────────────────────────

describe('useDeleteQuestionnaire (devMode)', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUseConfig.mockReturnValue({ devMode: true } as Config);
  });

  it('removes the questionnaire from localStorage', async () => {
    const questionnaires = [
      { resourceType: 'Questionnaire', id: 'keep-me', title: 'Keep', status: 'active' as const },
      { resourceType: 'Questionnaire', id: 'delete-me', title: 'Delete', status: 'draft' as const },
    ];
    localStorage.setItem('clinomix:questionnaires', JSON.stringify(questionnaires));

    const { result } = renderHook(() => useDeleteQuestionnaire());

    await act(async () => {
      await result.current('delete-me');
    });

    const remaining = JSON.parse(localStorage.getItem('clinomix:questionnaires') ?? '[]');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('keep-me');
  });
});

// ── useDeleteQuestionnaire — production mode ──────────────────────────────────

describe('useDeleteQuestionnaire (production mode)', () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue({ devMode: false } as Config);
    mockOpenmrsFetch.mockResolvedValue({ data: {} } as any);
  });

  it('calls DELETE endpoint with the questionnaire id', async () => {
    const { result } = renderHook(() => useDeleteQuestionnaire());

    await act(async () => {
      await result.current('q-abc');
    });

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      expect.stringContaining('/q-abc'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});

// ── useSaveQuestionnaire — devMode ───────────────────────────────────────────

describe('useSaveQuestionnaire (devMode)', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUseConfig.mockReturnValue({ devMode: true } as Config);
  });

  it('adds a new questionnaire to localStorage', async () => {
    const { result } = renderHook(() => useSaveQuestionnaire());

    const form = { resourceType: 'Questionnaire' as const, title: 'New Form', status: 'draft' as const };

    await act(async () => {
      await result.current(form, { isEditing: false });
    });

    const stored = JSON.parse(localStorage.getItem('clinomix:questionnaires') ?? '[]');
    const added = stored.find((q: any) => q.title === 'New Form');
    expect(added).toBeTruthy();
    expect(added.id).toBeTruthy();
  });

  it('updates an existing questionnaire in localStorage', async () => {
    const original = {
      resourceType: 'Questionnaire' as const,
      id: 'existing-id',
      title: 'Old',
      status: 'draft' as const,
    };
    localStorage.setItem('clinomix:questionnaires', JSON.stringify([original]));

    const { result } = renderHook(() => useSaveQuestionnaire());
    const updated = { ...original, title: 'Updated' };

    await act(async () => {
      await result.current(updated, { isEditing: true, original });
    });

    const stored = JSON.parse(localStorage.getItem('clinomix:questionnaires') ?? '[]');
    expect(stored[0].title).toBe('Updated');
  });

  it('archives old version and bumps version when versionChoice is patch', async () => {
    const original = {
      resourceType: 'Questionnaire' as const,
      id: 'v-id',
      title: 'Form',
      version: '1.0.0',
      status: 'active' as const,
    };
    localStorage.setItem('clinomix:questionnaires', JSON.stringify([original]));

    const { result } = renderHook(() => useSaveQuestionnaire());

    await act(async () => {
      await result.current({ ...original }, { isEditing: true, original, versionChoice: 'patch' });
    });

    const stored = JSON.parse(localStorage.getItem('clinomix:questionnaires') ?? '[]');
    expect(stored[0].version).toBe('1.0.1');

    const history = JSON.parse(localStorage.getItem('clinomix:questionnaire-history') ?? '{}');
    expect(history['v-id']).toHaveLength(1);
    expect(history['v-id'][0].version).toBe('1.0.0');
  });
});
