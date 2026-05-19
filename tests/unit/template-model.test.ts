import { describe, expect, it } from 'vitest';

import { getDefaultGridSizeForCanvas } from '@/lib/templateModel';

describe('template model grid defaults', () => {
  it('derives a centered grid from the template dimensions', () => {
    const gridSize = getDefaultGridSizeForCanvas(630, 880);

    expect(gridSize).toBeGreaterThanOrEqual(17);
    expect(gridSize).toBeLessThanOrEqual(28);
    expect(880 % gridSize).toBe(0);
    expect((880 / gridSize) % 2).toBe(0);
  });

  it('scales the default grid for non-card template dimensions', () => {
    const cardGrid = getDefaultGridSizeForCanvas(630, 880);
    const sheetGrid = getDefaultGridSizeForCanvas(850, 1100);

    expect(sheetGrid).toBeGreaterThan(cardGrid);
    expect(1100 % sheetGrid).toBe(0);
  });
});
