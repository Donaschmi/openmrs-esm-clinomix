import React from 'react';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useConfig } from '@openmrs/esm-framework';
import { useQuestionnaires, useImportQuestionnaires, useDeleteQuestionnaire } from './questionnaire.resource';
import type { Config } from '../config-schema';
import QuestionnaireList from './questionnaire-list.component';

jest.mock('./questionnaire.resource', () => ({
  useQuestionnaires: jest.fn(),
  useImportQuestionnaires: jest.fn(),
  useDeleteQuestionnaire: jest.fn(),
}));

jest.mock('./fhir-xml.parser', () => ({
  isXmlFile: jest.fn().mockReturnValue(false),
  parseFhirXml: jest.fn(),
}));

const mockUseConfig = jest.mocked(useConfig<Config>);
const mockUseQuestionnaires = jest.mocked(useQuestionnaires);
const mockUseImportQuestionnaires = jest.mocked(useImportQuestionnaires);
const mockUseDeleteQuestionnaire = jest.mocked(useDeleteQuestionnaire);

const SAMPLE_QUESTIONNAIRES = [
  {
    resourceType: 'Questionnaire' as const,
    id: 'q-1',
    title: 'Patient Intake Form',
    name: 'PatientIntake',
    status: 'active' as const,
    publisher: 'ClinomX',
    date: '2024-01-01T00:00:00Z',
  },
  {
    resourceType: 'Questionnaire' as const,
    id: 'q-2',
    title: 'PHQ-9 Depression Screening',
    name: 'PHQ9',
    status: 'draft' as const,
    publisher: 'ClinomX',
    date: '2024-06-01T00:00:00Z',
  },
  {
    resourceType: 'Questionnaire' as const,
    id: 'q-3',
    title: 'Antenatal Assessment',
    name: 'Antenatal',
    status: 'retired' as const,
    publisher: 'WHO',
    date: '2023-01-01T00:00:00Z',
  },
];

const defaultProps = {
  onNew: jest.fn(),
  onEdit: jest.fn(),
  onView: jest.fn(),
  onRespond: jest.fn(),
  onDuplicate: jest.fn(),
};

function setup(props = defaultProps) {
  mockUseConfig.mockReturnValue({ devMode: false } as Config);
  mockUseImportQuestionnaires.mockReturnValue(jest.fn().mockResolvedValue({ added: 0, updated: 0 }));
  mockUseDeleteQuestionnaire.mockReturnValue(jest.fn().mockResolvedValue(undefined));

  return render(<QuestionnaireList {...props} />);
}

// ── Loading state ─────────────────────────────────────────────────────────────

describe('loading state', () => {
  it('renders a skeleton while loading', () => {
    mockUseQuestionnaires.mockReturnValue({
      questionnaires: [],
      total: 0,
      isLoading: true,
      error: null,
      mutate: jest.fn(),
    });

    setup();

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});

// ── Error state ───────────────────────────────────────────────────────────────

describe('error state', () => {
  it('renders an error message when loading fails', () => {
    mockUseQuestionnaires.mockReturnValue({
      questionnaires: [],
      total: 0,
      isLoading: false,
      error: new Error('Server error'),
      mutate: jest.fn(),
    });

    setup();

    expect(screen.getByText(/error loading questionnaires/i)).toBeInTheDocument();
  });
});

// ── Questionnaire table ───────────────────────────────────────────────────────

describe('questionnaire table', () => {
  beforeEach(() => {
    mockUseQuestionnaires.mockReturnValue({
      questionnaires: SAMPLE_QUESTIONNAIRES,
      total: SAMPLE_QUESTIONNAIRES.length,
      isLoading: false,
      error: null,
      mutate: jest.fn(),
    });
  });

  it('renders column headers', () => {
    setup();

    expect(screen.getByRole('columnheader', { name: /title/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /name/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /status/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /publisher/i })).toBeInTheDocument();
  });

  it('renders all questionnaire rows', () => {
    setup();

    expect(screen.getByText('Patient Intake Form')).toBeInTheDocument();
    expect(screen.getByText('PHQ-9 Depression Screening')).toBeInTheDocument();
    expect(screen.getByText('Antenatal Assessment')).toBeInTheDocument();
  });

  it('renders status tags', () => {
    setup();

    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('draft')).toBeInTheDocument();
    expect(screen.getByText('retired')).toBeInTheDocument();
  });
});

// ── Toolbar actions ───────────────────────────────────────────────────────────

describe('toolbar actions', () => {
  beforeEach(() => {
    mockUseQuestionnaires.mockReturnValue({
      questionnaires: SAMPLE_QUESTIONNAIRES,
      total: SAMPLE_QUESTIONNAIRES.length,
      isLoading: false,
      error: null,
      mutate: jest.fn(),
    });
  });

  it('calls onNew when New questionnaire button is clicked', async () => {
    const onNew = jest.fn();
    setup({ ...defaultProps, onNew });

    await userEvent.click(screen.getByRole('button', { name: /new questionnaire/i }));

    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it('renders Import button', () => {
    setup();

    expect(screen.getByRole('button', { name: /import/i })).toBeInTheDocument();
  });
});

// ── Search filtering ──────────────────────────────────────────────────────────

describe('search filtering', () => {
  beforeEach(() => {
    mockUseQuestionnaires.mockReturnValue({
      questionnaires: SAMPLE_QUESTIONNAIRES,
      total: SAMPLE_QUESTIONNAIRES.length,
      isLoading: false,
      error: null,
      mutate: jest.fn(),
    });
  });

  it('filters rows by title when user types in the search box', async () => {
    setup();

    const searchInput = screen.getByPlaceholderText(/search questionnaires/i);
    await userEvent.type(searchInput, 'PHQ');

    expect(screen.getByText('PHQ-9 Depression Screening')).toBeInTheDocument();
    expect(screen.queryByText('Patient Intake Form')).not.toBeInTheDocument();
    expect(screen.queryByText('Antenatal Assessment')).not.toBeInTheDocument();
  });

  it('is case-insensitive', async () => {
    setup();

    const searchInput = screen.getByPlaceholderText(/search questionnaires/i);
    await userEvent.type(searchInput, 'patient intake');

    expect(screen.getByText('Patient Intake Form')).toBeInTheDocument();
  });

  it('shows all rows when search is cleared', async () => {
    setup();

    const searchInput = screen.getByPlaceholderText(/search questionnaires/i);
    await userEvent.type(searchInput, 'PHQ');
    await userEvent.clear(searchInput);

    expect(screen.getByText('Patient Intake Form')).toBeInTheDocument();
    expect(screen.getByText('PHQ-9 Depression Screening')).toBeInTheDocument();
    expect(screen.getByText('Antenatal Assessment')).toBeInTheDocument();
  });
});

// ── Delete confirmation modal ─────────────────────────────────────────────────

describe('delete modal', () => {
  it('renders the delete modal heading', () => {
    mockUseQuestionnaires.mockReturnValue({
      questionnaires: SAMPLE_QUESTIONNAIRES,
      total: SAMPLE_QUESTIONNAIRES.length,
      isLoading: false,
      error: null,
      mutate: jest.fn(),
    });

    setup();

    // Carbon Modal renders content in the DOM at all times; heading should be present
    expect(screen.getByText(/delete questionnaire/i)).toBeInTheDocument();
  });
});

// ── Empty state ───────────────────────────────────────────────────────────────

describe('empty questionnaire list', () => {
  it('renders an empty table with no rows when there are no questionnaires', () => {
    mockUseQuestionnaires.mockReturnValue({
      questionnaires: [],
      total: 0,
      isLoading: false,
      error: null,
      mutate: jest.fn(),
    });

    setup();

    // Table headers should still be present
    expect(screen.getByRole('columnheader', { name: /title/i })).toBeInTheDocument();
    // No data rows
    expect(screen.queryByText('Patient Intake Form')).not.toBeInTheDocument();
  });
});
