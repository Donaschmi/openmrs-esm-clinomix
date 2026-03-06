import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, IconButton, Select, SelectItem, Stack, Tag, TextInput, Tile, Toggle } from '@carbon/react';
import { Add, ChevronDown, ChevronUp, TrashCan } from '@carbon/react/icons';
import { type FhirQuestionnaireItem, type QuestionnaireItemType } from '../questionnaire.resource';
import styles from './questionnaire-form.scss';

interface QuestionnaireItemCardProps {
  item: FhirQuestionnaireItem;
  index: number;
  /** Dot-path for unique element IDs, e.g. "0", "0.1", "0.1.2" */
  idPrefix?: string;
  onChange: (updated: FhirQuestionnaireItem) => void;
  onRemove: () => void;
}

const ITEM_TYPES: { value: QuestionnaireItemType; label: string }[] = [
  { value: 'group', label: 'Group' },
  { value: 'display', label: 'Display' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'decimal', label: 'Decimal' },
  { value: 'integer', label: 'Integer' },
  { value: 'date', label: 'Date' },
  { value: 'dateTime', label: 'Date & Time' },
  { value: 'time', label: 'Time' },
  { value: 'string', label: 'Short text' },
  { value: 'text', label: 'Long text' },
  { value: 'url', label: 'URL' },
  { value: 'choice', label: 'Choice' },
  { value: 'open-choice', label: 'Open choice' },
  { value: 'attachment', label: 'Attachment' },
  { value: 'reference', label: 'Reference' },
  { value: 'quantity', label: 'Quantity' },
];

const CHOICE_TYPES: QuestionnaireItemType[] = ['choice', 'open-choice'];

// ── Shared field editors ──────────────────────────────────────────────────────

interface CommonFieldsProps {
  item: FhirQuestionnaireItem;
  idPrefix: string;
  onChange: (updated: FhirQuestionnaireItem) => void;
}

const CommonFields: React.FC<CommonFieldsProps> = ({ item, idPrefix, onChange }) => {
  const { t } = useTranslation();
  const set = <K extends keyof FhirQuestionnaireItem>(field: K, value: FhirQuestionnaireItem[K]) =>
    onChange({ ...item, [field]: value });

  return (
    <>
      <div className={styles.row}>
        <TextInput
          id={`${idPrefix}-linkId`}
          labelText={t('linkId', 'Link ID')}
          value={item.linkId}
          onChange={(e) => set('linkId', e.target.value)}
          size="sm"
        />
        <Select
          id={`${idPrefix}-type`}
          labelText={t('type', 'Type')}
          value={item.type}
          onChange={(e) => set('type', e.target.value as QuestionnaireItemType)}
          size="sm"
        >
          {ITEM_TYPES.map((itemType) => (
            <SelectItem key={itemType.value} value={itemType.value} text={itemType.label} />
          ))}
        </Select>
      </div>

      <TextInput
        id={`${idPrefix}-text`}
        labelText={item.type === 'group' ? t('groupLabel', 'Group label') : t('questionText', 'Question text')}
        value={item.text ?? ''}
        onChange={(e) => set('text', e.target.value)}
        size="sm"
      />

      {item.type !== 'group' && (
        <TextInput
          id={`${idPrefix}-prefix`}
          labelText={t('prefix', 'Prefix')}
          helperText={t('prefixHelper', 'E.g. "1." or "a)"')}
          value={item.prefix ?? ''}
          onChange={(e) => set('prefix', e.target.value)}
          size="sm"
        />
      )}
    </>
  );
};

// ── Group card ────────────────────────────────────────────────────────────────

const GroupCard: React.FC<QuestionnaireItemCardProps & { idPrefix: string }> = ({
  item,
  index,
  idPrefix,
  onChange,
  onRemove,
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);

  const addChild = () => {
    const children = item.item ?? [];
    const child: FhirQuestionnaireItem = {
      linkId: `${item.linkId}-item-${children.length + 1}`,
      type: 'string',
      text: '',
    };
    onChange({ ...item, item: [...children, child] });
  };

  const updateChild = (ci: number, updated: FhirQuestionnaireItem) => {
    const children = [...(item.item ?? [])];
    children[ci] = updated;
    onChange({ ...item, item: children });
  };

  const removeChild = (ci: number) => {
    const children = [...(item.item ?? [])];
    children.splice(ci, 1);
    onChange({ ...item, item: children });
  };

  return (
    <div className={styles.groupCard}>
      {/* ── Group header ── */}
      <div className={styles.groupCardHeader}>
        <div className={styles.itemCardTitle}>
          <span className={styles.itemIndex}>#{index + 1}</span>
          <Tag type="purple" size="sm">
            {t('group', 'Group')}
          </Tag>
          <span className={styles.itemText}>{item.text || t('untitledGroup', 'Untitled group')}</span>
          <Tag type="cool-gray" size="sm">
            {item.item?.length ?? 0} {t('items', 'items')}
          </Tag>
        </div>
        <div className={styles.itemCardActions}>
          <IconButton
            label={expanded ? t('collapse', 'Collapse') : t('expand', 'Expand')}
            kind="ghost"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronUp /> : <ChevronDown />}
          </IconButton>
          <IconButton label={t('removeGroup', 'Remove group')} kind="ghost" size="sm" onClick={onRemove}>
            <TrashCan />
          </IconButton>
        </div>
      </div>

      {expanded && (
        <div className={styles.groupCardBody}>
          <Stack gap={4}>
            {/* ── Group-level fields ── */}
            <CommonFields item={item} idPrefix={idPrefix} onChange={onChange} />

            {/* ── Children ── */}
            <div className={styles.groupChildren}>
              <p className={styles.groupChildrenLabel}>{t('groupItems', 'Items in this group')}</p>
              <Stack gap={3}>
                {item.item && item.item.length > 0 ? (
                  item.item.map((child, ci) => (
                    <QuestionnaireItemCard
                      key={`${idPrefix}.${ci}`}
                      item={child}
                      index={ci}
                      idPrefix={`${idPrefix}.${ci}`}
                      onChange={(updated) => updateChild(ci, updated)}
                      onRemove={() => removeChild(ci)}
                    />
                  ))
                ) : (
                  <p className={styles.groupEmptyHint}>{t('groupEmpty', 'No items yet — add one below.')}</p>
                )}
              </Stack>
              <Button kind="ghost" renderIcon={Add} size="sm" className={styles.addChildButton} onClick={addChild}>
                {t('addItemToGroup', 'Add item to group')}
              </Button>
            </div>
          </Stack>
        </div>
      )}
    </div>
  );
};

// ── Regular (non-group) card ──────────────────────────────────────────────────

const RegularCard: React.FC<QuestionnaireItemCardProps & { idPrefix: string }> = ({
  item,
  index,
  idPrefix,
  onChange,
  onRemove,
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);

  const set = <K extends keyof FhirQuestionnaireItem>(field: K, value: FhirQuestionnaireItem[K]) =>
    onChange({ ...item, [field]: value });

  const addAnswerOption = () =>
    onChange({ ...item, answerOption: [...(item.answerOption ?? []), { valueString: '' }] });

  const updateAnswerOption = (i: number, value: string) => {
    const options = [...(item.answerOption ?? [])];
    options[i] = { valueString: value };
    onChange({ ...item, answerOption: options });
  };

  const removeAnswerOption = (i: number) => {
    const options = [...(item.answerOption ?? [])];
    options.splice(i, 1);
    onChange({ ...item, answerOption: options });
  };

  return (
    <Tile className={styles.itemCard}>
      <div className={styles.itemCardHeader}>
        <div className={styles.itemCardTitle}>
          <span className={styles.itemIndex}>#{index + 1}</span>
          <Tag type="blue" size="sm">
            {item.type}
          </Tag>
          <span className={styles.itemText}>{item.text || t('untitled', 'Untitled')}</span>
          {item.required && (
            <Tag type="red" size="sm">
              {t('required', 'Required')}
            </Tag>
          )}
        </div>
        <div className={styles.itemCardActions}>
          <IconButton
            label={expanded ? t('collapse', 'Collapse') : t('expand', 'Expand')}
            kind="ghost"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronUp /> : <ChevronDown />}
          </IconButton>
          <IconButton label={t('removeItem', 'Remove item')} kind="ghost" size="sm" onClick={onRemove}>
            <TrashCan />
          </IconButton>
        </div>
      </div>

      {expanded && (
        <div className={styles.itemCardBody}>
          <Stack gap={4}>
            <CommonFields item={item} idPrefix={idPrefix} onChange={onChange} />

            <div className={styles.toggleRow}>
              <Toggle
                id={`${idPrefix}-required`}
                labelText={t('required', 'Required')}
                labelA={t('no', 'No')}
                labelB={t('yes', 'Yes')}
                size="sm"
                toggled={item.required ?? false}
                onToggle={(checked) => set('required', checked)}
              />
              <Toggle
                id={`${idPrefix}-repeats`}
                labelText={t('repeats', 'Repeats')}
                labelA={t('no', 'No')}
                labelB={t('yes', 'Yes')}
                size="sm"
                toggled={item.repeats ?? false}
                onToggle={(checked) => set('repeats', checked)}
              />
              <Toggle
                id={`${idPrefix}-readOnly`}
                labelText={t('readOnly', 'Read only')}
                labelA={t('no', 'No')}
                labelB={t('yes', 'Yes')}
                size="sm"
                toggled={item.readOnly ?? false}
                onToggle={(checked) => set('readOnly', checked)}
              />
            </div>

            {CHOICE_TYPES.includes(item.type) && (
              <div className={styles.answerOptions}>
                <p className={styles.answerOptionsLabel}>{t('answerOptions', 'Answer options')}</p>
                <Stack gap={2}>
                  {item.answerOption?.map((opt, i) => (
                    <div key={i} className={styles.answerOptionRow}>
                      <TextInput
                        id={`${idPrefix}-option-${i}`}
                        labelText=""
                        hideLabel
                        value={opt.valueString ?? ''}
                        placeholder={t('optionText', 'Option text')}
                        onChange={(e) => updateAnswerOption(i, e.target.value)}
                        size="sm"
                      />
                      <IconButton
                        label={t('removeOption', 'Remove option')}
                        kind="ghost"
                        size="sm"
                        onClick={() => removeAnswerOption(i)}
                      >
                        <TrashCan />
                      </IconButton>
                    </div>
                  ))}
                  <Button kind="ghost" renderIcon={Add} size="sm" onClick={addAnswerOption}>
                    {t('addOption', 'Add option')}
                  </Button>
                </Stack>
              </div>
            )}
          </Stack>
        </div>
      )}
    </Tile>
  );
};

// ── Main export — routes to GroupCard or RegularCard ─────────────────────────

const QuestionnaireItemCard: React.FC<QuestionnaireItemCardProps> = ({ item, index, idPrefix, onChange, onRemove }) => {
  const prefix = idPrefix ?? String(index);

  if (item.type === 'group') {
    return <GroupCard item={item} index={index} idPrefix={prefix} onChange={onChange} onRemove={onRemove} />;
  }

  return <RegularCard item={item} index={index} idPrefix={prefix} onChange={onChange} onRemove={onRemove} />;
};

export default QuestionnaireItemCard;
