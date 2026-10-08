import { describe, expect, it } from 'vitest';

import type { DisplayCard } from '@/domain/rendering';
import {
  PDF_CROP_MARK_GAP_MM,
  PDF_CROP_MARK_LENGTH_MM,
  PdfProductionLayoutError,
  createPdfDuplexBackPage,
  createPdfPlacementPages,
  getPdfCropMarkSegments,
} from '@/features/card-generator/lib/pdfProductionLayout';

const makeCard = (overrides: Partial<DisplayCard> = {}): DisplayCard => ({
  uniqueId: overrides.uniqueId ?? 'card-1',
  data: overrides.data ?? { cardName: 'Print Card' },
  template: overrides.template ?? {
    id: 'front-template',
    name: 'Front',
    aspectRatio: '63:88',
  },
  backingTemplate: overrides.backingTemplate,
  backingTemplateId: overrides.backingTemplateId ?? overrides.backingTemplate?.id ?? null,
});

describe('PDF production layout', () => {
  it('packs the bleed-bearing production face while keeping trim at exact physical size', () => {
    const [page] = createPdfPlacementPages({
      items: [makeCard()],
      forcedFace: 'front',
      printableWidthMm: 190,
      printableHeightMm: 277,
      marginMm: 10,
      spacingMm: 2,
      physical: true,
      includeCutLines: true,
    });

    expect(page).toHaveLength(1);
    const placement = page[0];
    const cropGutter = PDF_CROP_MARK_GAP_MM + PDF_CROP_MARK_LENGTH_MM;
    expect(placement).toMatchObject({
      imageX: 10 + cropGutter,
      imageY: 10 + cropGutter,
      imageWidth: 69,
      imageHeight: 94,
      trimWidth: 63,
      trimHeight: 88,
      bleedMm: 3,
      cellWidth: 69 + cropGutter * 2,
      cellHeight: 94 + cropGutter * 2,
    });
    expect(placement.trimX).toBe(placement.imageX + 3);
    expect(placement.trimY).toBe(placement.imageY + 3);
  });

  it('keeps crop marks outside the bleed image instead of drawing through production pixels', () => {
    const [page] = createPdfPlacementPages({
      items: [makeCard()],
      forcedFace: 'front',
      printableWidthMm: 190,
      printableHeightMm: 277,
      marginMm: 10,
      spacingMm: 0,
      physical: true,
      includeCutLines: true,
    });
    const placement = page[0];
    const segments = getPdfCropMarkSegments(placement);
    const leftBleedEdge = placement.trimX - placement.bleedMm;
    const topBleedEdge = placement.trimY - placement.bleedMm;

    expect(segments).toHaveLength(8);
    expect(segments[0].x2).toBeLessThan(leftBleedEdge);
    expect(segments[1].y2).toBeLessThan(topBleedEdge);
    expect(segments[0].y1).toBe(placement.trimY);
    expect(segments[1].x1).toBe(placement.trimX);
  });

  it('does not silently shrink physical card geometry to fit undersized paper', () => {
    expect(() => createPdfPlacementPages({
      items: [makeCard()],
      forcedFace: 'front',
      printableWidthMm: 60,
      printableHeightMm: 80,
      marginMm: 5,
      spacingMm: 0,
      physical: true,
      includeCutLines: false,
    })).toThrow(PdfProductionLayoutError);
  });

  it('preserves exact front placement for duplex backs and rejects mismatched physical formats', () => {
    const matchingCard = makeCard({
      backingTemplate: {
        id: 'back-template',
        name: 'Back',
        aspectRatio: '63:88',
        templateUsage: 'back-preset',
        freeformCanvas: { width: 630, height: 880, elements: [] },
      },
    });
    const [frontPage] = createPdfPlacementPages({
      items: [matchingCard],
      forcedFace: 'front',
      printableWidthMm: 190,
      printableHeightMm: 277,
      marginMm: 10,
      spacingMm: 2,
      physical: true,
      includeCutLines: true,
    });
    expect(createPdfDuplexBackPage(frontPage)).toEqual([
      { ...frontPage[0], face: 'back' },
    ]);

    const mismatchedCard = makeCard({
      backingTemplate: {
        id: 'business-back',
        name: 'Wrong size back',
        aspectRatio: '35:20',
        templateUsage: 'back-preset',
        freeformCanvas: { width: 1050, height: 600, elements: [] },
      },
    });
    const [mismatchedFront] = createPdfPlacementPages({
      items: [mismatchedCard],
      forcedFace: 'front',
      printableWidthMm: 190,
      printableHeightMm: 277,
      marginMm: 10,
      spacingMm: 2,
      physical: true,
      includeCutLines: false,
    });
    expect(() => createPdfDuplexBackPage(mismatchedFront)).toThrow(/front\/back physical geometry/i);
  });
});