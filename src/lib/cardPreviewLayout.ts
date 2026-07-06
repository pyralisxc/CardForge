import { TCG_ASPECT_RATIO } from '@/lib/constants';
import type { FreeformCanvas } from '@/types';

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
  isPrintMode,
}: {
  targetWidthPx: number;
  aspectRatio?: string;
  canvas?: FreeformCanvas | null;
  isPrintMode: boolean;
}): CardPreviewLayout => {
  const shouldScalePreviewFromTemplateSize = !isPrintMode && !!canvas && canvas.width > 0;
  const renderWidthPx = shouldScalePreviewFromTemplateSize ? canvas.width : targetWidthPx;
  const renderHeightPx = getCardHeightForWidth(renderWidthPx, aspectRatio);
  const visualScale = shouldScalePreviewFromTemplateSize ? targetWidthPx / renderWidthPx : 1;

  return {
    renderWidthPx,
    renderHeightPx,
    visualWidthPx: targetWidthPx,
    visualHeightPx: renderHeightPx * visualScale,
    visualScale,
  };
};
