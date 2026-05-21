import { describe, expect, it } from 'vitest';

import { createPdfPlacementPages, getPdfModeSlug, getPdfSafeName, getPdfTotalChunks } from '@/lib/pdfExportLayout';
import type { DisplayCard } from '@/types';

const makeCard = (id: string, aspectRatio = '63:88'): DisplayCard => ({
  uniqueId: id,
  data: {},
  template: {
    id: 'template-1',
    name: 'Template',
    aspectRatio,
  },
});

describe('pdf export helpers', () => {
  it('packs standard TCG cards onto US Letter pages using true physical dimensions', () => {
    const cards = Array.from({ length: 10 }, (_, index) => makeCard(`card-${index + 1}`));

    const pages = createPdfPlacementPages(cards, {
      printableWidthMm: 205.9,
      printableHeightMm: 269.4,
      marginMm: 5,
      spacingMm: 0,
      forcedFace: 'front',
    });

    expect(pages).toHaveLength(2);
    expect(pages[0]).toHaveLength(9);
    expect(pages[1]).toHaveLength(1);
    expect(pages[0][0]).toMatchObject({ x: 5, y: 5, w: 63, h: 88, face: 'front' });
    expect(pages[0][1]).toMatchObject({ x: 68, y: 5, w: 63, h: 88, face: 'front' });
    expect(pages[0][3]).toMatchObject({ x: 5, y: 93, w: 63, h: 88, face: 'front' });
  });

  it('preserves explicit face ordering for same-sheet and digital layouts', () => {
    const card = makeCard('card-1');
    const pages = createPdfPlacementPages([
      { card, face: 'front' },
      { card, face: 'back' },
    ], {
      printableWidthMm: 205.9,
      printableHeightMm: 269.4,
      marginMm: 5,
      spacingMm: 0,
    });

    expect(pages).toHaveLength(1);
    expect(pages[0].map((placement) => placement.face)).toEqual(['front', 'back']);
  });

  it('centralizes filename and chunk naming decisions', () => {
    expect(getPdfSafeName('Smoke Export Template!')).toBe('Smoke-Export-Template');
    expect(getPdfSafeName('')).toBe('tcg-cards');
    expect(getPdfModeSlug('physical', 'separate-pages')).toBe('print-duplex-sheets');
    expect(getPdfModeSlug('physical', 'same-page')).toBe('print-same-sheet');
    expect(getPdfModeSlug('virtual', 'same-page')).toBe('digital-sheet');
    expect(getPdfTotalChunks(1001)).toBe(3);
  });
});
