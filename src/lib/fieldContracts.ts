import type {
  CardData,
  FreeformCardElement,
  TemplateFieldAllowedFormatting,
  TemplateFieldContract,
  TemplateFieldContractType,
  TCGCardTemplate,
} from '@/types';
import type { TemplateFieldDefinition } from '@/lib/templateFields';
import { buildScopedFieldDataKey, parseTemplateTextSegments, parseTextBinding } from '@/lib/textBindings';
import { extractPlaceholderKeysFromText, getImageFieldKeyForElement, toTitleCase } from '@/lib/utils';

export type FieldContractContentModel = 'image' | 'plainText' | 'richText' | 'rulesBlocks' | 'structuredRows';
export const FIELD_CONTRACT_VERSION = 1;

export interface ResolveFieldContractV1Options {
  key: string;
  contentModel: FieldContractContentModel;
  contract?: TemplateFieldContract;
  inferredDefaultValue?: string;
  inferredRequired: boolean;
  inferredMultiline: boolean;
  inferredHelperText?: string;
}

export interface ResolvedFieldContractV1 {
  key: string;
  label?: string;
  type: TemplateFieldContractType;
  required: boolean;
  multiline: boolean;
  defaultValue?: string;
  description?: string;
  example?: string;
  maxLength?: number;
  allowedFormatting: TemplateFieldAllowedFormatting[];
  helperText?: string;
}

const RICH_TEXT_FORMATTING: TemplateFieldAllowedFormatting[] = [
  'bold',
  'italic',
  'underline',
  'color',
  'highlight',
  'lists',
];

const RULES_FORMATTING: TemplateFieldAllowedFormatting[] = [
  'bold',
  'italic',
  'underline',
  'color',
  'highlight',
  'lists',
  'rulesMarkers',
];

const normalizePositiveInteger = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : undefined;
};

export const getDefaultAllowedFormatting = (
  contentModel: FieldContractContentModel
): TemplateFieldAllowedFormatting[] => {
  if (contentModel === 'rulesBlocks') return [...RULES_FORMATTING];
  if (contentModel === 'richText' || contentModel === 'structuredRows') return [...RICH_TEXT_FORMATTING];
  return [];
};

export const getContractTypeForContentModel = (
  contentModel: FieldContractContentModel
): TemplateFieldContractType => {
  if (contentModel === 'image') return 'image';
  if (contentModel === 'rulesBlocks') return 'rules';
  if (contentModel === 'structuredRows') return 'structuredRows';
  if (contentModel === 'richText') return 'richText';
  return 'text';
};

export const resolveFieldContractV1 = ({
  key,
  contentModel,
  contract,
  inferredDefaultValue,
  inferredRequired,
  inferredMultiline,
  inferredHelperText,
}: ResolveFieldContractV1Options): ResolvedFieldContractV1 => {
  const defaultValue = contract?.defaultValue ?? inferredDefaultValue ?? contract?.example;
  const description = contract?.description?.trim() || undefined;
  const example = contract?.example;
  const allowedFormatting = contract?.allowedFormatting?.length
    ? [...contract.allowedFormatting]
    : getDefaultAllowedFormatting(contentModel);

  return {
    key,
    label: contract?.label,
    type: contract?.type ?? getContractTypeForContentModel(contentModel),
    required: typeof contract?.required === 'boolean' ? contract.required : inferredRequired,
    multiline: typeof contract?.multiline === 'boolean' ? contract.multiline : inferredMultiline,
    defaultValue,
    description,
    example,
    maxLength: normalizePositiveInteger(contract?.maxLength),
    allowedFormatting,
    helperText: description ?? inferredHelperText,
  };
};

export interface FieldContractValidationResult {
  issues: string[];
  warnings: string[];
}

const isLikelyImageSource = (value: string): boolean => (
  value.startsWith('http://')
  || value.startsWith('https://')
  || value.startsWith('data:')
  || value.startsWith('blob:')
);

const getDetectedFormatting = (value: string): TemplateFieldAllowedFormatting[] => {
  const formatting = new Set<TemplateFieldAllowedFormatting>();
  if (/\*\*[^*]+\*\*|<strong\b|<b\b/i.test(value)) formatting.add('bold');
  if (/(^|[^*])\*[^*\n]+\*|<em\b|<i\b/i.test(value)) formatting.add('italic');
  if (/<u\b|text-decoration:\s*underline/i.test(value)) formatting.add('underline');
  if (/<span\b[^>]*(color:|data-color)|style=["'][^"']*color:/i.test(value)) formatting.add('color');
  if (/<mark\b|background-color:|==[^=]+==/i.test(value)) formatting.add('highlight');
  if (/<ul\b|<ol\b|^\s*[-*]\s+/im.test(value)) formatting.add('lists');
  if (/\[(ability|effect|reminder|flavor|subtitle|subtext|note)\]/i.test(value)) formatting.add('rulesMarkers');
  return Array.from(formatting);
};

export const validateCardDataAgainstFieldContracts = (
  fields: TemplateFieldDefinition[],
  data: CardData
): FieldContractValidationResult => {
  const issues: string[] = [];
  const warnings: string[] = [];

  fields.forEach((field) => {
    const rawValue = data[field.key];
    const value = rawValue === undefined || rawValue === null ? '' : String(rawValue);
    const trimmed = value.trim();

    if (field.required && trimmed.length === 0) {
      issues.push(`${field.label} is required.`);
      return;
    }

    if (field.maxLength && value.length > field.maxLength) {
      warnings.push(`${field.label} is ${value.length} characters; maximum is ${field.maxLength}.`);
    }

    if (field.isImage && trimmed.length > 0 && !isLikelyImageSource(trimmed)) {
      warnings.push(`${field.label} is not a URL/data URI and may not render.`);
    }

    if (!field.allowedFormatting || field.allowedFormatting.length === 0 || trimmed.length === 0) return;
    const disallowedFormatting = getDetectedFormatting(value).filter((format) => !field.allowedFormatting?.includes(format));
    if (disallowedFormatting.length > 0) {
      warnings.push(
        `${field.label} contains ${disallowedFormatting.join(', ')} formatting, but the field contract allows only ${field.allowedFormatting.join(', ')}.`
      );
    }
  });

  return { issues, warnings };
};

const inferContentModelFromElement = (element: FreeformCardElement, isImage: boolean): FieldContractContentModel => {
  if (isImage) return 'image';
  if (element.generatorFieldKind === 'structuredRows') return 'structuredRows';
  if (element.generatorFieldKind === 'rules') return 'rulesBlocks';
  if (element.generatorFieldKind === 'text') return 'plainText';

  const lower = `${element.name || ''} ${element.content || ''}`.toLowerCase();
  if (/(rules|effect|ability|reminder|flavor|subtitle|subtext|description)/.test(lower)) return 'rulesBlocks';
  return 'richText';
};

const REQUIRED_NORMALIZATION_OVERRIDES: Record<string, boolean> = {
  title: true,
  cardname: true,
  name: true,
  rulestext: true,
  typeline: true,
  setcode: true,
  cardnumber: true,
  cost: true,
  power: true,
  toughness: true,
  artworkurl: false,
  imageurl: false,
  flavortext: false,
  remindertext: false,
  artist: false,
  subtitle: false,
};

const inferRequiredForContract = (key: string, element: FreeformCardElement, fallback?: string): boolean => {
  const normalized = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
  const override = REQUIRED_NORMALIZATION_OVERRIDES[normalized];
  if (override !== undefined) return override;
  if (element.type === 'image') return false;
  return !fallback;
};

const getFallbackForElementKey = (element: FreeformCardElement, key: string): string | undefined => {
  const simple = parseTextBinding(element.content);
  if (simple.field === key) return simple.fallback;
  return parseTemplateTextSegments(element.content).find((segment) => (
    segment.type === 'variable' && segment.key === key
  ))?.text;
};

const buildContractFromElementKey = (
  element: FreeformCardElement,
  key: string,
  existingContract?: TemplateFieldContract,
  forceScoped = false
): TemplateFieldContract => {
  const contentModel = inferContentModelFromElement(element, element.type === 'image');
  const fallback = element.type === 'image'
    ? (element.imageSource && !element.imageSource.includes('{{') ? element.imageSource : undefined)
    : getFallbackForElementKey(element, key);
  const resolved = resolveFieldContractV1({
    key,
    contentModel,
    contract: existingContract,
    inferredDefaultValue: fallback,
    inferredRequired: inferRequiredForContract(key, element, fallback),
    inferredMultiline: Boolean(fallback?.includes('\n')),
  });

  return {
    ...existingContract,
    key,
    elementId: existingContract?.elementId ?? (forceScoped || element.type !== 'image' ? element.id : undefined),
    label: existingContract?.label ?? toTitleCase(key),
    type: resolved.type,
    required: resolved.required,
    multiline: resolved.multiline,
    defaultValue: resolved.defaultValue,
    description: resolved.description,
    example: resolved.example,
    maxLength: resolved.maxLength,
    allowedFormatting: resolved.allowedFormatting,
    textAutoFit: existingContract?.textAutoFit,
    minFontSizePx: existingContract?.minFontSizePx,
    textColor: existingContract?.textColor,
    fontFamily: existingContract?.fontFamily,
    fontSizePx: existingContract?.fontSizePx,
    fontWeight: existingContract?.fontWeight,
    fontStyle: existingContract?.fontStyle,
    textDecoration: existingContract?.textDecoration,
    textAlign: existingContract?.textAlign,
    writingMode: existingContract?.writingMode,
    lineHeight: existingContract?.lineHeight,
    letterSpacing: existingContract?.letterSpacing,
  };
};

export const normalizeTemplateFieldContracts = (template: TCGCardTemplate): TCGCardTemplate => {
  const existingContracts = template.fieldContracts || [];
  const nextContracts: TemplateFieldContract[] = [...existingContracts];
  const upsertContract = (contract: TemplateFieldContract) => {
    const index = nextContracts.findIndex((existing) => (
      existing.key === contract.key && existing.elementId === contract.elementId
    ));
    if (index >= 0) nextContracts[index] = contract;
    else nextContracts.push(contract);
  };

  const canvases = [template.freeformCanvas, template.backCanvas].filter(Boolean);
  canvases.forEach((canvas) => {
    canvas?.elements.forEach((element) => {
      if (element.type === 'text' && element.content) {
        extractPlaceholderKeysFromText(element.content).forEach((key) => {
          const existing = existingContracts.find((contract) => contract.key === key && contract.elementId === element.id)
            || existingContracts.find((contract) => contract.key === key && !contract.elementId);
          upsertContract(buildContractFromElementKey(element, key, existing, true));
        });
      }

      if (element.type === 'image') {
        const key = getImageFieldKeyForElement(element);
        const existing = existingContracts.find((contract) => contract.key === key && contract.elementId === element.id)
          || existingContracts.find((contract) => contract.key === key && !contract.elementId);
        upsertContract(buildContractFromElementKey(element, key, existing, false));
      }
    });
  });

  return {
    ...template,
    fieldContracts: nextContracts.map((contract) => {
      if (!contract.elementId || !contract.key.includes(':')) return contract;
      return {
        ...contract,
        key: contract.key.startsWith(`${contract.elementId}:`)
          ? buildScopedFieldDataKey(contract.elementId, contract.key.slice(contract.elementId.length + 1))
          : contract.key,
      };
    }),
  };
};
