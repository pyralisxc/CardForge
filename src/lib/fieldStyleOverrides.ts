import type { CardData, TCGCardTemplate } from '@/types';

export const FIELD_STYLE_DATA_PREFIX = '__cardforgeFieldStyle.';

export type FieldStyleProperty =
  | 'textColor'
  | 'fontSizePx'
  | 'fontWeight'
  | 'fontStyle'
  | 'textDecoration'
  | 'lineHeight'
  | 'letterSpacing';

export const FIELD_STYLE_PROPERTIES: FieldStyleProperty[] = [
  'textColor',
  'fontSizePx',
  'fontWeight',
  'fontStyle',
  'textDecoration',
  'lineHeight',
  'letterSpacing',
];

const fieldStyleProperties = new Set<FieldStyleProperty>(FIELD_STYLE_PROPERTIES);

const fontWeights = new Set(['font-normal', 'font-medium', 'font-semibold', 'font-bold']);
const fontStyles = new Set(['normal', 'italic']);
const textDecorations = new Set(['none', 'underline', 'line-through']);

type TemplateFieldContract = NonNullable<TCGCardTemplate['fieldContracts']>[number];

export interface ParsedFieldStyleColumn {
  fieldKey: string;
  property: FieldStyleProperty;
}

export const buildFieldStyleDataKey = (fieldKey: string, property: FieldStyleProperty): string =>
  `${FIELD_STYLE_DATA_PREFIX}${fieldKey}.${property}`;

const isFieldStyleProperty = (value: string): value is FieldStyleProperty =>
  fieldStyleProperties.has(value as FieldStyleProperty);

export const parseFieldStyleColumnHeader = (
  header: string,
  fieldKeys: Iterable<string>
): ParsedFieldStyleColumn | null => {
  const trimmed = header.trim();
  if (!trimmed) return null;

  const candidates = Array.from(fieldKeys)
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);

  for (const fieldKey of candidates) {
    const directPrefix = `${fieldKey}.`;
    const stylePrefix = `${fieldKey}.style.`;

    if (trimmed.startsWith(stylePrefix)) {
      const property = trimmed.slice(stylePrefix.length);
      if (isFieldStyleProperty(property)) return { fieldKey, property };
    }

    if (trimmed.startsWith(directPrefix)) {
      const property = trimmed.slice(directPrefix.length);
      if (isFieldStyleProperty(property)) return { fieldKey, property };
    }
  }

  return null;
};

export const isRecognizedFieldStyleColumn = (header: string, fieldKeys: Iterable<string>): boolean =>
  parseFieldStyleColumnHeader(header, fieldKeys) !== null;

const normalizeStyleValue = (
  property: FieldStyleProperty,
  value: CardData[string]
): TemplateFieldContract[FieldStyleProperty] | undefined => {
  if (value === undefined || value === null) return undefined;
  const raw = String(value).trim();
  if (!raw) return undefined;

  if (property === 'fontSizePx') {
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }
  if (property === 'fontWeight') {
    return fontWeights.has(raw) ? raw as TemplateFieldContract['fontWeight'] : undefined;
  }
  if (property === 'fontStyle') {
    return fontStyles.has(raw) ? raw as TemplateFieldContract['fontStyle'] : undefined;
  }
  if (property === 'textDecoration') {
    return textDecorations.has(raw) ? raw as TemplateFieldContract['textDecoration'] : undefined;
  }

  return raw as TemplateFieldContract[FieldStyleProperty];
};

export const resolveFieldContractStyleOverrides = (
  contract: TemplateFieldContract | undefined,
  data: CardData,
  fieldKey: string | undefined
): TemplateFieldContract | undefined => {
  if (!fieldKey) return contract;

  const overrides: Partial<TemplateFieldContract> = {};
  fieldStyleProperties.forEach((property) => {
    const value = normalizeStyleValue(property, data[buildFieldStyleDataKey(fieldKey, property)]);
    if (value !== undefined) {
      (overrides as Record<FieldStyleProperty, unknown>)[property] = value;
    }
  });

  if (Object.keys(overrides).length === 0) return contract;
  return {
    key: contract?.key ?? fieldKey,
    ...contract,
    ...overrides,
  };
};
