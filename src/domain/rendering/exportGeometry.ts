import { TCG_ASPECT_RATIO } from './constants';
import { resolveTemplateCardFormat } from '@/domain/card-formats';
import type { DisplayCard } from './types';

export interface CardPhysicalSizeMm {
  widthMm: number;
  heightMm: number;
}

export const getCardAspectParts = (card: DisplayCard): { width: number; height: number } => {
  const canvasWidth = Number(card.template.freeformCanvas?.width);
  const canvasHeight = Number(card.template.freeformCanvas?.height);
  if (canvasWidth > 0 && canvasHeight > 0) {
    return { width: canvasWidth, height: canvasHeight };
  }
  const [aspectW, aspectH] = (card.template.aspectRatio || TCG_ASPECT_RATIO).split(':').map(Number);
  return {
    width: Number.isFinite(aspectW) && aspectW > 0 ? aspectW : 63,
    height: Number.isFinite(aspectH) && aspectH > 0 ? aspectH : 88,
  };
};

export const getCardExportHeightPx = (card: DisplayCard, renderWidthPx: number): number => {
  const { width, height } = getCardAspectParts(card);
  return Math.round((renderWidthPx / width) * height);
};

export interface CardExportDimensionsPx {
  widthPx: number;
  heightPx: number;
}

export const getCardPhysicalSizeMm = (
  card: DisplayCard,
  printableWidthMm?: number,
  printableHeightMm?: number
): CardPhysicalSizeMm => {
  const resolvedFormat = resolveTemplateCardFormat(card.template);
  let widthMm = resolvedFormat.widthMm;
  let heightMm = resolvedFormat.heightMm;

  if (
    printableWidthMm !== undefined &&
    printableHeightMm !== undefined &&
    (widthMm > printableWidthMm || heightMm > printableHeightMm)
  ) {
    const scale = Math.min(printableWidthMm / widthMm, printableHeightMm / heightMm);
    widthMm = Math.round(widthMm * scale * 1000) / 1000;
    heightMm = Math.round(heightMm * scale * 1000) / 1000;
  }

  return { widthMm, heightMm };
};

export const getCardExportDimensionsPx = (
  card: DisplayCard,
  dpi: number
): CardExportDimensionsPx => {
  const { widthMm, heightMm } = getCardPhysicalSizeMm(card);
  const widthPx = Math.max(1, Math.round((widthMm / 25.4) * dpi));
  const heightPx = Math.max(1, Math.round((heightMm / 25.4) * dpi));
  return { widthPx, heightPx };
};
