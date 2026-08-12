import type { TCGCardTemplate } from '@/domain/templates';
import { resolveTemplateCardFormat, type CardMeasurementUnit } from '@/domain/card-formats';
import {
  createDefaultFreeformCanvas,
  getDefaultGridSizeForCanvas,
  reconstructFreeformCanvas,
} from '@/domain/templates';
import { mmConversion } from '@/features/template-editor/lib/makerGeometry';

interface BuildCustomDimensionUpdateInput {
  widthValue: string;
  heightValue: string;
  unit: CardMeasurementUnit | string;
  template: Pick<TCGCardTemplate, 'formatId' | 'trimWidthMm' | 'trimHeightMm' | 'aspectRatio' | 'freeformCanvas'>;
}

export const buildCustomDimensionTemplateUpdate = ({
  widthValue,
  heightValue,
  unit,
  template,
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
  const nextGridSize = getDefaultGridSizeForCanvas(nextCanvasWidth, nextCanvasHeight);

  return {
    formatId: 'custom',
    trimWidthMm: widthMm,
    trimHeightMm: heightMm,
    aspectRatio: `${widthMm}:${heightMm}`,
    freeformCanvas: reconstructFreeformCanvas({
      ...(template.freeformCanvas || createDefaultFreeformCanvas()),
      width: nextCanvasWidth,
      height: nextCanvasHeight,
      gridSize: nextGridSize,
    }),
  };
};
