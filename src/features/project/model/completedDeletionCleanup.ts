import type { CardData } from '@/domain/cards';
import { getCardFaceCanvas, getImageFieldKeyForElement, replacePlaceholdersLocal } from '@/domain/rendering';
import type { FreeformAppearance, FreeformCardElement, TCGCardTemplate } from '@/domain/templates';
import { createPersonalTemplateFork } from '@/domain/templates/templateIdentity';
import type { ProjectDocumentV1 } from './projectDocument';

export const COMPLETED_DELETION_BLANK_MEDIA = '__cardforge_deleted_media_blank__';

const renderable = (value: unknown): value is string => typeof value === 'string'
  && /^(?:http|data:|blob:|cardforge-browser-asset:\/\/|\/)/u.test(value);

// Match the renderer's image binding precedence, including its fixed-source fallback.
const imageSource = (element: FreeformCardElement, data: CardData): string => {
  const value = data[getImageFieldKeyForElement(element)];
  if (renderable(value)) return value;
  const source = replacePlaceholdersLocal(element.imageSource || element.content, data, false);
  return renderable(source) ? source : renderable(data[source]) ? data[source] as string : '';
};

/** Only authored media slots are inspected; text that happens to contain a URL is not artwork. */
export function cleanCompletedDeletionReferences(
  source: ProjectDocumentV1,
  deletedUrls: ReadonlySet<string>,
  createId?: () => string,
): { document: ProjectDocumentV1; changed: boolean } {
  if (!deletedUrls.size) return { document: source, changed: false };
  const document = structuredClone(source);
  const clear = (value: string | undefined) => value && deletedUrls.has(value) ? undefined : value;
  const css = (value: string | undefined) => {
    const match = value?.match(/^url\(\s*(['"]?)(.*?)\1\s*\)$/u);
    return match && deletedUrls.has(match[2]) ? undefined : value;
  };
  const appearance = (value: FreeformAppearance | undefined) => {
    if (!value) return;
    value.assetSource = clear(value.assetSource);
    value.dividerAsset = clear(value.dividerAsset);
    if (value.material?.texture) {
      value.material.texture.imageSource = clear(value.material.texture.imageSource);
      value.material.texture.assetSource = clear(value.material.texture.assetSource);
    }
    if (value.rawCss) {
      value.rawCss.backgroundImage = css(value.rawCss.backgroundImage);
      value.rawCss.borderImageSource = css(value.rawCss.borderImageSource);
    }
  };
  const cleanTemplate = (original: TCGCardTemplate, data: CardData = {}) => {
    const template = structuredClone(original);
    template.cardBackgroundImageUrl = clear(template.cardBackgroundImageUrl);
    template.cardBorderImageSource = clear(template.cardBorderImageSource);
    appearance(template.appearance);
    // Preserve the original layer and its children/field contracts. An explicit
    // valid string sentinel prevents card-data/default fallbacks from reviving
    // media whose *rendered* exact URL has completed-deletion evidence.
    const elements = template.freeformCanvas?.elements ?? [];
    const renderedElements = getCardFaceCanvas({ template: original, data, uniqueId: 'cleanup' }, 'front')?.elements ?? [];
    const renderedById = new Map(renderedElements.map(element => [element.id, element]));
    if (template.freeformCanvas) template.freeformCanvas.elements = elements.map((element) => {
      const rendered = renderedById.get(element.id) ?? element;
      if (element.type === 'image' && deletedUrls.has(imageSource(rendered, data))) {
        element.imageSource = COMPLETED_DELETION_BLANK_MEDIA;
        if (element.content && deletedUrls.has(element.content)) element.content = '';
      } else if (element.type === 'image') {
        element.imageSource = clear(element.imageSource);
        element.content = clear(element.content);
      }
      if (element.type === 'icon' && deletedUrls.has(replacePlaceholdersLocal(rendered.iconImageSource, data, false))) {
        element.iconImageSource = '';
        element.iconName = COMPLETED_DELETION_BLANK_MEDIA;
      } else {
        element.iconImageSource = clear(element.iconImageSource);
      }
      element.backgroundImageUrl = clear(element.backgroundImageUrl);
      appearance(element.appearance);
      return element;
    });
    return template;
  };
  document.userTemplates = source.userTemplates.map((template) => cleanTemplate(template, template.templatePreviewData ?? {}));
  const originals = new Map(source.userTemplates.map((template) => [template.id, template]));
  const baselines = new Map(document.userTemplates.map((template) => [template.id, template]));
  for (const card of document.storedCards) {
    for (const side of ['front', 'back'] as const) {
      const id = side === 'front' ? card.templateId : card.backingTemplateId;
      const original = id ? originals.get(id) : undefined;
      if (!original) continue;
      const data = side === 'front' ? card.data : card.backingData ?? original.templatePreviewData ?? {};
      const cleaned = cleanTemplate(original, data);
      // An override may remove a layer, or preserve a layer whose default was
      // deleted. Both require a card-local fork, never a shared Template edit.
      if (JSON.stringify(cleaned) !== JSON.stringify(baselines.get(id!))) {
        const fork = createPersonalTemplateFork(cleaned, {}, createId);
        document.userTemplates.push(fork);
        if (side === 'front') card.templateId = fork.id!;
        else card.backingTemplateId = fork.id!;
        const set = document.cardSets.find((candidate) => candidate.id === card.setId);
        if (set && !set.templateIds?.includes(fork.id!)) set.templateIds = [...(set.templateIds ?? []), fork.id!];
      }
      // Card data and field contracts remain authored. The blank element
      // sentinel takes precedence over their image fallbacks without erasing
      // shared text or other card fields.
    }
  }
  for (const assets of Object.values(document.customAssets)) {
    for (let index = assets.length - 1; index >= 0; index -= 1) {
      if (deletedUrls.has(assets[index].url)) assets.splice(index, 1);
      else assets[index].previewUrl = clear(assets[index].previewUrl);
    }
  }
  for (const style of document.appearanceStyles) appearance(style.appearance);
  const changed = JSON.stringify(document) !== JSON.stringify(source);
  return { document: changed ? document : source, changed };
}

export function collectProjectMediaUrls(document: ProjectDocumentV1): string[] {
  // Collect conservatively; the transformation above still only touches typed
  // media slots. Neither collection nor evidence lookup fetches these URLs.
  const urls = new Set<string>();
  const visit = (value: unknown): void => {
    if (typeof value === 'string') {
      const url = value.match(/^url\(\s*(['"]?)(.*?)\1\s*\)$/u)?.[2] ?? value;
      if (/^https?:\/\//u.test(url) && url.length <= 4096) urls.add(url);
    }
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  visit(document);
  return [...urls];
}
