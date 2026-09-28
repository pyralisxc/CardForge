import { getCardPhysicalSizeMm, type DisplayCard } from '@/domain/rendering';

export interface DeskSetPresentationFootprint {
  width: number;
  height: number;
  visualHeight: number;
  physical: boolean;
}

export const DEFAULT_DESK_SET_FOOTPRINT: DeskSetPresentationFootprint = {
  width: 82,
  height: 126,
  visualHeight: 90,
  physical: false,
};

/**
 * A collapsed Set is a presentation proxy, not a physical container. Its
 * footprint reflects the largest contained Artifact plus modest stack/chrome
 * space, so different physical work reads at a meaningful relative scale
 * without pretending the collapsed proxy is itself printable.
 */
export const getDeskSetPresentationFootprint = (
  cards: readonly DisplayCard[],
): DeskSetPresentationFootprint => {
  if (cards.length === 0) return DEFAULT_DESK_SET_FOOTPRINT;
  const sizes = cards.map((card) => getCardPhysicalSizeMm(card));
  const contentWidth = Math.max(...sizes.map((size) => size.widthMm));
  const contentHeight = Math.max(...sizes.map((size) => size.heightMm));
  const fanInline = cards.length > 1 ? Math.min(24, 6 + Math.max(0, cards.length - 2) * 4) : 0;
  const fanBlock = cards.length > 1 ? Math.min(16, 4 + Math.max(0, cards.length - 2) * 3) : 0;
  const visualHeight = contentHeight + fanBlock + 8;
  return {
    width: contentWidth + fanInline + 18,
    height: visualHeight + 36,
    visualHeight,
    physical: true,
  };
};
