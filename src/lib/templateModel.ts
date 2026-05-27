import { nanoid } from 'nanoid';

import { normalizeAppearanceForElement, normalizeTemplateAppearance } from '@/lib/appearance';
import { TCG_ASPECT_RATIO } from '@/lib/constants';
import type { FreeformCanvas, FreeformCardElement, TCGCardTemplate } from '@/types';

const DEFAULT_FREEFORM_CANVAS_WIDTH = 630;
const DEFAULT_FREEFORM_CANVAS_HEIGHT = 880;

export const getDefaultGridSizeForCanvas = (width: number, height: number): number => {
  const safeWidth = Number(width) > 0 ? Number(width) : DEFAULT_FREEFORM_CANVAS_WIDTH;
  const safeHeight = Number(height) > 0 ? Number(height) : DEFAULT_FREEFORM_CANVAS_HEIGHT;
  const targetSize = Math.max(safeWidth, safeHeight) * 0.02;
  const minSize = Math.max(4, Math.round(targetSize * 0.5));
  const maxSize = Math.max(minSize, Math.round(targetSize * 1.6));
  let best = Math.max(1, Math.round(targetSize));
  let bestScore = Number.POSITIVE_INFINITY;

  for (let candidate = minSize; candidate <= maxSize; candidate += 1) {
    const remainder = safeHeight % candidate;
    const rowFitError = Math.min(remainder, candidate - remainder);
    const rowCount = safeHeight / candidate;
    const centerLinePenalty = Number.isInteger(rowCount) && rowCount % 2 === 0 ? 0 : 2.5;
    const targetError = Math.abs(candidate - targetSize);
    const score = rowFitError * 2 + centerLinePenalty + targetError;
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return Math.min(200, Math.max(1, best));
};

const createDefaultFreeformElement = (type: FreeformCardElement['type'], overrides: Partial<FreeformCardElement> = {}): FreeformCardElement => {
  const id = overrides.id || nanoid();
  const base: FreeformCardElement = {
    id,
    type,
    name: type === 'text' ? 'Card Title' : type === 'image' ? 'Artwork' : type === 'icon' ? 'Icon' : 'Shape',
    x: 48,
    y: 48,
    width: type === 'text' ? 400 : type === 'icon' ? 64 : 300,
    height: type === 'text' ? 56 : type === 'icon' ? 64 : 180,
    rotation: 0,
    opacity: 1,
    zIndex: 1,
    locked: false,
    content: type === 'text' ? '{{cardName:"Card Name"}}' : type === 'image' ? 'artworkUrl' : '',
    iconName: type === 'icon' ? 'Sparkles' : undefined,
    shapeKind: type === 'shape' ? 'rectangle' : undefined,
    textColor: '#111827',
    backgroundColor: type === 'shape' ? 'rgba(255,255,255,0.16)' : 'transparent',
    fontFamily: 'font-sans',
    fontSize: type === 'text' ? 'text-xl' : 'text-sm',
    fontSizePx: type === 'text' ? 20 : 14,
    fontWeight: type === 'text' ? 'font-bold' : 'font-normal',
    textAlign: type === 'text' ? 'center' : 'left',
    fontStyle: 'normal',
    padding: type === 'text' ? 'p-2' : 'p-0',
    borderColor: type === 'image' || type === 'shape' ? '#d1d5db' : undefined,
    borderWidth: type === 'image' || type === 'shape' ? 'border' : '_none_',
    borderRadius: type === 'image' || type === 'shape' ? 'rounded-md' : 'rounded-none',
    minHeight: '_auto_',
    imageObjectFit: 'cover',
    fillColor: type === 'icon' ? 'transparent' : type === 'shape' ? 'rgba(255,255,255,0.16)' : undefined,
    strokeColor: type === 'icon' || type === 'shape' ? '#fbbf24' : undefined,
    strokeWidth: 2,
    ...overrides,
  };
  return {
    ...base,
    appearance: normalizeAppearanceForElement(base),
  };
};

export const createDefaultFreeformCanvas = (overrides: Partial<FreeformCanvas> = {}): FreeformCanvas => ({
  width: DEFAULT_FREEFORM_CANVAS_WIDTH,
  height: DEFAULT_FREEFORM_CANVAS_HEIGHT,
  gridSize: getDefaultGridSizeForCanvas(
    overrides.width || DEFAULT_FREEFORM_CANVAS_WIDTH,
    overrides.height || DEFAULT_FREEFORM_CANVAS_HEIGHT
  ),
  ...overrides,
  elements: overrides.elements && overrides.elements.length > 0 ? overrides.elements : [
    createDefaultFreeformElement('shape', {
      id: 'default-frame',
      name: 'Card Frame',
      x: 28,
      y: 28,
      width: 574,
      height: 824,
      zIndex: 0,
      backgroundColor: 'rgba(255,255,255,0.08)',
      fillColor: 'rgba(255,255,255,0.08)',
      borderColor: '#c89f42',
      strokeColor: '#c89f42',
      borderWidth: 'border-2',
      borderRadius: 'rounded-xl',
    }),
    createDefaultFreeformElement('text', {
      id: 'default-card-name',
      name: 'Card Name',
      x: 64,
      y: 58,
      width: 420,
      height: 54,
      zIndex: 2,
      content: '{{cardName:"Astral Relic"}}',
      textColor: '#2f2414',
    }),
    createDefaultFreeformElement('text', {
      id: 'default-cost',
      name: 'Cost',
      x: 502,
      y: 58,
      width: 62,
      height: 54,
      zIndex: 3,
      content: '{{cost:"3"}}',
      textColor: '#111827',
      backgroundColor: 'rgba(255,255,255,0.76)',
      borderColor: '#c89f42',
      borderWidth: 'border',
      borderRadius: 'rounded-full',
    }),
    createDefaultFreeformElement('image', {
      id: 'default-artwork',
      name: 'Artwork',
      x: 64,
      y: 132,
      width: 502,
      height: 338,
      zIndex: 1,
      imageSource: 'artworkUrl',
      content: 'artworkUrl',
    }),
    createDefaultFreeformElement('text', {
      id: 'default-rules-text',
      name: 'Rules Text',
      x: 64,
      y: 548,
      width: 502,
      height: 166,
      zIndex: 2,
      content: '{{rulesText:"When Astral Relic enters play, draw a card."}}',
      fontSize: 'text-sm',
      fontWeight: 'font-normal',
      textAlign: 'left',
      textColor: '#2f2414',
      backgroundColor: 'rgba(255,255,255,0.72)',
      borderColor: '#d7b86c',
      borderWidth: 'border',
      borderRadius: 'rounded-md',
    }),
  ],
});

export const reconstructFreeformCanvas = (canvas?: Partial<FreeformCanvas>): FreeformCanvas => {
  const defaults = createDefaultFreeformCanvas();
  const sourceElements = canvas?.elements && Array.isArray(canvas.elements) && canvas.elements.length > 0 ? canvas.elements : defaults.elements;
  return {
    width: Number(canvas?.width) > 0 ? Number(canvas?.width) : defaults.width,
    height: Number(canvas?.height) > 0 ? Number(canvas?.height) : defaults.height,
    gridSize: Number(canvas?.gridSize) > 0
      ? Number(canvas?.gridSize)
      : getDefaultGridSizeForCanvas(
          Number(canvas?.width) > 0 ? Number(canvas?.width) : defaults.width,
          Number(canvas?.height) > 0 ? Number(canvas?.height) : defaults.height
        ),
    elements: sourceElements.map((element, index) => {
      const isDivider = element.type === 'shape' && (element.shapeKind === 'line' || element.shapeRole === 'divider');
      const normalizedShapeKind = element.shapeKind === 'capsule' ? 'rectangle' : element.shapeKind;
      const normalizedAppearance = isDivider
        ? {
            ...element.appearance,
            dividerAsset: element.appearance?.dividerAsset || '/card-assets/dividers/gilded-filigree.svg',
            assetKind: 'divider' as const,
            shapeRole: 'divider' as const,
            material: { ...element.appearance?.material, baseColor: 'transparent', texture: { kind: 'none' as const } },
            border: { ...element.appearance?.border, kind: 'none' as const, width: 0 },
          }
        : element.appearance;

      return createDefaultFreeformElement(element.type || 'text', {
        ...element,
        id: element.id && element.id.trim() !== '' ? element.id : nanoid(),
        name: element.name || `${element.type || 'Element'} ${index + 1}`,
        x: Number.isFinite(Number(element.x)) ? Number(element.x) : 32,
        y: Number.isFinite(Number(element.y)) ? Number(element.y) : 32,
        width: Number(element.width) > 0 ? Number(element.width) : 120,
        height: Number(element.height) > 0 ? Number(element.height) : 60,
        zIndex: Number.isFinite(Number(element.zIndex)) ? Number(element.zIndex) : index,
        opacity: Number.isFinite(Number(element.opacity)) ? Math.min(1, Math.max(0, Number(element.opacity))) : 1,
        rotation: Number.isFinite(Number(element.rotation)) ? Number(element.rotation) : 0,
        shapeKind: isDivider ? 'line' : normalizedShapeKind,
        shapeRole: isDivider ? 'divider' : element.shapeRole,
        borderRadius: element.shapeKind === 'capsule' ? 'rounded-full' : element.borderRadius,
        appearance: normalizedAppearance,
      });
    }).sort((a, b) => a.zIndex - b.zIndex),
  };
};

export const scaleCanvasToSize = (
  sourceCanvas: Partial<FreeformCanvas> | undefined,
  targetWidth: number,
  targetHeight: number
): FreeformCanvas => {
  const normalized = reconstructFreeformCanvas(sourceCanvas);
  const scaleX = normalized.width > 0 ? targetWidth / normalized.width : 1;
  const scaleY = normalized.height > 0 ? targetHeight / normalized.height : 1;

  return reconstructFreeformCanvas({
    ...normalized,
    width: targetWidth,
    height: targetHeight,
    elements: normalized.elements.map((element) => ({
      ...element,
      x: Math.round(element.x * scaleX),
      y: Math.round(element.y * scaleY),
      width: Math.max(1, Math.round(element.width * scaleX)),
      height: Math.max(1, Math.round(element.height * scaleY)),
      fontSizePx: element.fontSizePx ? Math.max(6, Math.round(element.fontSizePx * Math.min(scaleX, scaleY))) : undefined,
      strokeWidth: typeof element.strokeWidth === 'number'
        ? Math.max(0, Math.round(element.strokeWidth * Math.min(scaleX, scaleY) * 100) / 100)
        : element.strokeWidth,
    })),
  });
};

export const reconstructMinimalTemplateObject = (partial: Partial<TCGCardTemplate>): TCGCardTemplate => {
  const loaded = { ...partial };
  const validatedId = loaded.id && loaded.id.trim() !== '' ? loaded.id : nanoid();

  const base: Partial<TCGCardTemplate> = {
    id: validatedId,
    name: loaded.name || `Template ${validatedId.substring(0, 8)}`,
    aspectRatio: loaded.aspectRatio || TCG_ASPECT_RATIO,
    templateSource: loaded.templateSource === 'default' ? 'default' : 'user',
    templateLibrarySource: loaded.templateLibrarySource || (loaded.templateSource === 'default' ? 'base' : 'personal'),
    templateAccessTier: loaded.templateAccessTier,
    templateRegistryStatus: loaded.templateRegistryStatus,
    templateContributorName: loaded.templateContributorName,
    templateUsage: loaded.templateUsage === 'back-preset' ? 'back-preset' : 'standard',
    templateCategory: loaded.templateCategory,
    templateDescription: loaded.templateDescription,
    templateOrder: typeof loaded.templateOrder === 'number' ? loaded.templateOrder : undefined,
    templatePreviewData: loaded.templatePreviewData,
    frameStyle: loaded.frameStyle || 'standard',
    cardBorderWidth: loaded.cardBorderWidth && loaded.cardBorderWidth.trim() !== '' ? loaded.cardBorderWidth : '4px',
    cardBorderStyle: loaded.cardBorderStyle && loaded.cardBorderStyle !== '_default_' ? loaded.cardBorderStyle : 'solid',
    cardBorderRadius: loaded.cardBorderRadius && loaded.cardBorderRadius.trim() !== '' ? loaded.cardBorderRadius : '0.5rem',
    appearance: normalizeTemplateAppearance(loaded),
  };

  const optionalStringFields: Array<keyof Pick<TCGCardTemplate, 'cardBackgroundImageUrl' | 'baseBackgroundColor' | 'baseTextColor' | 'defaultElementBorderColor' | 'cardBorderColor' | 'cardBorderImageSource'>> = [
    'cardBackgroundImageUrl', 'baseBackgroundColor', 'baseTextColor', 'defaultElementBorderColor', 'cardBorderColor', 'cardBorderImageSource',
  ];

  optionalStringFields.forEach((fieldKey) => {
    const value = loaded[fieldKey];
    const baseRecord = base as Record<string, unknown>;
    if (value && String(value).trim() !== '') {
      baseRecord[fieldKey] = value;
    } else {
      delete baseRecord[fieldKey];
    }
  });

  const template = base as TCGCardTemplate;
  template.fieldContracts = Array.isArray(loaded.fieldContracts)
    ? loaded.fieldContracts
        .filter((contract) => contract?.key && String(contract.key).trim() !== '')
        .map((contract) => ({
          ...contract,
          key: String(contract.key).trim(),
          elementId: contract.elementId ? String(contract.elementId) : undefined,
        }))
    : [];
  template.freeformCanvas = reconstructFreeformCanvas(loaded.freeformCanvas);
  template.backCanvas = loaded.backCanvas ? reconstructFreeformCanvas(loaded.backCanvas) : undefined;

  return template;
};

export const getFreshDefaultTemplateObject = (id?: string | null, nameProp?: string): TCGCardTemplate => {
  let newTemplateId: string | null;
  let newTemplateName: string;
  const isValidExistingId = id && id.trim() !== '';

  if (id === null) {
    newTemplateId = null;
    newTemplateName = nameProp || 'New Unsaved Template';
  } else if (isValidExistingId) {
    newTemplateId = id;
    newTemplateName = nameProp || `Template ${String(id).substring(0, 8)}`;
  } else {
    newTemplateId = nanoid();
    newTemplateName = nameProp || `Template ${newTemplateId.substring(0, 8)}`;
  }

  if (nameProp && nameProp !== 'New Unsaved Template' && (id === null || !isValidExistingId)) {
    newTemplateName = nameProp;
  }

  return {
    id: newTemplateId,
    name: newTemplateName,
    aspectRatio: TCG_ASPECT_RATIO,
    templateSource: 'user',
    frameStyle: 'standard',
    cardBorderWidth: '4px',
    cardBorderStyle: 'solid',
    cardBorderRadius: '0.5rem',
    cardBorderImageSource: undefined,
    fieldContracts: [],
    freeformCanvas: createDefaultFreeformCanvas(),
  };
};

export {
  getFreshDefaultTemplateObject as getFreshDefaultTemplate,
  reconstructMinimalTemplateObject as reconstructMinimalTemplate,
};
