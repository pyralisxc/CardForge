import type { TCGCardTemplate } from '@/types';
import { extractUniquePlaceholderKeys, getImageFieldKeyForElement, toTitleCase } from '@/lib/utils';

export type TemplateFieldControl = 'input' | 'textarea';
export type TemplateFieldEditor = 'plain-input' | 'plain-textarea' | 'rich-textarea';

export interface TemplateFieldDefinition {
  key: string;
  label: string;
  control: TemplateFieldControl;
  editor: TemplateFieldEditor;
  defaultValue?: string;
  required: boolean;
  isImage: boolean;
  isMultiline: boolean;
  supportsRichText: boolean;
  helperText?: string;
}

const MULTILINE_HINTS = ['rules', 'text', 'effect', 'abilit', 'description', 'flavor'];

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

  return extractUniquePlaceholderKeys(template).map((placeholder) => {
    const isImage = imageFieldKeys.has(placeholder.key);
    const isMultiline = !isImage && fieldLooksMultiline(placeholder.key);
    const supportsRichText = !isImage && fieldSupportsRichText(template, placeholder.key);
    const editor: TemplateFieldEditor = isImage
      ? 'plain-input'
      : supportsRichText && isMultiline
        ? 'rich-textarea'
        : isMultiline
          ? 'plain-textarea'
          : 'plain-input';
    const required = fieldIsRequired(placeholder.key, isImage, placeholder.defaultValue);

    return {
      key: placeholder.key,
      label: toTitleCase(placeholder.key),
      control: isMultiline ? 'textarea' : 'input',
      editor,
      defaultValue: placeholder.defaultValue,
      required,
      isImage,
      isMultiline,
      supportsRichText,
      helperText: supportsRichText
        ? editor === 'rich-textarea'
          ? 'Use the formatting toolbar for highlight, lists, emphasis, and inline color.'
          : 'This field supports inline rich-text markers such as ==highlight== and [color:#hex]text[/color].'
        : undefined,
    };
  });
}