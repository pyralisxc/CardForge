import { TCG_ASPECT_RATIO } from '@/lib/constants';
import type { DisplayCard } from '@/types';

const STANDARD_CARD_HEIGHT_MM = 88;

export interface CardPhysicalSizeMm {
  widthMm: number;
  heightMm: number;
}

export const getCardAspectParts = (card: DisplayCard): { width: number; height: number } => {
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

export const getCardPhysicalSizeMm = (
  card: DisplayCard,
  printableWidthMm?: number,
  printableHeightMm?: number
): CardPhysicalSizeMm => {
  const { width: ratioW, height: ratioH } = getCardAspectParts(card);
  let widthMm: number;
  let heightMm: number;

  if (ratioW >= 20 && ratioH >= 20) {
    widthMm = ratioW;
    heightMm = ratioH;
  } else {
    heightMm = STANDARD_CARD_HEIGHT_MM;
    widthMm = (ratioW / ratioH) * STANDARD_CARD_HEIGHT_MM;
  }

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
