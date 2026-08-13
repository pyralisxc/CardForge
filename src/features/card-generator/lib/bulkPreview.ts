import { nanoid } from 'nanoid';

import type { CardData, CardSet } from '@/domain/cards';
import type { DisplayCard } from '@/domain/rendering';
import {
  buildFieldStyleDataKey,
  buildImageFieldOverrideDataKey,
  isRecognizedFieldStyleColumn,
  isRecognizedImageFieldOverrideColumn,
  parseFieldStyleColumnHeader,
  parseImageFieldOverrideColumnHeader,
} from '@/domain/rendering';
import type { TCGCardTemplate, TemplateFieldDefinition } from '@/domain/templates';
import { validateCardDataAgainstFieldContracts } from '@/domain/templates';
import { completeCardDataWithTemplateDefaults } from '@/features/card-generator/lib/cardDataDefaults';
import {
  createBulkFaceFieldDefinitions,
  getBackingTemplateFieldKey,
  isBackingBulkFieldKey,
  normalizeCsvHeaders,
  type BulkPreviewRow,
  type BulkPreviewResult,
  type CreateBulkPreviewOptions,
} from '@/features/card-generator/lib/bulkContracts';

export const createBulkPreview = ({
  rows: parsedRows,
  columnMapping,
  fieldDefinitions,
  previewOverrides = {},
  maxPreviewRows = 5,
}: CreateBulkPreviewOptions): BulkPreviewResult => {
  if (parsedRows.length < 2) {
    return { rows: [], globalWarnings: [] };
  }

  const headers = normalizeCsvHeaders(parsedRows[0]);
  const fieldKeySet = new Set(fieldDefinitions.map((field) => field.key));
  const unmappedHeaders = headers.filter((header) => (
    !columnMapping[header]
    && !isRecognizedFieldStyleColumn(header, fieldKeySet)
    && !isRecognizedImageFieldOverrideColumn(header, fieldKeySet)
  ));
  const globalWarnings: string[] = [];

  if (unmappedHeaders.length > 0) {
    globalWarnings.push(`Unmapped CSV columns will be skipped: ${unmappedHeaders.join(', ')}`);
  }

  const requiredFieldKeys = fieldDefinitions.filter((field) => field.required).map((field) => field.key);
  const mappedFieldKeys = new Set(
    Object.values(columnMapping)
      .map((value) => value?.trim())
      .filter((value): value is string => !!value)
  );
  const unmappedRequiredFields = requiredFieldKeys.filter((key) => !mappedFieldKeys.has(key));
  if (unmappedRequiredFields.length > 0) {
    globalWarnings.push(`Required template fields are not mapped: ${unmappedRequiredFields.join(', ')}`);
  }

  const duplicateRequiredFields = requiredFieldKeys.filter((key) => (
    Object.values(columnMapping).filter((mappedKey) => mappedKey === key).length > 1
  ));
  if (duplicateRequiredFields.length > 0) {
    globalWarnings.push(`Required fields mapped multiple times: ${duplicateRequiredFields.join(', ')}`);
  }

  const requiredFieldSet = new Set(requiredFieldKeys);
  const previewRows: BulkPreviewRow[] = [];
  const previewCount = Math.min(parsedRows.length - 1, maxPreviewRows);

  for (let i = 1; i <= previewCount; i += 1) {
    const values = parsedRows[i] || [];
    const mappedData: Record<string, string> = {};
    const missingRequiredKeys: string[] = [];
    const warnings: string[] = [];
    const rowNumber = i + 1;
    const rowOverrides = previewOverrides[rowNumber] || {};

    headers.forEach((header, index) => {
      const mappedKey = columnMapping[header] || '';
      if (!mappedKey) return;
      const value = String(rowOverrides[mappedKey] ?? values[index] ?? '');
      mappedData[mappedKey] = value;
      if (requiredFieldSet.has(mappedKey) && value.trim() === '') {
        missingRequiredKeys.push(mappedKey);
        warnings.push(`Missing value for ${mappedKey}`);
      }
    });

    warnings.push(...validateCardDataAgainstFieldContracts(fieldDefinitions, mappedData).warnings);

    previewRows.push({
      rowNumber,
      mappedData,
      missingRequiredKeys,
      warnings,
    });
  }

  return { rows: previewRows, globalWarnings };
};

export interface CreateBulkDisplayCardsOptions {
  template: TCGCardTemplate;
  backingTemplate?: TCGCardTemplate | null;
  activeCardSet?: CardSet;
  fieldDefinitions: TemplateFieldDefinition[];
  backingFieldDefinitions?: TemplateFieldDefinition[];
  rows: string[][];
  columnMapping: Record<string, string>;
  previewOverrides?: Record<number, Record<string, string>>;
  createId?: (rowNumber: number) => string;
}

export const createBulkDisplayCards = ({
  template,
  backingTemplate = null,
  activeCardSet,
  fieldDefinitions,
  backingFieldDefinitions = [],
  rows,
  columnMapping,
  previewOverrides = {},
  createId = () => nanoid(),
}: CreateBulkDisplayCardsOptions): DisplayCard[] => {
  if (rows.length < 2) return [];

  const headers = normalizeCsvHeaders(rows[0]);
  const generatedCards: DisplayCard[] = [];
  const bulkFieldDefinitions = createBulkFaceFieldDefinitions(fieldDefinitions, backingFieldDefinitions);
  const fieldKeySet = new Set(bulkFieldDefinitions.map((field) => field.key));

  for (let i = 1; i < rows.length; i += 1) {
    const values = rows[i];
    const cardData: CardData = {};
    const backingData: CardData = {};

    const assignMappedValue = (mappedKey: string, value: string | number) => {
      if (isBackingBulkFieldKey(mappedKey)) {
        backingData[getBackingTemplateFieldKey(mappedKey)] = value;
      } else {
        cardData[mappedKey] = value;
      }
    };

    headers.forEach((header: string, index: number) => {
      const mappedKey = columnMapping[header] || '';
      if (mappedKey) {
        assignMappedValue(mappedKey, values[index] ?? '');
        return;
      }

      const styleColumn = parseFieldStyleColumnHeader(header, fieldKeySet);
      const imageColumn = styleColumn ? null : parseImageFieldOverrideColumnHeader(header, fieldKeySet);
      if (!styleColumn && !imageColumn) return;

      const value = values[index] ?? '';
      if (String(value).trim() && styleColumn) {
        const target = isBackingBulkFieldKey(styleColumn.fieldKey) ? backingData : cardData;
        target[buildFieldStyleDataKey(getBackingTemplateFieldKey(styleColumn.fieldKey), styleColumn.property)] = value;
        return;
      }
      if (String(value).trim() && imageColumn) {
        const target = isBackingBulkFieldKey(imageColumn.fieldKey) ? backingData : cardData;
        target[buildImageFieldOverrideDataKey(getBackingTemplateFieldKey(imageColumn.fieldKey), imageColumn.property)] = value;
      }
    });

    const rowNumber = i + 1;
    const rowOverrides = previewOverrides[rowNumber];
    if (rowOverrides) {
      Object.entries(rowOverrides).forEach(([key, value]) => {
        assignMappedValue(key, value);
      });
    }

    generatedCards.push({
      template,
      backingTemplate,
      backingTemplateId: backingTemplate?.id ?? null,
      setId: activeCardSet?.id,
      setName: activeCardSet?.name,
      data: completeCardDataWithTemplateDefaults(fieldDefinitions, cardData),
      backingData: backingTemplate
        ? completeCardDataWithTemplateDefaults(backingFieldDefinitions, backingData)
        : undefined,
      uniqueId: createId(rowNumber),
    });
  }

  return generatedCards;
};
