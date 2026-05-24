import type { FreeformCardElement, GeneratorFieldKind, TCGCardTemplate } from '@/types';
import { extractUniquePlaceholderKeys, getImageFieldKeyForElement, toTitleCase } from '@/lib/utils';
import { buildScopedFieldDataKey, buildStaticSegmentFieldKey, parseTemplateTextSegments, parseTextBinding, unescapeTemplateText } from '@/lib/textBindings';

export type TemplateFieldControl = 'input' | 'textarea';
export type TemplateFieldEditor = 'plain-input' | 'plain-textarea' | 'rich-textarea' | 'rules-textarea';
export type TemplateFieldContentModel = 'image' | 'plainText' | 'richText' | 'rulesBlocks';

export interface TemplateFieldDefinition {
  key: string;
  label: string;
  control: TemplateFieldControl;
  editor: TemplateFieldEditor;
  contentModel: TemplateFieldContentModel;
  defaultValue?: string;
  required: boolean;
  isImage: boolean;
  isMultiline: boolean;
  supportsRichText: boolean;
  helperText?: string;
  sourceElementId?: string;
  sourceElementName?: string;
  sourceElementPreview?: string;
  sourceElementContent?: string;
  isStaticBaseText?: boolean;
}

const MULTILINE_HINTS = ['rules', 'text', 'effect', 'abilit', 'description', 'flavor'];
const RULES_HINTS = ['rules', 'effect', 'ability', 'reminder', 'flavor', 'subtitle', 'subtext', 'description'];

const REQUIRED_FIELD_OVERRIDES: Record<string, boolean> = {
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

const fieldLooksMultiline = (key: string): boolean => {
  const lower = key.toLowerCase();
  return MULTILINE_HINTS.some(hint => lower.includes(hint));
};

const fieldLooksLikeRules = (key: string): boolean => {
  const lower = key.toLowerCase();
  return RULES_HINTS.some((hint) => lower.includes(hint));
};

const getTemplateImageFieldKeys = (template: TCGCardTemplate): Set<string> => {
  const imageKeys = new Set<string>();
  template.freeformCanvas?.elements?.forEach((element) => {
    if (element.type !== 'image') return;
    imageKeys.add(getImageFieldKeyForElement(element));
  });
  return imageKeys;
};

const fieldSupportsRichText = (template: TCGCardTemplate, key: string): boolean =>
  !!template.freeformCanvas?.elements?.some(element =>
    element.type === 'text' && typeof element.content === 'string' && element.content.includes(`{{${key}`)
  );

const normalizeLabelValue = (value?: string): string =>
  (value || '').replace(/[\s_-]+/g, ' ').trim().toLowerCase();

const resolveFieldLabel = (
  key: string,
  contract?: NonNullable<TCGCardTemplate['fieldContracts']>[number]
): string => {
  const defaultLabel = toTitleCase(key);
  const candidate = contract?.label?.trim();
  if (!candidate) return defaultLabel;

  const normalizedCandidate = normalizeLabelValue(candidate);
  const normalizedDefault = normalizeLabelValue(defaultLabel);
  if (normalizedCandidate === normalizedDefault) return defaultLabel;

  return candidate;
};

const getTextElementsForField = (template: TCGCardTemplate, key: string) =>
  template.freeformCanvas?.elements?.filter(
    (element) => element.type === 'text' && typeof element.content === 'string' && element.content.includes(`{{${key}`)
  ) || [];

const getPlaceholderFallbackForElement = (element: FreeformCardElement | undefined, key: string): string | undefined => {
  if (!element?.content) return undefined;
  const simple = parseTextBinding(element.content);
  if (simple.field === key) return simple.fallback;
  return parseTemplateTextSegments(element.content).find((segment) => (
    segment.type === 'variable' && segment.key === key
  ))?.text;
};

const buildSourceElementPreview = (
  element: FreeformCardElement | undefined,
  currentKey: string,
  contractMap: Map<string, NonNullable<TCGCardTemplate['fieldContracts']>[number]>
): string | undefined => {
  if (!element?.content) return undefined;

  const simpleBinding = parseTextBinding(element.content);
  if (simpleBinding.field) {
    if (simpleBinding.field !== currentKey) return undefined;
    return simpleBinding.fallback || `[${resolveFieldLabel(currentKey, contractMap.get(currentKey))}]`;
  }

  const preview = element.content.replace(/\{\{\s*([\w-]+)\s*(?::\s*"((?:[^"\\]|\\.)*)")?\s*\}\}/g, (_full, key, fallback) => {
    if (key === currentKey) {
      return `[${resolveFieldLabel(key, contractMap.get(key))}]`;
    }

    if (fallback !== undefined) {
      return unescapeTemplateText(fallback);
    }

    return `[${resolveFieldLabel(key, contractMap.get(key))}]`;
  });

  return preview.trim() || undefined;
};

const pickFieldKind = (kinds: GeneratorFieldKind[]): GeneratorFieldKind | undefined => {
  if (kinds.includes('rules')) return 'rules';
  if (kinds.includes('richText')) return 'richText';
  if (kinds.includes('text')) return 'text';
  return undefined;
};

const inferFieldKind = (
  key: string,
  isMultiline: boolean,
  supportsRichText: boolean,
  explicitKind?: GeneratorFieldKind
): GeneratorFieldKind => {
  if (explicitKind) return explicitKind;
  if (fieldLooksLikeRules(key) && isMultiline) return 'rules';
  if (supportsRichText) return 'richText';
  return 'text';
};

const fieldIsRequired = (key: string, isImage: boolean, defaultValue?: string): boolean => {
  const normalized = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
  const override = REQUIRED_FIELD_OVERRIDES[normalized];
  if (override !== undefined) return override;

  if (isImage) return false;
  if (typeof defaultValue === 'string' && defaultValue.trim() !== '') return false;
  return true;
};

export function extractTemplateFieldDefinitions(template?: TCGCardTemplate): TemplateFieldDefinition[] {
  if (!template) return [];
  const imageFieldKeys = getTemplateImageFieldKeys(template);
  const contracts = template.fieldContracts || [];
  const contractMap = new Map(contracts.map((contract) => [contract.key, contract]));
  const scopedContractsByKey = contracts.reduce<Map<string, typeof contracts>>((groups, contract) => {
    if (!contract.elementId) return groups;
    const group = groups.get(contract.key) ?? [];
    group.push(contract);
    groups.set(contract.key, group);
    return groups;
  }, new Map());
  const scopedCollisionKeys = new Set(
    Array.from(scopedContractsByKey.entries())
      .filter(([, group]) => new Set(group.map((contract) => contract.elementId)).size > 1)
      .map(([key]) => key)
  );
  const getContract = (key: string, elementId?: string) => (
    (elementId ? contracts.find((contract) => contract.key === key && contract.elementId === elementId) : undefined)
    || contracts.find((contract) => contract.key === key && !contract.elementId)
    || contractMap.get(key)
  );
  const scopedCollisionFields: TemplateFieldDefinition[] = Array.from(scopedCollisionKeys).flatMap((key) => (
    (scopedContractsByKey.get(key) || []).flatMap((contract): TemplateFieldDefinition[] => {
      if (!contract.elementId) return [];
      const element = template.freeformCanvas?.elements?.find((candidate) => candidate.id === contract.elementId);
      if (!element || element.type !== 'text') return [];
      const isMultiline = typeof contract.multiline === 'boolean'
        ? contract.multiline
        : Boolean(getPlaceholderFallbackForElement(element, key)?.includes('\n'));
      const contentModel: TemplateFieldContentModel = contract.type === 'rules'
        ? 'rulesBlocks'
        : contract.type === 'text'
          ? 'plainText'
          : 'richText';
      const richTextEnabled = contentModel === 'rulesBlocks' || contentModel === 'richText';
      return [{
        key: buildScopedFieldDataKey(element.id, key),
        label: resolveFieldLabel(key, contract),
        control: contentModel === 'plainText' ? (isMultiline ? 'textarea' : 'input') : 'textarea',
        editor: contentModel === 'rulesBlocks'
          ? 'rules-textarea'
          : contentModel === 'richText'
            ? 'rich-textarea'
            : isMultiline
              ? 'plain-textarea'
              : 'plain-input',
        contentModel,
        defaultValue: getPlaceholderFallbackForElement(element, key) ?? contract.example,
        required: typeof contract.required === 'boolean' ? contract.required : fieldIsRequired(key, false, contract.example),
        isImage: false,
        isMultiline,
        supportsRichText: richTextEnabled,
        sourceElementId: element.id,
        sourceElementName: element.name,
        sourceElementPreview: buildSourceElementPreview(element, key, new Map([[key, contract]])),
        sourceElementContent: element.content,
        helperText: contentModel === 'rulesBlocks'
          ? 'Use one field for rules blocks. Prefix paragraphs with [ability], [effect], [reminder], [flavor], or [subtitle] to change how each block renders.'
          : richTextEnabled
            ? 'Use the visual editor toolbar for highlight, lists, emphasis, and inline color.'
            : undefined,
      }];
    })
  ));
  const placeholderFields: TemplateFieldDefinition[] = extractUniquePlaceholderKeys(template).map((placeholder): TemplateFieldDefinition => {
    const isImage = imageFieldKeys.has(placeholder.key);
    const supportsRichText = !isImage && fieldSupportsRichText(template, placeholder.key);
    const textElements = !isImage ? getTextElementsForField(template, placeholder.key) : [];
    const primaryTextElement = textElements[0];
    const contract = getContract(placeholder.key, primaryTextElement?.id);
    const isMultiline = !isImage && (typeof contract?.multiline === 'boolean' ? contract.multiline : fieldLooksMultiline(placeholder.key));
    const explicitKind = (contract?.type === 'text' || contract?.type === 'richText' || contract?.type === 'rules' ? contract.type : undefined)
      || pickFieldKind(
        textElements
          .map((element) => element.generatorFieldKind)
          .filter((kind): kind is GeneratorFieldKind => Boolean(kind))
      );
    const fieldKind = isImage ? undefined : inferFieldKind(placeholder.key, isMultiline, supportsRichText, explicitKind);
    const explicitRequiredValues = textElements
      .map((element) => element.generatorFieldRequired)
      .filter((value): value is boolean => typeof value === 'boolean');
    const required = typeof contract?.required === 'boolean'
      ? contract.required
      : explicitRequiredValues.length > 0
      ? explicitRequiredValues.some(Boolean)
      : fieldIsRequired(placeholder.key, isImage, placeholder.defaultValue);
    const contentModel: TemplateFieldContentModel = isImage
      ? 'image'
      : fieldKind === 'rules'
        ? 'rulesBlocks'
        : fieldKind === 'richText'
          ? 'richText'
          : 'plainText';
    const richTextEnabled = contentModel === 'rulesBlocks' || contentModel === 'richText';
    const editor: TemplateFieldEditor = isImage
      ? 'plain-input'
      : contentModel === 'rulesBlocks'
        ? 'rules-textarea'
        : contentModel === 'richText'
          ? 'rich-textarea'
          : isMultiline
            ? 'plain-textarea'
            : 'plain-input';

    return {
      key: placeholder.key,
      label: resolveFieldLabel(placeholder.key, contract),
      control: (isImage
        ? 'input'
        : contentModel === 'plainText'
          ? (isMultiline ? 'textarea' : 'input')
          : 'textarea') as TemplateFieldControl,
      editor,
      contentModel,
      defaultValue: placeholder.defaultValue ?? contract?.example,
      required,
      isImage,
      isMultiline,
      supportsRichText: richTextEnabled,
      sourceElementId: primaryTextElement?.id,
      sourceElementName: primaryTextElement?.name,
      sourceElementPreview: buildSourceElementPreview(primaryTextElement, placeholder.key, contractMap),
      sourceElementContent: primaryTextElement?.content,
      helperText: contentModel === 'rulesBlocks'
        ? 'Use one field for rules blocks. Prefix paragraphs with [ability], [effect], [reminder], [flavor], or [subtitle] to change how each block renders.'
        : richTextEnabled
        ? editor === 'rich-textarea'
          ? 'Use the visual editor toolbar for highlight, lists, emphasis, and inline color.'
          : 'This field supports rich text through the shared visual editor.'
        : undefined,
    };
  }).filter((field) => !scopedCollisionKeys.has(field.key));

  const staticSegmentFields: TemplateFieldDefinition[] = [];
  (template.freeformCanvas?.elements || []).forEach((element) => {
    if (element.type !== 'text' || !element.content) return;
    const simple = parseTextBinding(element.content);
    if (simple.field) return;

    const segments = parseTemplateTextSegments(element.content);
    const hasVariableSegments = segments.some((segment) => segment.type === 'variable');
    if (!hasVariableSegments) return;

    const nonEmptyStaticSegments = segments
      .map((segment, index) => ({ segment, index }))
      .filter(({ segment }) => {
        if (segment.type !== 'text') return false;
        const trimmed = segment.text.trim();
        if (!trimmed) return false;
        return (trimmed.match(/[a-z0-9]/gi) || []).length >= 3;
      });

    const contentModel: TemplateFieldContentModel = inferTextContentModelFromElement(element);
    nonEmptyStaticSegments.forEach(({ segment, index }, staticSegmentPosition) => {
      const key = buildStaticSegmentFieldKey(element.id, index);
      const contract = contractMap.get(key);
      const multipleStaticSegments = nonEmptyStaticSegments.length > 1;
      const baseLabel = multipleStaticSegments
        ? `${element.name || 'Text'} Base ${staticSegmentPosition + 1}`
        : (element.name || 'Base Text');
      staticSegmentFields.push({
        key,
        label: contract?.label?.trim() || baseLabel,
        control: 'textarea' as TemplateFieldControl,
        editor: contentModel === 'rulesBlocks' ? 'rules-textarea' : contentModel === 'richText' ? 'rich-textarea' : 'plain-textarea',
        contentModel,
        defaultValue: segment.text,
        required: false,
        isImage: false,
        isMultiline: segment.text.includes('\n') || contentModel !== 'plainText',
        supportsRichText: contentModel !== 'plainText',
        sourceElementId: element.id,
        sourceElementName: element.name,
        sourceElementPreview: element.name,
        sourceElementContent: element.content,
        isStaticBaseText: true,
        helperText: contentModel === 'rulesBlocks'
          ? 'This is the base rules-box copy that sits between inline variables.'
          : 'This is the base text segment that sits between inline variables.',
      });
    });
  });

  return [...staticSegmentFields, ...scopedCollisionFields, ...placeholderFields];
}

const inferTextContentModelFromElement = (element: FreeformCardElement): TemplateFieldContentModel => {
  const lower = `${element.name || ''} ${element.content || ''}`.toLowerCase();
  if (element.generatorFieldKind === 'rules' || /(rules|effect|ability|reminder|flavor|subtitle|subtext|description)/.test(lower)) {
    return 'rulesBlocks';
  }
  if (element.generatorFieldKind === 'text') return 'plainText';
  return 'richText';
};
