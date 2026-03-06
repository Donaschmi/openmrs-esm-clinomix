import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Form, FormGroup, Select, SelectItem, Stack, TextArea, TextInput, Toggle } from '@carbon/react';
import { ArrowLeft, Add, GroupObjects } from '@carbon/react/icons';
import { showSnackbar } from '@openmrs/esm-framework';
import {
  type FhirQuestionnaire,
  type FhirQuestionnaireItem,
  devGetQuestionnaires,
  devSaveQuestionnaires,
} from '../questionnaire.resource';
import QuestionnaireItemCard from './questionnaire-item-card.component';
import styles from './questionnaire-form.scss';

const DEV_MODE = process.env.NODE_ENV === 'development';

interface QuestionnaireFormProps {
  questionnaire?: FhirQuestionnaire;
  onBack: () => void;
}

function emptyQuestionnaire(): Omit<FhirQuestionnaire, 'id'> {
  return {
    resourceType: 'Questionnaire',
    title: '',
    name: '',
    url: '',
    version: '1.0.0',
    status: 'draft',
    publisher: '',
    description: '',
    subjectType: ['Patient'],
    experimental: false,
    item: [],
  };
}

const QuestionnaireForm: React.FC<QuestionnaireFormProps> = ({ questionnaire, onBack }) => {
  const { t } = useTranslation();
  const isEditing = Boolean(questionnaire);

  const [form, setForm] = useState<Omit<FhirQuestionnaire, 'id'>>(questionnaire ?? emptyQuestionnaire());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (field: keyof Omit<FhirQuestionnaire, 'id'>, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!form.title?.trim()) next.title = t('titleRequired', 'Title is required');
    if (!form.status) next.status = t('statusRequired', 'Status is required');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;

    if (DEV_MODE) {
      const all = devGetQuestionnaires();
      if (isEditing && questionnaire) {
        devSaveQuestionnaires(all.map((q) => (q.id === questionnaire.id ? { ...form, id: questionnaire.id } : q)));
      } else {
        devSaveQuestionnaires([...all, { ...form, id: `q-${Date.now()}` }]);
      }
      showSnackbar({
        kind: 'success',
        title: t('saved', 'Saved'),
        subtitle: t('questionnaireSaved', 'Questionnaire saved successfully'),
      });
      onBack();
      return;
    }

    // TODO: call real API — POST /ws/fhir2/R4/Questionnaire (create) or PUT (update)
  };

  const addItem = () => {
    const newItem: FhirQuestionnaireItem = {
      linkId: `item-${(form.item?.length ?? 0) + 1}`,
      type: 'string',
      text: '',
    };
    set('item', [...(form.item ?? []), newItem]);
  };

  const addGroup = () => {
    const newGroup: FhirQuestionnaireItem = {
      linkId: `group-${(form.item?.length ?? 0) + 1}`,
      type: 'group',
      text: '',
      item: [],
    };
    set('item', [...(form.item ?? []), newGroup]);
  };

  const updateItem = (index: number, updated: FhirQuestionnaireItem) => {
    const items = [...(form.item ?? [])];
    items[index] = updated;
    set('item', items);
  };

  const removeItem = (index: number) => {
    const items = [...(form.item ?? [])];
    items.splice(index, 1);
    set('item', items);
  };

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <Button kind="ghost" renderIcon={ArrowLeft} onClick={onBack}>
          {t('back', 'Back')}
        </Button>
        <h2 className={styles.pageTitle}>
          {isEditing ? t('editQuestionnaire', 'Edit questionnaire') : t('newQuestionnaire', 'New questionnaire')}
        </h2>
      </div>

      <Form className={styles.form}>
        <Stack gap={7}>
          {/* ── Metadata ─────────────────────────────────────── */}
          <FormGroup legendText={t('metadata', 'Metadata')} className={styles.formGroup}>
            <Stack gap={5}>
              <TextInput
                id="q-title"
                labelText={t('title', 'Title')}
                value={form.title ?? ''}
                onChange={(e) => set('title', e.target.value)}
                invalid={Boolean(errors.title)}
                invalidText={errors.title}
                required
              />
              <TextInput
                id="q-name"
                labelText={t('name', 'Name')}
                helperText={t('nameHelper', 'Computer-friendly identifier — no spaces (e.g. PatientIntake)')}
                value={form.name ?? ''}
                onChange={(e) => set('name', e.target.value)}
              />
              <TextInput
                id="q-url"
                labelText={t('canonicalUrl', 'Canonical URL')}
                helperText={t('urlHelper', 'Globally unique identifier for this questionnaire')}
                value={form.url ?? ''}
                onChange={(e) => set('url', e.target.value)}
              />
              <div className={styles.row}>
                <TextInput
                  id="q-version"
                  labelText={t('version', 'Version')}
                  value={form.version ?? ''}
                  onChange={(e) => set('version', e.target.value)}
                />
                <Select
                  id="q-status"
                  labelText={t('status', 'Status')}
                  value={form.status}
                  onChange={(e) => set('status', e.target.value)}
                  invalid={Boolean(errors.status)}
                  invalidText={errors.status}
                >
                  <SelectItem value="draft" text={t('draft', 'Draft')} />
                  <SelectItem value="active" text={t('active', 'Active')} />
                  <SelectItem value="retired" text={t('retired', 'Retired')} />
                  <SelectItem value="unknown" text={t('unknown', 'Unknown')} />
                </Select>
              </div>
              <TextInput
                id="q-publisher"
                labelText={t('publisher', 'Publisher')}
                value={form.publisher ?? ''}
                onChange={(e) => set('publisher', e.target.value)}
              />
              <TextArea
                id="q-description"
                labelText={t('description', 'Description')}
                value={form.description ?? ''}
                onChange={(e) => set('description', e.target.value)}
                rows={3}
              />
              <Toggle
                id="q-experimental"
                labelText={t('experimental', 'Experimental')}
                labelA={t('no', 'No')}
                labelB={t('yes', 'Yes')}
                toggled={form.experimental ?? false}
                onToggle={(checked) => set('experimental', checked)}
              />
            </Stack>
          </FormGroup>

          {/* ── Items ────────────────────────────────────────── */}
          <FormGroup legendText={t('items', 'Items')} className={styles.formGroup}>
            <Stack gap={4}>
              {form.item?.map((item, index) => (
                <QuestionnaireItemCard
                  key={`${item.linkId}-${index}`}
                  item={item}
                  index={index}
                  onChange={(updated) => updateItem(index, updated)}
                  onRemove={() => removeItem(index)}
                />
              ))}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button kind="tertiary" renderIcon={Add} onClick={addItem}>
                  {t('addItem', 'Add item')}
                </Button>
                <Button kind="tertiary" renderIcon={GroupObjects} onClick={addGroup}>
                  {t('addGroup', 'Add group')}
                </Button>
              </div>
            </Stack>
          </FormGroup>
        </Stack>

        <div className={styles.actions}>
          <Button kind="secondary" onClick={onBack}>
            {t('cancel', 'Cancel')}
          </Button>
          <Button kind="primary" onClick={handleSave}>
            {t('save', 'Save')}
          </Button>
        </div>
      </Form>
    </div>
  );
};

export default QuestionnaireForm;
