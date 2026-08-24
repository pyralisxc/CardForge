import sharp from 'sharp';

import {
  reconstructMinimalTemplateObject,
  type FreeformCardElement,
  type TCGCardTemplate,
} from '@/domain/templates';
import type {
  ProjectAssetBinding,
  ProjectProductionPlan,
} from '@/features/project/server';

import { StudioDocumentStoreError } from './StudioDocumentStoreError';

export const EMBEDDED_TEMPLATE_ASSET_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;
export type EmbeddedTemplateAssetMimeType = typeof EMBEDDED_TEMPLATE_ASSET_MIME_TYPES[number];

export const MAX_EMBEDDED_TEMPLATE_ASSET_BASE64_CHARS = 3_200_000;
export const MAX_EMBEDDED_TEMPLATE_ASSET_BYTES = 2_400_000;
const MAX_SOURCE_DIMENSION = 8192;
const NORMALIZED_MAX_DIMENSION = 2400;

const isPersistedStudioArtwork = (value?: string): value is string => Boolean(
  value?.startsWith('data:') || value?.startsWith('cardforge-studio-asset://'),
);

const MIME_BY_FORMAT: Record<string, EmbeddedTemplateAssetMimeType | undefined> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

const decodeBase64 = (value: string): Buffer => {
  const compact = value.replace(/\s+/g, '');
  if (!compact || compact.length > MAX_EMBEDDED_TEMPLATE_ASSET_BASE64_CHARS) {
    throw new StudioDocumentStoreError('Embedded artwork is too large for a single Studio attachment.', 400);
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) {
    throw new StudioDocumentStoreError('Embedded artwork must be valid base64 image data.', 400);
  }
  const buffer = Buffer.from(compact, 'base64');
  if (buffer.length === 0 || buffer.length > MAX_EMBEDDED_TEMPLATE_ASSET_BYTES) {
    throw new StudioDocumentStoreError('Embedded artwork must be 2.4 MB or smaller before CardForge normalization.', 400);
  }
  return buffer;
};

export const normalizeEmbeddedTemplateAsset = async ({
  data,
  mimeType,
}: {
  data: string;
  mimeType: EmbeddedTemplateAssetMimeType;
}): Promise<{ dataUri: string; bytes: Buffer; width: number; height: number; byteCount: number }> => {
  const source = decodeBase64(data);
  try {
    const metadata = await sharp(source, { failOn: 'error', animated: false }).metadata();
    const detectedMime = metadata.format ? MIME_BY_FORMAT[metadata.format] : undefined;
    if (!detectedMime || detectedMime !== mimeType) throw new Error('MIME mismatch');
    if (!metadata.width || !metadata.height) throw new Error('Missing dimensions');
    if (metadata.width > MAX_SOURCE_DIMENSION || metadata.height > MAX_SOURCE_DIMENSION) {
      throw new StudioDocumentStoreError(
        `Embedded artwork dimensions must be ${MAX_SOURCE_DIMENSION}px or smaller.`,
        400,
      );
    }

    // Always decode and re-encode through Sharp, including incoming WebP.
    // Storage-level validation alone is not enough: canonical browser rendering
    // previously exposed WebP files that Sharp could inspect but Chromium later
    // rendered corruptly. A single normalization path keeps accepted assets on
    // the same known-good representation regardless of source format.
    const { data: normalized, info } = await sharp(source, { failOn: 'error', animated: false })
      .rotate()
      .resize({
        width: NORMALIZED_MAX_DIMENSION,
        height: NORMALIZED_MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 88 })
      .toBuffer({ resolveWithObject: true });

    return {
      dataUri: `data:image/webp;base64,${normalized.toString('base64')}`,
      bytes: normalized,
      width: info.width,
      height: info.height,
      byteCount: normalized.byteLength,
    };
  } catch (error) {
    if (error instanceof StudioDocumentStoreError) throw error;
    throw new StudioDocumentStoreError('Embedded artwork must be a valid PNG, JPEG, or WebP image.', 400);
  }
};

const isElementBinding = (binding: ProjectAssetBinding): boolean => binding.startsWith('element.');

const validateBindingTargets = (
  template: TCGCardTemplate,
  binding: ProjectAssetBinding,
  targetElementIds: string[],
) => {
  if (!isElementBinding(binding)) {
    if (targetElementIds.length > 0) {
      throw new StudioDocumentStoreError('Template-level artwork bindings do not use target element ids.', 400);
    }
    return;
  }
  if (targetElementIds.length === 0) {
    throw new StudioDocumentStoreError('Element artwork bindings require at least one target element id.', 400);
  }

  const elements = template.freeformCanvas?.elements ?? [];
  for (const targetId of targetElementIds) {
    const element = elements.find((candidate) => candidate.id === targetId);
    if (!element) {
      throw new StudioDocumentStoreError(`Embedded artwork target "${targetId}" is not part of this Template.`, 400);
    }
    if (binding === 'element.image' && element.type !== 'image') {
      throw new StudioDocumentStoreError('element.image bindings can only target native image elements.', 400);
    }
    if (binding === 'element.icon' && element.type !== 'icon') {
      throw new StudioDocumentStoreError('element.icon bindings can only target native icon elements.', 400);
    }
    if (binding === 'element.texture' && !['text', 'shape'].includes(element.type)) {
      throw new StudioDocumentStoreError('element.texture bindings can only target text or shape elements.', 400);
    }
    if (binding === 'element.divider' && element.type !== 'shape') {
      throw new StudioDocumentStoreError('element.divider bindings can only target native shape elements.', 400);
    }
  }
};

const updateElementWithDataUri = (
  element: FreeformCardElement,
  binding: ProjectAssetBinding,
  dataUri: string,
): FreeformCardElement => {
  if (binding === 'element.image') return { ...element, imageSource: dataUri, content: dataUri };
  if (binding === 'element.background') return { ...element, backgroundImageUrl: dataUri };
  if (binding === 'element.icon') return { ...element, iconImageSource: dataUri };
  if (binding === 'element.texture') {
    return {
      ...element,
      appearance: {
        ...element.appearance,
        material: {
          ...element.appearance?.material,
          texture: {
            ...element.appearance?.material?.texture,
            kind: 'uploaded',
            imageSource: dataUri,
            assetSource: dataUri,
          },
        },
      },
    };
  }
  if (binding === 'element.divider') {
    return { ...element, appearance: { ...element.appearance, dividerAsset: dataUri } };
  }
  return element;
};

export const bindEmbeddedTemplateAsset = ({
  template,
  binding,
  targetElementIds,
  dataUri,
}: {
  template: TCGCardTemplate;
  binding: ProjectAssetBinding;
  targetElementIds: string[];
  dataUri: string;
}): TCGCardTemplate => {
  validateBindingTargets(template, binding, targetElementIds);
  if (binding === 'template.background') {
    return reconstructMinimalTemplateObject({ ...template, cardBackgroundImageUrl: dataUri });
  }
  if (binding === 'template.border') {
    return reconstructMinimalTemplateObject({ ...template, cardBorderImageSource: dataUri });
  }

  const targetIds = new Set(targetElementIds);
  return reconstructMinimalTemplateObject({
    ...template,
    freeformCanvas: template.freeformCanvas ? {
      ...template.freeformCanvas,
      elements: template.freeformCanvas.elements.map((element) => (
        targetIds.has(element.id) ? updateElementWithDataUri(element, binding, dataUri) : element
      )),
    } : template.freeformCanvas,
  });
};

const getElementDataUri = (
  element: FreeformCardElement | undefined,
  binding: ProjectAssetBinding,
): string | undefined => {
  if (!element) return undefined;
  if (binding === 'element.image') return element.imageSource || element.content;
  if (binding === 'element.background') return element.backgroundImageUrl;
  if (binding === 'element.icon') return element.iconImageSource;
  if (binding === 'element.texture') {
    return element.appearance?.material?.texture?.imageSource
      || element.appearance?.material?.texture?.assetSource;
  }
  if (binding === 'element.divider') return element.appearance?.dividerAsset;
  return undefined;
};

export const readEmbeddedTemplateAssetDataUri = ({
  template,
  binding,
  targetElementIds,
}: {
  template: TCGCardTemplate;
  binding: ProjectAssetBinding;
  targetElementIds: string[];
}): string | undefined => {
  if (binding === 'template.background') return template.cardBackgroundImageUrl;
  if (binding === 'template.border') return template.cardBorderImageSource;
  const elements = template.freeformCanvas?.elements ?? [];
  for (const targetId of targetElementIds) {
    const value = getElementDataUri(elements.find((element) => element.id === targetId), binding);
    if (isPersistedStudioArtwork(value)) return value;
  }
  return undefined;
};

export const preserveEmbeddedTemplateAssets = ({
  currentTemplate,
  nextTemplate,
  currentPlan,
  nextPlan,
}: {
  currentTemplate: TCGCardTemplate;
  nextTemplate: TCGCardTemplate;
  currentPlan?: ProjectProductionPlan;
  nextPlan: ProjectProductionPlan;
}): { template: TCGCardTemplate; productionPlan: ProjectProductionPlan } => {
  if (!currentPlan) return { template: nextTemplate, productionPlan: nextPlan };

  let template = nextTemplate;
  const assets = nextPlan.assets.map((nextAsset) => {
    const currentAsset = currentPlan.assets.find((candidate) => candidate.id === nextAsset.id);
    if (!currentAsset?.embeddedAssetId || !currentAsset.binding) return nextAsset;

    const dataUri = readEmbeddedTemplateAssetDataUri({
      template: currentTemplate,
      binding: currentAsset.binding,
      targetElementIds: currentAsset.targetElementIds ?? [],
    });
    if (!isPersistedStudioArtwork(dataUri)) return nextAsset;

    const targetElementIds = nextAsset.targetElementIds ?? currentAsset.targetElementIds ?? [];
    template = bindEmbeddedTemplateAsset({
      template,
      binding: currentAsset.binding,
      targetElementIds,
      dataUri,
    });
    return {
      ...nextAsset,
      status: 'selected' as const,
      binding: currentAsset.binding,
      embeddedAssetId: currentAsset.embeddedAssetId,
      assetUrl: undefined,
      targetElementIds,
    };
  });

  return {
    template,
    productionPlan: { ...nextPlan, assets },
  };
};
