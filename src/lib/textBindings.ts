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

const TEMPLATE_PLACEHOLDER_REGEX = /\{\{\s*([A-Za-z_][\w.-]*)\s*(?::\s*"((?:[^"\\]|\\.)*)")?\s*\}\}/g;

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
