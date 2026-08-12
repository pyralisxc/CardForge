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

export const resizeCanvasWithStrategy = (
  source: TCGCardTemplate['freeformCanvas'],
  targetWidth: number,
  targetHeight: number,
  strategy: CanvasResizeStrategy,
) => {
  const canvas = reconstructFreeformCanvas(source || createDefaultFreeformCanvas());
  if (strategy === 'canvas-only') {
    return reconstructFreeformCanvas({
      ...canvas,
      width: targetWidth,
      height: targetHeight,
      gridSize: getDefaultGridSizeForCanvas(targetWidth, targetHeight),
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
    gridSize: getDefaultGridSizeForCanvas(targetWidth, targetHeight),
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
  template: Pick<TCGCardTemplate, 'freeformCanvas'>;
}): Partial<TCGCardTemplate> => {
  const format = getCardFormat(formatId);
  if (!format) return {};
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
    ),
  };
};
