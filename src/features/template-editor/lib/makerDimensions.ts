import type { TCGCardTemplate } from '@/domain/templates';
import { resolveTemplateCardFormat, type CardMeasurementUnit } from '@/domain/card-formats';
import {
  createDefaultFreeformCanvas,
  getDefaultGridSizeForCanvas,
  reconstructFreeformCanvas,
} from '@/domain/templates';
import type { CardFormatId } from '@/domain/card-formats';
import { getCardFormat } from '@/domain/card-formats';
import { mmConversion } from '@/features/template-editor/lib/makerGeometry';

interface BuildCustomDimensionUpdateInput {
  widthValue: string;
  heightValue: string;
  unit: CardMeasurementUnit | string;
  template: Pick<TCGCardTemplate, 'formatId' | 'trimWidthMm' | 'trimHeightMm' | 'aspectRatio' | 'freeformCanvas'>;
  resizeStrategy?: CanvasResizeStrategy;
}

export type CanvasResizeStrategy = 'fit' | 'fill' | 'canvas-only';

const roundGeometry = (value: number): number => Math.round(value * 1000) / 1000;
const clampGridPx = (value: number): number => Math.max(1, Math.min(1000, roundGeometry(value)));

type GridMeasurementTemplate = Pick<TCGCardTemplate, 'formatId' | 'trimWidthMm' | 'trimHeightMm' | 'aspectRatio' | 'freeformCanvas'>;

export const getTemplatePixelsPerUnit = (
  template: GridMeasurementTemplate,
  unit: CardMeasurementUnit,
): { x: number; y: number; average: number } => {
  if (unit === 'px') return { x: 1, y: 1, average: 1 };
  const resolved = resolveTemplateCardFormat(template);
  const factorMm = mmConversion[unit] ?? 1;
  const x = Math.max(Number.EPSILON, resolved.canvasWidthPx / Math.max(Number.EPSILON, resolved.widthMm)) * factorMm;
  const y = Math.max(Number.EPSILON, resolved.canvasHeightPx / Math.max(Number.EPSILON, resolved.heightMm)) * factorMm;
  return { x, y, average: (x + y) / 2 };
};

export const getTemplateGridMeasurement = ({
  template,
  gridSizePx,
  unit,
}: {
  template: GridMeasurementTemplate;
  gridSizePx: number;
  unit: CardMeasurementUnit;
}): number => {
  if (unit === 'px') return Math.round(gridSizePx * 1000) / 1000;
  const pixelsPerUnit = getTemplatePixelsPerUnit(template, unit).average;
  return Math.round((gridSizePx / pixelsPerUnit) * 1000) / 1000;
};

export const getTemplateGridSizePx = ({
  template,
  value,
  unit,
}: {
  template: GridMeasurementTemplate;
  value: number;
  unit: CardMeasurementUnit;
}): number => {
  if (!Number.isFinite(value) || value <= 0) return 1;
  if (unit === 'px') return clampGridPx(value);
  return clampGridPx(value * getTemplatePixelsPerUnit(template, unit).average);
};

export const getTemplateGridSizeMm = (
  template: GridMeasurementTemplate,
  gridSizePx = template.freeformCanvas?.gridSize
    || getDefaultGridSizeForCanvas(
      Number(template.freeformCanvas?.width) || 630,
      Number(template.freeformCanvas?.height) || 880,
    ),
): number => {
  const pixelsPerMm = getTemplatePixelsPerUnit(template, 'mm').average;
  return roundGeometry(gridSizePx / pixelsPerMm);
};

export const resizeCanvasWithStrategy = (
  source: TCGCardTemplate['freeformCanvas'],
  targetWidth: number,
  targetHeight: number,
  strategy: CanvasResizeStrategy,
  gridSizeOverride?: number,
) => {
  const canvas = reconstructFreeformCanvas(source || createDefaultFreeformCanvas());
  if (strategy === 'canvas-only') {
    return reconstructFreeformCanvas({
      ...canvas,
      width: targetWidth,
      height: targetHeight,
      gridSize: gridSizeOverride ? clampGridPx(gridSizeOverride) : getDefaultGridSizeForCanvas(targetWidth, targetHeight),
    });
  }

  const scaleX = targetWidth / canvas.width;
  const scaleY = targetHeight / canvas.height;
  const scale = strategy === 'fill' ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY);
  const offsetX = (targetWidth - canvas.width * scale) / 2;
  const offsetY = (targetHeight - canvas.height * scale) / 2;
  return reconstructFreeformCanvas({
    ...canvas,
    width: targetWidth,
    height: targetHeight,
    gridSize: gridSizeOverride ? clampGridPx(gridSizeOverride) : getDefaultGridSizeForCanvas(targetWidth, targetHeight),
    elements: canvas.elements.map((element) => ({
      ...element,
      x: roundGeometry(element.x * scale + offsetX),
      y: roundGeometry(element.y * scale + offsetY),
      width: Math.max(1, roundGeometry(element.width * scale)),
      height: Math.max(1, roundGeometry(element.height * scale)),
      fontSizePx: element.fontSizePx ? Math.max(6, roundGeometry(element.fontSizePx * scale)) : undefined,
      strokeWidth: typeof element.strokeWidth === 'number'
        ? Math.max(0, roundGeometry(element.strokeWidth * scale))
        : element.strokeWidth,
    })),
  });
};

export const buildCardFormatTemplateUpdate = ({
  formatId,
  resizeStrategy,
  template,
}: {
  formatId: Exclude<CardFormatId, 'custom'>;
  resizeStrategy: CanvasResizeStrategy;
  template: GridMeasurementTemplate;
}): Partial<TCGCardTemplate> => {
  const format = getCardFormat(formatId);
  if (!format) return {};
  const sourceGridMm = getTemplateGridSizeMm(template);
  const targetPixelsPerMm = (
    format.canvasWidthPx / format.widthMm
    + format.canvasHeightPx / format.heightMm
  ) / 2;
  return {
    formatId: format.id,
    trimWidthMm: format.widthMm,
    trimHeightMm: format.heightMm,
    aspectRatio: `${format.widthMm}:${format.heightMm}`,
    freeformCanvas: resizeCanvasWithStrategy(
      template.freeformCanvas,
      format.canvasWidthPx,
      format.canvasHeightPx,
      resizeStrategy,
      sourceGridMm * targetPixelsPerMm,
    ),
  };
};

export const buildCustomDimensionTemplateUpdate = ({
  widthValue,
  heightValue,
  unit,
  template,
  resizeStrategy = 'fit',
}: BuildCustomDimensionUpdateInput): Partial<TCGCardTemplate> | null => {
  const width = parseFloat(widthValue);
  const height = parseFloat(heightValue);

  if (!width || !height || width <= 0 || height <= 0) {
    return null;
  }

  const currentFormat = resolveTemplateCardFormat(template);
  const factor = mmConversion[unit] ?? 1;
  const currentPixelsPerMmX = currentFormat.canvasWidthPx / currentFormat.widthMm;
  const currentPixelsPerMmY = currentFormat.canvasHeightPx / currentFormat.heightMm;
  const widthMm = Math.round((unit === 'px' ? width / currentPixelsPerMmX : width * factor) * 1000) / 1000;
  const heightMm = Math.round((unit === 'px' ? height / currentPixelsPerMmY : height * factor) * 1000) / 1000;
  const nextCanvasWidth = unit === 'px' ? Math.round(width) : Math.round(widthMm * currentPixelsPerMmX);
  const nextCanvasHeight = unit === 'px' ? Math.round(height) : Math.round(heightMm * currentPixelsPerMmY);
  return {
    formatId: 'custom',
    trimWidthMm: widthMm,
    trimHeightMm: heightMm,
    aspectRatio: `${widthMm}:${heightMm}`,
    freeformCanvas: resizeCanvasWithStrategy(
      template.freeformCanvas,
      nextCanvasWidth,
      nextCanvasHeight,
      resizeStrategy,
      getTemplateGridSizeMm(template) * (
        nextCanvasWidth / widthMm + nextCanvasHeight / heightMm
      ) / 2,
    ),
  };
};
