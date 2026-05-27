import type {
  TemplateFieldAllowedFormatting,
  TemplateFieldContract,
  TemplateFieldContractType,
} from '@/types';

export type FieldContractContentModel = 'image' | 'plainText' | 'richText' | 'rulesBlocks' | 'structuredRows';

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
