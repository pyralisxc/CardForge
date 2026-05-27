import type { TCGCardTemplate } from '@/types';
import {
  createDefaultFreeformCanvas,
  getDefaultGridSizeForCanvas,
  reconstructFreeformCanvas,
} from '@/lib/templateModel';
import { mmConversion } from '@/features/template-editor/lib/makerGeometry';

interface BuildCustomDimensionUpdateInput {
  widthValue: string;
  heightValue: string;
  unit: string;
  template: Pick<TCGCardTemplate, 'freeformCanvas' | 'backCanvas'>;
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

  const factor = mmConversion[unit] ?? 1;
  const widthMm = Math.round(width * factor * 100) / 100;
  const heightMm = Math.round(height * factor * 100) / 100;
  const nextCanvasWidth = Math.round(widthMm * 10);
  const nextCanvasHeight = Math.round(heightMm * 10);
  const nextGridSize = getDefaultGridSizeForCanvas(nextCanvasWidth, nextCanvasHeight);

  return {
    aspectRatio: `${widthMm}:${heightMm}`,
    freeformCanvas: reconstructFreeformCanvas({
      ...(template.freeformCanvas || createDefaultFreeformCanvas()),
      width: nextCanvasWidth,
      height: nextCanvasHeight,
      gridSize: nextGridSize,
    }),
    backCanvas: template.backCanvas
      ? reconstructFreeformCanvas({
          ...template.backCanvas,
          width: nextCanvasWidth,
          height: nextCanvasHeight,
          gridSize: nextGridSize,
        })
      : undefined,
  };
};
