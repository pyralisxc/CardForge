import { normalizeProjectFontAsset, isProjectFontMimeType } from '@/features/project/server';
import { CARD_FONT_OPTIONS } from '@/domain/rendering';
import type { TCGCardTemplate } from '@/domain/templates';
import { StudioDocumentStoreError } from './StudioDocumentStoreError';

const boundImage = (value: string) => !value || /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/u.test(value);
const boundFont = (value: string) => { const match = /^data:([^;,]+);base64,[A-Za-z0-9+/=]+$/u.exec(value); return !!match && isProjectFontMimeType(match[1]); };
const fail = () => { throw new StudioDocumentStoreError('Exact inspection requires source-contained artwork. An external, relative or unresolved dependency remains; no replacement was made.', 400); };

/** Same typed-source boundary as exactCandidateAssets, after all managed bytes are embedded. */
export function assertContainedSource(value: unknown, fonts = new Set<string>(), depth = 0, key = '', aliases: Record<string, unknown> = {}, imageElements = new Set<object>(), imageAlias = false, fontData = false): void {
  if (depth > 80) throw new StudioDocumentStoreError('Source nesting exceeds the native inspection budget.', 413);
  if (typeof value === 'string') {
    const text = value.trim();
    const gradient = key === 'backgroundImageUrl' && /^\s*(?:linear|radial)-gradient\(/u.test(value) && !/url\s*\(|[a-z][a-z0-9+.-]*:\/\//iu.test(value);
    const alias = imageAlias && typeof aliases[value] === 'string' && boundImage(String(aliases[value]));
    if (/(?:url|src|imageSource|assetSource|dividerAsset)$/iu.test(key) && !boundImage(value) && !gradient && !alias && !(fontData && boundFont(value))
      && !(imageAlias && value === '__cardforge_deleted_media_blank__')) fail();
    if (/^(?:https?:|blob:|cardforge-|\/|\.\.?\/)/iu.test(text) || /(?:url|image-set|cross-fade|paint|element)\s*\(/iu.test(text) || text.includes('\\')) fail();
    if (text.startsWith('data:') && !boundImage(value) && !boundFont(value)) fail();
    if (key === 'fontFamily' && value && !fonts.has(value) && !['Arial', 'serif', 'sans-serif', 'monospace'].includes(value) && !CARD_FONT_OPTIONS.some(f => f.value === value || f.cssFamily === value)) {
      throw new StudioDocumentStoreError('An authored font is unavailable in this exact source. No fallback was substituted.', 400);
    }
  } else if (Array.isArray(value)) value.forEach(v => assertContainedSource(v, fonts, depth + 1, key, aliases, imageElements));
  else if (value && typeof value === 'object') Object.entries(value).forEach(([k, v]) => assertContainedSource(v, fonts, depth + 1, k, aliases, imageElements, k === 'imageSource' && imageElements.has(value), k === 'dataUrl' && !!normalizeProjectFontAsset(value)));
}

export function assertContainedTemplate(template: TCGCardTemplate, cardData?: Record<string, unknown>, fonts = new Set<string>()) {
  const data: Record<string, unknown> = { ...template.templatePreviewData, ...cardData };
  for (const field of template.fieldContracts ?? []) if (data[field.key] === undefined && field.defaultValue !== undefined) data[field.key] = field.defaultValue;
  // Inspect effective data and every retained image default; a key is not itself evidence of bytes.
  for (const field of template.fieldContracts ?? []) if (field.type === 'image') {
    for (const value of [data[field.key], field.defaultValue]) if (value != null && (typeof value !== 'string' || !boundImage(value))) fail();
  }
  assertContainedSource(data, fonts);
  const images = new Set<object>((template.freeformCanvas?.elements ?? []).filter(e => e.type === 'image'));
  assertContainedSource(template, fonts, 0, '', data, images);
}
