import { describe, expect, it } from 'vitest';

import { getCardPreviewLayout } from '@/domain/rendering';

describe('editor, preview, and export rendering parity', () => {
  it('renders every freeform card from its canonical canvas before scaling the whole surface', () => {
    const canvas = {
      width: 630,
      height: 880,
      gridSize: 10,
      elements: [],
    };

    expect(getCardPreviewLayout({
      targetWidthPx: 1260,
      aspectRatio: '63:88',
      canvas,
      isPrintMode: true,
    })).toEqual({
      renderWidthPx: 630,
      renderHeightPx: 880,
      visualWidthPx: 1260,
      visualHeightPx: 1760,
      visualScale: 2,
    });

    expect(getCardPreviewLayout({
      targetWidthPx: 315,
      aspectRatio: '63:88',
      canvas,
      isPrintMode: false,
    })).toEqual({
      renderWidthPx: 630,
      renderHeightPx: 880,
      visualWidthPx: 315,
      visualHeightPx: 440,
      visualScale: 0.5,
    });
  });
});
