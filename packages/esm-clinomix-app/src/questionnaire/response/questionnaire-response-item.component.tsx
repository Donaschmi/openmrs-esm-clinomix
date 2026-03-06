import React from 'react';
import { useTranslation } from 'react-i18next';
import { ComboBox, RadioButton, RadioButtonGroup, Stack, TextArea, TextInput } from '@carbon/react';
import { type FhirQuestionnaireItem } from '../questionnaire.resource';
import { type QuestionnaireResponseAnswer } from './questionnaire-response.resource';
import styles from './questionnaire-response.scss';

interface QuestionnaireResponseItemProps {
  item: FhirQuestionnaireItem;
  answers: Record<string, QuestionnaireResponseAnswer>;
  errors: Set<string>;
  onChange: (linkId: string, answer: QuestionnaireResponseAnswer | null) => void;
}

const QuestionnaireResponseItem: React.FC<QuestionnaireResponseItemProps> = ({ item, answers, errors, onChange }) => {
  const { t } = useTranslation();
  const current = answers[item.linkId];
  const invalid = errors.has(item.linkId);
  const invalidText = t('fieldRequired', 'This field is required');

  const labelNode = (
    <span>
      {item.prefix && <span className={styles.prefix}>{item.prefix} </span>}
      {item.text}
      {item.required && <span className={styles.asterisk}> *</span>}
    </span>
  );

  // ── group ─────────────────────────────────────────────────────────────────
  if (item.type === 'group') {
    return (
      <div className={styles.group}>
        {item.text && <h4 className={styles.groupTitle}>{item.text}</h4>}
        <Stack gap={5}>
          {item.item?.map((child) => (
            <QuestionnaireResponseItem
              key={child.linkId}
              item={child}
              answers={answers}
              errors={errors}
              onChange={onChange}
            />
          ))}
        </Stack>
      </div>
    );
  }

  // ── display ───────────────────────────────────────────────────────────────
  if (item.type === 'display') {
    return <p className={styles.displayText}>{item.text}</p>;
  }

  // ── boolean ───────────────────────────────────────────────────────────────
  if (item.type === 'boolean') {
    const selected = current?.valueBoolean === true ? 'true' : current?.valueBoolean === false ? 'false' : '';
    return (
      <RadioButtonGroup
        legendText={labelNode}
        name={`q-${item.linkId}`}
        valueSelected={selected}
        onChange={(value: string) => onChange(item.linkId, { valueBoolean: value === 'true' })}
        invalid={invalid}
        invalidText={invalidText}
      >
        <RadioButton labelText={t('yes', 'Yes')} value="true" id={`${item.linkId}-yes`} />
        <RadioButton labelText={t('no', 'No')} value="false" id={`${item.linkId}-no`} />
      </RadioButtonGroup>
    );
  }

  // ── choice ────────────────────────────────────────────────────────────────
  if (item.type === 'choice' && item.answerOption?.length) {
    const selected = current?.valueCoding?.code ?? current?.valueString ?? '';
    return (
      <RadioButtonGroup
        legendText={labelNode}
        name={`q-${item.linkId}`}
        valueSelected={selected}
        onChange={(value: string) => {
          const opt = item.answerOption?.find((o) => (o.valueCoding?.code ?? o.valueString) === value);
          onChange(item.linkId, opt?.valueCoding ? { valueCoding: opt.valueCoding } : { valueString: value });
        }}
        invalid={invalid}
        invalidText={invalidText}
      >
        {item.answerOption.map((opt, i) => {
          const value = opt.valueCoding?.code ?? opt.valueString ?? String(i);
          const label = opt.valueCoding?.display ?? opt.valueString ?? value;
          return <RadioButton key={value} labelText={label} value={value} id={`${item.linkId}-${i}`} />;
        })}
      </RadioButtonGroup>
    );
  }

  // ── open-choice ───────────────────────────────────────────────────────────
  if (item.type === 'open-choice' && item.answerOption?.length) {
    const comboItems = item.answerOption.map((opt, i) => ({
      id: opt.valueCoding?.code ?? opt.valueString ?? String(i),
      label: opt.valueCoding?.display ?? opt.valueString ?? String(i),
    }));
    const selectedCombo =
      comboItems.find((ci) => ci.id === (current?.valueCoding?.code ?? current?.valueString)) ?? null;
    return (
      <ComboBox
        id={`q-${item.linkId}`}
        titleText={labelNode}
        items={comboItems}
        itemToString={(ci) => ci?.label ?? ''}
        selectedItem={selectedCombo}
        onChange={({ selectedItem }) => {
          if (selectedItem) onChange(item.linkId, { valueString: selectedItem.label });
          else onChange(item.linkId, null);
        }}
        onInputChange={(value) => {
          if (value && !comboItems.find((ci) => ci.label === value)) {
            onChange(item.linkId, { valueString: value });
          }
        }}
        invalid={invalid}
        invalidText={invalidText}
      />
    );
  }

  // ── text (long) ───────────────────────────────────────────────────────────
  if (item.type === 'text') {
    return (
      <TextArea
        id={`q-${item.linkId}`}
        labelText={labelNode}
        value={current?.valueString ?? ''}
        onChange={(e) => onChange(item.linkId, { valueString: e.target.value })}
        invalid={invalid}
        invalidText={invalidText}
        rows={3}
      />
    );
  }

  // ── all remaining scalar types → TextInput ────────────────────────────────
  const htmlTypeMap: Record<string, string> = {
    integer: 'number',
    decimal: 'number',
    date: 'date',
    dateTime: 'datetime-local',
    time: 'time',
    url: 'url',
    string: 'text',
    quantity: 'number',
    reference: 'text',
    attachment: 'text',
  };

  const getRawValue = (): string => {
    if (!current) return '';
    switch (item.type) {
      case 'integer':
        return current.valueInteger?.toString() ?? '';
      case 'decimal':
        return current.valueDecimal?.toString() ?? '';
      case 'date':
        return current.valueDate ?? '';
      case 'dateTime':
        return current.valueDateTime ?? '';
      case 'time':
        return current.valueTime ?? '';
      case 'url':
        return current.valueUri ?? '';
      case 'quantity':
        return current.valueQuantity?.value?.toString() ?? '';
      default:
        return current.valueString ?? '';
    }
  };

  const setRawValue = (raw: string) => {
    switch (item.type) {
      case 'integer':
        return onChange(item.linkId, { valueInteger: parseInt(raw, 10) });
      case 'decimal':
        return onChange(item.linkId, { valueDecimal: parseFloat(raw) });
      case 'date':
        return onChange(item.linkId, { valueDate: raw });
      case 'dateTime':
        return onChange(item.linkId, { valueDateTime: raw });
      case 'time':
        return onChange(item.linkId, { valueTime: raw });
      case 'url':
        return onChange(item.linkId, { valueUri: raw });
      case 'quantity':
        return onChange(item.linkId, { valueQuantity: { value: parseFloat(raw) } });
      default:
        return onChange(item.linkId, { valueString: raw });
    }
  };

  return (
    <TextInput
      id={`q-${item.linkId}`}
      labelText={labelNode}
      type={htmlTypeMap[item.type] ?? 'text'}
      value={getRawValue()}
      onChange={(e) => setRawValue(e.target.value)}
      invalid={invalid}
      invalidText={invalidText}
      step={item.type === 'decimal' ? 'any' : item.type === 'integer' ? '1' : undefined}
      maxLength={item.maxLength}
    />
  );
};

export default QuestionnaireResponseItem;
