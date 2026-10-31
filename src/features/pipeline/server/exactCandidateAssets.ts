import { getImageFieldKeyForElement, isRenderableImageSource, replacePlaceholdersLocal, TEMPLATE_PLACEHOLDER_REGEX } from '@/domain/rendering';
import { isSourceContainedCssImage } from '@/domain/templates/sourceContainedCss';
import { isRenderResourceField, cssImageFields } from '@/domain/templates/sourceResourceFields';
import { createHash } from 'node:crypto';
import { validateNativeTemplateStructure, type TCGCardTemplate } from '@/domain/templates';

/** No arbitrary URL fetch: only the candidate's content-addressed managed bytes. */
export async function embedExactCandidateAssets(template: TCGCardTemplate, download: (hash: string) => Promise<Uint8Array>) {
  if (!template.freeformCanvas || !Array.isArray(template.freeformCanvas.elements)
    || !Number.isFinite(template.freeformCanvas.width) || template.freeformCanvas.width <= 0
    || !Number.isFinite(template.freeformCanvas.height) || template.freeformCanvas.height <= 0
    || template.freeformCanvas.elements.some(e => !e || !e.type || !e.id || ![e.x,e.y,e.width,e.height].every(Number.isFinite))
    || validateNativeTemplateStructure(template)) throw new Error('candidate_content_unsupported');
  const data = { ...template.templatePreviewData };
  for (const f of template.fieldContracts ?? []) if (data[f.key] === undefined && f.defaultValue !== undefined) data[f.key] = f.defaultValue;
  const imageKeys = new Set((template.fieldContracts ?? []).filter(f => f.type === 'image').map(f => f.key));
  const bound = (value: string) => !value || /^cardforge-pipeline-asset:\/\/[a-f0-9]{64}$/u.test(value) || /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/u.test(value);
  for (const element of template.freeformCanvas.elements) if (element.type === 'image') { imageKeys.add(getImageFieldKeyForElement(element)); if(element.imageSource) imageKeys.add(element.imageSource); }
  for (const element of template.freeformCanvas.elements) if (element.type === 'image') {
    for (const match of (element.imageSource || element.content || '').matchAll(new RegExp(TEMPLATE_PLACEHOLDER_REGEX))) imageKeys.add(match[1]);
  }
  for (const element of template.freeformCanvas.elements) if (element.type === 'text') {
    for (const match of (element.content || '').matchAll(new RegExp(TEMPLATE_PLACEHOLDER_REGEX))) {
      if (imageKeys.has(match[1]) && typeof data[match[1]] === 'string' && String(data[match[1]]).startsWith('cardforge-pipeline-asset://')) throw new Error('candidate_dependency_unsupported');
    }
  }
  const imageElements = new Set<object>(template.freeformCanvas.elements.filter(e => e.type === 'image'));
  const cache = new Map<string, string>();
  async function visit(value: unknown, depth = 0, key = '', imageAlias = false, parentType = '', inData = false): Promise<unknown> {
    if (depth > 80) throw new Error('candidate_content_unsupported');
    if (typeof value === 'string') {
      const resource = (inData ? imageKeys.has(key) : isRenderResourceField(key)) || parentType === 'image' && ['content','defaultValue'].includes(key);
      if (!resource) {
        if (/color$/i.test(key) && /(?:url|image-set|cross-fade|paint|element|var|env)\s*\(|\\/iu.test(value)) throw new Error('candidate_dependency_unsupported');
        return value;
      }
      const bindings = [...value.matchAll(new RegExp(TEMPLATE_PLACEHOLDER_REGEX))];
      if (bindings.length) {
        if (bindings.some(match => data[match[1]] === undefined) || !bound(replacePlaceholdersLocal(value,data,false))) throw new Error('candidate_dependency_unsupported');
        return value; // Hydrate its typed data/default slot, preserving the binding itself.
      }
      if (key === 'content' && parentType === 'image' && !isRenderableImageSource(value) && !/^(?:cardforge-|\.\.?\/)/iu.test(value) && data[value] == null) return value;
      // Match the native review-revision gradient exemption; dependency checks below still apply.
      const gradient = (cssImageFields.has(key) || key === 'backgroundImageUrl' || key === 'cardBackgroundImageUrl' || key === 'cardBorderImageSource') && isSourceContainedCssImage(value);
      if (!bound(value) && !gradient && !(imageAlias && typeof data[value] === 'string' && bound(String(data[value])))) throw new Error('candidate_dependency_unsupported');
      const match = /^cardforge-pipeline-asset:\/\/([a-f0-9]{64})$/u.exec(value);
      if (match) {
        if (!cache.has(match[1])) {
          const bytes = await download(match[1]);
          if (!bytes.length || bytes.length > 2_400_000 || createHash('sha256').update(bytes).digest('hex') !== match[1]) throw new Error('candidate_asset_changed');
          cache.set(match[1], `data:image/webp;base64,${Buffer.from(bytes).toString('base64')}`);
        }
        return cache.get(match[1]);
      }
      if (/^(?:cardforge-|https?:|blob:|\/|\.\.?\/)/iu.test(value) || /(?:url|image-set|cross-fade|paint|element)\s*\(/iu.test(value) || value.includes('\\') || /^[^\s]+\.(?:png|jpe?g|webp|svg|gif)(?:[?#].*)?$/iu.test(value)
        || (value.startsWith('data:') && !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/u.test(value))) {
        throw new Error('candidate_dependency_unsupported');
      }
      return value;
    }
    if (Array.isArray(value)) return Promise.all(value.map(v => visit(v, depth + 1, key, false, parentType, inData)));
    if (value && typeof value === 'object' && 'fontFamily' in value && value.fontFamily && !['font-sans','font-serif','font-mono','Arial','serif','sans-serif','monospace'].includes(String(value.fontFamily))) throw new Error('candidate_font_unsupported');
    if (value && typeof value === 'object') return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([k,v]) => [k,await visit(v,depth + 1,k,['imageSource','content'].includes(k) && imageElements.has(value),String(k === 'content' && (value as Record<string,unknown>).imageSource ? '' : (value as Record<string,unknown>).type ?? ''),key === 'templatePreviewData')])));
    return value;
  }
  return await visit(template) as TCGCardTemplate;
}
