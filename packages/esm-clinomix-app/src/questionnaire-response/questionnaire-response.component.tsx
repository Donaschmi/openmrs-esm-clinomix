import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, IconButton, InlineLoading, Layer, Search, Stack, Tag, Tile } from '@carbon/react';
import { ArrowLeft, CheckmarkFilled, Close } from '@carbon/react/icons';
import { showSnackbar, useSession } from '@openmrs/esm-framework';
import { type FhirQuestionnaire, type FhirQuestionnaireItem } from '@/questionnaire/questionnaire.resource';
import {
  type FhirQuestionnaireResponse,
  type PatientSearchResult,
  type QuestionnaireResponseAnswer,
  type QuestionnaireResponseItem,
  useSaveResponse,
  usePatientSearch,
} from './questionnaire-response.resource';
import QuestionnaireResponseItemComponent from './questionnaire-response-item.component';
import styles from './questionnaire-response.scss';

// ── Helpers ──────────────────────────────────────────────────────────────────

function collectRequiredLinkIds(items: FhirQuestionnaireItem[]): string[] {
  const ids: string[] = [];
  for (const item of items) {
    if (item.required && item.type !== 'display' && item.type !== 'group') {
      ids.push(item.linkId);
    }
    if (item.item) ids.push(...collectRequiredLinkIds(item.item));
  }
  return ids;
}

function buildResponseItems(
  items: FhirQuestionnaireItem[],
  answers: Record<string, QuestionnaireResponseAnswer>,
): QuestionnaireResponseItem[] {
  return items
    .filter((item) => item.type !== 'display')
    .map((item) => {
      if (item.type === 'group') {
        return {
          linkId: item.linkId,
          text: item.text,
          item: item.item ? buildResponseItems(item.item, answers) : [],
        };
      }
      const answer = answers[item.linkId];
      return { linkId: item.linkId, text: item.text, answer: answer ? [answer] : [] };
    });
}

// ── Patient search field ──────────────────────────────────────────────────────

interface PatientSearchFieldProps {
  selected: PatientSearchResult | null;
  onSelect: (patient: PatientSearchResult) => void;
  onClear: () => void;
}

const PatientSearchField: React.FC<PatientSearchFieldProps> = ({ selected, onSelect, onClear }) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const { patients, isLoading } = usePatientSearch(query);

  if (selected) {
    return (
      <div className={styles.selectedPatient}>
        <span className={styles.selectedPatientName}>{selected.display}</span>
        <IconButton label={t('clearPatient', 'Clear patient')} kind="ghost" size="sm" onClick={onClear}>
          <Close />
        </IconButton>
      </div>
    );
  }

  return (
    <div className={styles.patientSearchContainer}>
      <Search
        id="patient-search"
        labelText={t('searchPatient', 'Search patient by name or ID')}
        placeholder={t('searchPatient', 'Search patient by name or ID')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        size="md"
      />
      {query.trim().length >= 2 && (
        <Layer>
          <Tile className={styles.searchResults}>
            {isLoading && <InlineLoading description={t('searching', 'Searching...')} />}
            {!isLoading && patients.length === 0 && (
              <p className={styles.noResults}>{t('noPatients', 'No patients found')}</p>
            )}
            {patients.map((patient) => (
              <button
                key={patient.uuid}
                type="button"
                className={styles.searchResultItem}
                onClick={() => {
                  onSelect(patient);
                  setQuery('');
                }}
              >
                {patient.display}
              </button>
            ))}
          </Tile>
        </Layer>
      )}
    </div>
  );
};

// ── Main form ────────────────────────────────────────────────────────────────

interface QuestionnaireResponseFormProps {
  questionnaire: FhirQuestionnaire;
  onBack: () => void;
}

const QuestionnaireResponseForm: React.FC<QuestionnaireResponseFormProps> = ({ questionnaire, onBack }) => {
  const { t } = useTranslation();
  const saveResponse = useSaveResponse();
  const session = useSession();

  const [answers, setAnswers] = useState<Record<string, QuestionnaireResponseAnswer>>({});
  const [errors, setErrors] = useState<Set<string>>(new Set());
  const [patient, setPatient] = useState<PatientSearchResult | null>(null);

  const handleAnswer = useCallback((linkId: string, answer: QuestionnaireResponseAnswer | null) => {
    setAnswers((prev) => {
      if (answer === null) {
        const next = { ...prev };
        delete next[linkId];
        return next;
      }
      return { ...prev, [linkId]: answer };
    });
    setErrors((prev) => {
      const next = new Set(prev);
      next.delete(linkId);
      return next;
    });
  }, []);

  const buildAndSave = async (status: 'completed' | 'in-progress') => {
    if (status === 'completed') {
      const missing = collectRequiredLinkIds(questionnaire.item ?? []).filter((id) => !answers[id]);
      if (missing.length > 0) {
        setErrors(new Set(missing));
        return;
      }
    }

    const response: FhirQuestionnaireResponse = {
      resourceType: 'QuestionnaireResponse',
      questionnaire: questionnaire.url ?? `Questionnaire/${questionnaire.id}`,
      status,
      subject: patient ? { reference: `Patient/${patient.uuid}`, display: patient.display } : undefined,
      author: session?.user
        ? { reference: `Practitioner/${session.user.uuid}`, display: session.user.display }
        : undefined,
      authored: new Date().toISOString(),
      item: buildResponseItems(questionnaire.item ?? [], answers),
    };

    try {
      await saveResponse(response);
      showSnackbar({
        kind: 'success',
        title: status === 'completed' ? t('submitted', 'Submitted') : t('savedDraft', 'Saved as draft'),
        subtitle:
          status === 'completed'
            ? t('responseSubmitted', 'Response submitted successfully')
            : t('responseSavedDraft', 'Response saved as draft'),
      });
      onBack();
    } catch (err) {
      showSnackbar({
        kind: 'error',
        title: t('error', 'Error'),
        subtitle: err instanceof Error ? err.message : t('saveFailed', 'Failed to save response'),
      });
    }
  };

  return (
    <div className={styles.container}>
      {/* ── Top bar ──────────────────────────────────────────── */}
      <div className={styles.topBar}>
        <Button kind="ghost" renderIcon={ArrowLeft} onClick={onBack}>
          {t('back', 'Back')}
        </Button>
        <div className={styles.topBarTitle}>
          <h2 className={styles.pageTitle}>{questionnaire.title ?? t('questionnaire', 'Questionnaire')}</h2>
          <Tag type="blue">{t('respond', 'Respond')}</Tag>
        </div>
        <div className={styles.topBarActions}>
          <Button kind="secondary" onClick={() => buildAndSave('in-progress')}>
            {t('saveAsDraft', 'Save as draft')}
          </Button>
          <Button kind="primary" renderIcon={CheckmarkFilled} onClick={() => buildAndSave('completed')}>
            {t('submit', 'Submit')}
          </Button>
        </div>
      </div>

      <div className={styles.body}>
        <Stack gap={7}>
          {/* ── Author banner ─────────────────────────────────── */}
          {session?.user && (
            <div className={styles.authorBanner}>
              <span className={styles.authorLabel}>{t('author', 'Author')}</span>
              <strong>{session.user.display}</strong>
            </div>
          )}

          {/* ── Patient lookup ────────────────────────────────── */}
          <section>
            <h3 className={styles.sectionTitle}>{t('patient', 'Patient')}</h3>
            <PatientSearchField selected={patient} onSelect={setPatient} onClear={() => setPatient(null)} />
          </section>

          {/* ── Questions ─────────────────────────────────────── */}
          <section>
            <h3 className={styles.sectionTitle}>{t('questions', 'Questions')}</h3>
            {questionnaire.item && questionnaire.item.length > 0 ? (
              <Stack gap={6}>
                {questionnaire.item.map((item) => (
                  <QuestionnaireResponseItemComponent
                    key={item.linkId}
                    item={item}
                    answers={answers}
                    errors={errors}
                    onChange={handleAnswer}
                  />
                ))}
              </Stack>
            ) : (
              <Tile>
                <p>{t('noItems', 'This questionnaire has no questions.')}</p>
              </Tile>
            )}
          </section>
        </Stack>
      </div>
    </div>
  );
};

export default QuestionnaireResponseForm;
