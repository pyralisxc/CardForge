import { describe, expect, it } from 'vitest';

import { getCardExportDimensionsPx, getCardExportHeightPx, getCardPhysicalSizeMm } from '@/domain/rendering';
import type { DisplayCard } from '@/domain/rendering';


const makeCard = (aspectRatio: string): DisplayCard => ({
  uniqueId: 'card-1',
  data: {},
  template: {
    id: 'template-1',
    name: 'Template',
    aspectRatio,
  },
});

describe('card preview export sizing', () => {
  it('derives pixel height from the same template aspect used by preview', () => {
    expect(getCardExportHeightPx(makeCard('63:88'), 744)).toBe(1039);
  });

  it('uses the canonical trim size for legacy standard ratios', () => {
    expect(getCardPhysicalSizeMm(makeCard('63:88'))).toEqual({ widthMm: 63, heightMm: 88 });
  });

  it('derives raster dimensions from each template physical size at the requested dpi', () => {
    expect(getCardExportDimensionsPx(makeCard('63:88'), 300)).toEqual({ widthPx: 744, heightPx: 1039 });
    expect(getCardExportDimensionsPx(makeCard('35:20'), 300)).toEqual({ widthPx: 1050, heightPx: 600 });
    expect(getCardExportDimensionsPx(makeCard('85:110'), 300)).toEqual({ widthPx: 2550, heightPx: 3300 });
  });

  it('normalizes proportion-only ratios to standard card height', () => {
    const size = getCardPhysicalSizeMm(makeCard('5:7'));
    expect(size.widthMm).toBeCloseTo(62.857);
    expect(size.heightMm).toBe(88);
  });

  it('scales physical size into a smaller printable area without changing aspect', () => {
    expect(getCardPhysicalSizeMm(makeCard('63:88'), 50, 50)).toEqual({ widthMm: 35.795, heightMm: 50 });
  });
});
