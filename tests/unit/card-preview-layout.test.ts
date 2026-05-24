import { describe, expect, it } from 'vitest';

import { getCardPreviewLayout } from '@/lib/cardPreviewLayout';
import type { FreeformCanvas } from '@/types';

const canvas: FreeformCanvas = {
  width: 630,
  height: 880,
  elements: [],
};

describe('card preview layout', () => {
  it('renders on-screen previews at template width and visually scales the whole card down', () => {
    const layout = getCardPreviewLayout({
      targetWidthPx: 132,
      aspectRatio: '63:88',
      canvas,
      isPrintMode: false,
    });

    expect(layout.renderWidthPx).toBe(630);
    expect(layout.renderHeightPx).toBe(880);
    expect(layout.visualWidthPx).toBe(132);
    expect(layout.visualHeightPx).toBeCloseTo(184.381);
    expect(layout.visualScale).toBeCloseTo(132 / 630);
  });

  it('renders print/export previews natively at the requested export width', () => {
    const layout = getCardPreviewLayout({
      targetWidthPx: 744,
      aspectRatio: '63:88',
      canvas,
      isPrintMode: true,
    });

    expect(layout.renderWidthPx).toBe(744);
    expect(layout.renderHeightPx).toBeCloseTo(1039.238);
    expect(layout.visualWidthPx).toBe(744);
    expect(layout.visualHeightPx).toBeCloseTo(1039.238);
    expect(layout.visualScale).toBe(1);
  });
});
