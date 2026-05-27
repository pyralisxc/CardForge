import { describe, expect, it } from 'vitest';

import { borderWidthClassToPixels, borderWidthClassToStyle, radiusClassToCss } from '@/lib/freeformElementRender';

describe('freeform element render helpers', () => {
  it('tolerates malformed legacy border values during preview rendering', () => {
    expect(borderWidthClassToPixels({ width: 4 })).toBe(0);
    expect(borderWidthClassToPixels(3)).toBe(3);
    expect(borderWidthClassToStyle({ width: 4 })).toEqual({ borderWidth: 0 });
    expect(radiusClassToCss({ radius: 8 })).toBeUndefined();
    expect(radiusClassToCss(8)).toBe('8px');
  });
});
