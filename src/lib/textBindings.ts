import type { CardData, FreeformCardElement, TCGCardTemplate } from '@/types';

export const escapeTemplateText = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '\\n');

export const unescapeTemplateText = (value: string): string =>
  value.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');

export const parseTextBinding = (content?: string): { field: string; fallback: string } => {
  const raw = content || '';
  const match = raw.match(/^\{\{\s*([A-Za-z_][\w.-]*)\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}\}$/);
  if (!match) return { field: '', fallback: raw };
  return { field: match[1], fallback: unescapeTemplateText(match[2]) };
};

export const isSimpleTextBinding = (content?: string): boolean => parseTextBinding(content).field.length > 0;

export const buildTextBinding = (field: string, fallback: string): string => {
  const cleanField = field.trim().replace(/[^\w.-]/g, '');
  return cleanField ? `{{${cleanField}:"${escapeTemplateText(fallback)}"}}` : fallback;
};

export interface TemplateTextSegment {
  type: 'text' | 'variable';
  text: string;
  key?: string;
}

export const buildStaticSegmentFieldKey = (elementId: string, segmentIndex: number): string =>
  `__segment_text__${elementId}__${segmentIndex}`;

export const isStaticSegmentFieldKey = (key: string): boolean => key.startsWith('__segment_text__');

export const buildScopedFieldDataKey = (elementId: string, key: string): string =>
  `__scoped_field__${elementId}__${key}`;

export const isScopedFieldDataKey = (key: string): boolean => key.startsWith('__scoped_field__');

export interface ExtractedPlaceholder {
  key: string;
  defaultValue?: string;
}

export const TEMPLATE_PLACEHOLDER_REGEX = /\{\{\s*([A-Za-z_][\w.-]*)\s*(?::\s*"((?:[^"\\]|\\.)*)")?\s*\}\}/g;

const STATIC_IMAGE_SOURCE_PREFIXES = ['http://', 'https://', 'data:', 'blob:', 'css:', 'linear-gradient', 'radial-gradient', '/'];

const isStaticImageSource = (value: string): boolean => {
  const lower = value.toLowerCase();
  return STATIC_IMAGE_SOURCE_PREFIXES.some((prefix) => lower.startsWith(prefix));
};

const sanitizeImageFieldPart = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
};

export const parseTemplateTextSegments = (content?: string): TemplateTextSegment[] => {
  const raw = content || '';
  const simple = parseTextBinding(raw);
  if (simple.field) {
    return [{ type: 'text', text: simple.fallback }];
  }

  const segments: TemplateTextSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  TEMPLATE_PLACEHOLDER_REGEX.lastIndex = 0;

  while ((match = TEMPLATE_PLACEHOLDER_REGEX.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        text: raw.slice(lastIndex, match.index),
      });
    }

    segments.push({
      type: 'variable',
      key: match[1],
      text: match[2] !== undefined ? unescapeTemplateText(match[2]) : '',
    });
    lastIndex = TEMPLATE_PLACEHOLDER_REGEX.lastIndex;
  }

  if (lastIndex < raw.length) {
    segments.push({
      type: 'text',
      text: raw.slice(lastIndex),
    });
  }

  return segments.length > 0 ? segments : [{ type: 'text', text: raw }];
};

export const extractPlaceholderKeysFromText = (text?: string): string[] => {
  if (!text) return [];
  const keys: string[] = [];
  let match: RegExpExecArray | null;
  TEMPLATE_PLACEHOLDER_REGEX.lastIndex = 0;
  while ((match = TEMPLATE_PLACEHOLDER_REGEX.exec(text)) !== null) {
    const key = match[1]?.trim();
    if (key && !keys.includes(key)) keys.push(key);
  }
  return keys;
};

export function getBoundImageFieldKey(element: Pick<FreeformCardElement, 'imageSource' | 'content'>): string | undefined {
  const candidates = [element.imageSource, element.content];

  for (const candidate of candidates) {
    if (!candidate) continue;

    TEMPLATE_PLACEHOLDER_REGEX.lastIndex = 0;
    const placeholderMatch = TEMPLATE_PLACEHOLDER_REGEX.exec(candidate);
    if (placeholderMatch?.[1]) {
      return placeholderMatch[1].trim();
    }

    const trimmed = candidate.trim();
    if (!trimmed || isStaticImageSource(trimmed)) continue;
    if (/^[\w-]+$/.test(trimmed)) return trimmed;
  }

  return undefined;
}

export function deriveImageFieldKey(element: Pick<FreeformCardElement, 'id' | 'name'>): string {
  const namePart = sanitizeImageFieldPart(element.name || 'image');
  const idPart = sanitizeImageFieldPart(element.id || 'layer');
  return `image_${namePart || 'image'}_${idPart || 'layer'}`;
}

export function getImageFieldKeyForElement(
  element: Pick<FreeformCardElement, 'id' | 'name' | 'imageSource' | 'content'>
): string {
  return getBoundImageFieldKey(element) || deriveImageFieldKey(element);
}

export function extractUniquePlaceholderKeys(template?: TCGCardTemplate): ExtractedPlaceholder[] {
  if (!template) return [];

  const placeholderMap = new Map<string, ExtractedPlaceholder>();

  const processStringForPlaceholders = (str: string | undefined) => {
    if (!str) return;
    let match: RegExpExecArray | null;
    TEMPLATE_PLACEHOLDER_REGEX.lastIndex = 0;
    while ((match = TEMPLATE_PLACEHOLDER_REGEX.exec(str)) !== null) {
      const key = match[1].trim();
      const defaultValue = match[2] !== undefined ? unescapeTemplateText(match[2]) : undefined;

      if (!placeholderMap.has(key) || (defaultValue !== undefined && placeholderMap.get(key)?.defaultValue === undefined)) {
        placeholderMap.set(key, { key, defaultValue });
      }
    }
  };

  processStringForPlaceholders(template.cardBackgroundImageUrl);

  template.freeformCanvas?.elements?.forEach((element) => {
    if (element.type === 'image') {
      const source = element.imageSource || element.content;

      const imageFieldKey = getImageFieldKeyForElement(element);
      if (!placeholderMap.has(imageFieldKey)) {
        const defaultValue = source && isStaticImageSource(source.trim()) ? source.trim() : undefined;
        placeholderMap.set(imageFieldKey, { key: imageFieldKey, defaultValue });
      }

      processStringForPlaceholders(source);
    } else {
      processStringForPlaceholders(element.content);
    }
    processStringForPlaceholders(element.backgroundImageUrl);
  });

  return Array.from(placeholderMap.values());
}

export function replacePlaceholdersLocal(
  text: string | undefined,
  dataContext: CardData,
  removeUnmatchedIfNoDefault: boolean
): string {
  if (text === undefined || text === null) return '';
  return String(text).replace(TEMPLATE_PLACEHOLDER_REGEX, (fullMatch, key, defaultValueFromPlaceholder) => {
    const cleanKey = key.trim();
    const cleanDefault = defaultValueFromPlaceholder !== undefined
      ? unescapeTemplateText(defaultValueFromPlaceholder)
      : undefined;

    if (dataContext[cleanKey] !== undefined && dataContext[cleanKey] !== null) {
      return String(dataContext[cleanKey]);
    }
    if (cleanDefault !== undefined) {
      return cleanDefault;
    }
    if (removeUnmatchedIfNoDefault) {
      return '';
    }
    return fullMatch;
  });
}

export const renamePlaceholderKeyInText = (content: string, fromKey: string, toKey: string): string => {
  const cleanToKey = toKey.trim().replace(/[^\w.-]/g, '');
  if (!fromKey || !cleanToKey || fromKey === cleanToKey) return content;

  return content.replace(TEMPLATE_PLACEHOLDER_REGEX, (full, key, fallback) => {
    if (key !== fromKey) return full;
    const escapedFallback = fallback ?? '';
    return `{{${cleanToKey}${fallback !== undefined ? `:"${escapedFallback}"` : ''}}}`;
  });
};

export const resolveTemplateTextSegments = (
  elementId: string,
  content: string | undefined,
  dataContext: Record<string, string | number | undefined>,
  removeUnmatchedIfNoDefault: boolean
): string => {
  const raw = content || '';
  const simple = parseTextBinding(raw);
  if (simple.field) {
    const scopedValue = dataContext[buildScopedFieldDataKey(elementId, simple.field)];
    if (scopedValue !== undefined && scopedValue !== null) return String(scopedValue);
    const value = dataContext[simple.field];
    if (value !== undefined && value !== null) return String(value);
    return simple.fallback;
  }

  const segments = parseTemplateTextSegments(raw);
  return segments.map((segment, index) => {
    if (segment.type === 'variable') {
      const value = segment.key
        ? dataContext[buildScopedFieldDataKey(elementId, segment.key)] ?? dataContext[segment.key]
        : undefined;
      if (value !== undefined && value !== null) return String(value);
      if (segment.text) return segment.text;
      return removeUnmatchedIfNoDefault ? '' : '';
    }

    const staticKey = buildStaticSegmentFieldKey(elementId, index);
    const staticValue = dataContext[staticKey];
    if (staticValue !== undefined && staticValue !== null) return String(staticValue);
    return segment.text;
  }).join('');
};
