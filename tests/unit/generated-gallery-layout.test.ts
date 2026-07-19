import { describe, expect, it } from 'vitest';

import { resolveGeneratedGalleryColumnCount } from '@/features/card-generator/lib/generatedGalleryLayout';

describe('generated gallery layout', () => {
  it('fills every row that fits in the available review space', () => {
    expect(resolveGeneratedGalleryColumnCount({
      availableWidth: 760,
      minimumItemWidth: 144,
      gap: 12,
      requestedColumns: 'auto',
    })).toBe(4);
  });

  it('honors a chosen row size without overflowing a narrow review space', () => {
    expect(resolveGeneratedGalleryColumnCount({
      availableWidth: 400,
      minimumItemWidth: 144,
      gap: 12,
      requestedColumns: '6',
    })).toBe(2);
  });

  it('keeps a single output usable when the gallery has not measured yet', () => {
    expect(resolveGeneratedGalleryColumnCount({
      availableWidth: 0,
      minimumItemWidth: 144,
      gap: 12,
      requestedColumns: '4',
    })).toBe(1);
  });
});
