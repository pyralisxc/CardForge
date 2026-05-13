export const escapeTemplateText = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '\\n');

export const unescapeTemplateText = (value: string): string =>
  value.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');

export const parseTextBinding = (content?: string): { field: string; fallback: string } => {
  const raw = content || '';
  const match = raw.match(/^\{\{\s*([A-Za-z_][\w.-]*)\s*:\s*"([\s\S]*)"\s*\}\}$/);
  if (!match) return { field: '', fallback: raw };
  return { field: match[1], fallback: unescapeTemplateText(match[2]) };
};

export const isSimpleTextBinding = (content?: string): boolean => parseTextBinding(content).field.length > 0;

export const buildTextBinding = (field: string, fallback: string): string => {
  const cleanField = field.trim().replace(/[^\w.-]/g, '');
  return cleanField ? `{{${cleanField}:"${escapeTemplateText(fallback)}"}}` : fallback;
};