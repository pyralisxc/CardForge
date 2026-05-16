import { describe, expect, it } from 'vitest';

import { getCardExportHeightPx, getCardPhysicalSizeMm } from '@/lib/cardExportGeometry';
import type { DisplayCard } from '@/types';

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

  it('treats standard mm-like ratios as physical millimeters', () => {
    expect(getCardPhysicalSizeMm(makeCard('63:88'))).toEqual({ widthMm: 63, heightMm: 88 });
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
