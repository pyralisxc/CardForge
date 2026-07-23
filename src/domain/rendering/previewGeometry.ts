import type { FreeformCanvas } from '@/domain/templates';
import { TCG_ASPECT_RATIO } from './constants';

export interface CardPreviewLayout {
  renderWidthPx: number;
  renderHeightPx: number;
  visualWidthPx: number;
  visualHeightPx: number;
  visualScale: number;
}

export const getCardHeightForWidth = (widthPx: number, aspectRatio?: string): number => {
  const [aspectW, aspectH] = (aspectRatio || TCG_ASPECT_RATIO).split(':').map(Number);
  if (aspectW > 0 && aspectH > 0 && widthPx > 0 && isFinite(widthPx) && isFinite(aspectW) && isFinite(aspectH)) {
    return (widthPx / aspectW) * aspectH;
  }

  const [defaultW, defaultH] = TCG_ASPECT_RATIO.split(':').map(Number);
  const fallbackHeight = (widthPx / (defaultW || 63)) * (defaultH || 88);
  return isFinite(fallbackHeight) ? fallbackHeight : (widthPx / (63 / 88));
};

export const getCardPreviewLayout = ({
  targetWidthPx,
  aspectRatio,
  canvas,
}: {
  targetWidthPx: number;
  aspectRatio?: string;
  canvas?: FreeformCanvas | null;
  isPrintMode: boolean;
}): CardPreviewLayout => {
  const hasCanonicalCanvas = !!canvas && canvas.width > 0 && canvas.height > 0;
  const renderWidthPx = hasCanonicalCanvas ? canvas.width : targetWidthPx;
  const renderHeightPx = hasCanonicalCanvas
    ? canvas.height
    : getCardHeightForWidth(renderWidthPx, aspectRatio);
  const visualScale = hasCanonicalCanvas ? targetWidthPx / renderWidthPx : 1;

  return {
    renderWidthPx,
    renderHeightPx,
    visualWidthPx: targetWidthPx,
    visualHeightPx: renderHeightPx * visualScale,
    visualScale,
  };
};
