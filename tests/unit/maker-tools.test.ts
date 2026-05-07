import { describe, expect, it } from 'vitest';

import { CARD_DIVIDER_ASSETS, SEAMLESS_TEXTURE_ASSETS } from '@/lib/cardAssets';
import { getElementCapabilities, isDividerElement, SHAPE_PRIMITIVE_OPTIONS } from '@/lib/elementCapabilities';
import { reconstructFreeformCanvas } from '@/store/appStore';
import type { FreeformCardElement } from '@/types';

const shapeElement: Partial<FreeformCardElement> = { type: 'shape', shapeKind: 'rectangle' };
const dividerElement: Partial<FreeformCardElement> = { type: 'shape', shapeKind: 'line', shapeRole: 'divider' };

describe('Maker 2.0 tool capability map', () => {
  it('keeps shape primitives geometric and excludes line choices', () => {
    const values = SHAPE_PRIMITIVE_OPTIONS.map(option => option.value);

    expect(values).toContain('rectangle');
    expect(values).toContain('corner-frame');
    expect(values).not.toContain('line');
  });

  it('routes divider elements away from normal shape controls', () => {
    expect(isDividerElement(dividerElement)).toBe(true);
    expect(getElementCapabilities(dividerElement)).toEqual(expect.arrayContaining(['divider']));
    expect(getElementCapabilities(dividerElement)).not.toContain('shape');
    expect(getElementCapabilities(shapeElement)).toEqual(expect.arrayContaining(['shape', 'texture']));
    expect(getElementCapabilities(shapeElement)).not.toContain('divider');
  });

  it('exposes all divider assets only as divider-target assets', () => {
    expect(CARD_DIVIDER_ASSETS).toHaveLength(6);
    expect(CARD_DIVIDER_ASSETS.every(asset => asset.kind === 'divider')).toBe(true);
    expect(CARD_DIVIDER_ASSETS.every(asset => asset.allowedTargets.includes('divider'))).toBe(true);
    expect(CARD_DIVIDER_ASSETS.every(asset => asset.tileMode !== 'repeat')).toBe(true);
  });

  it('exposes only seamless repeat-safe texture assets in the texture picker', () => {
    expect(SEAMLESS_TEXTURE_ASSETS.length).toBeGreaterThan(0);
    expect(SEAMLESS_TEXTURE_ASSETS.every(asset => asset.kind === 'texture')).toBe(true);
    expect(SEAMLESS_TEXTURE_ASSETS.every(asset => asset.seamless)).toBe(true);
    expect(SEAMLESS_TEXTURE_ASSETS.every(asset => asset.tileMode === 'repeat')).toBe(true);
  });

  it('migrates legacy line shapes into divider elements without destroying payload data', () => {
    const canvas = reconstructFreeformCanvas({
      width: 400,
      height: 560,
      elements: [{
        id: 'legacy-line',
        type: 'shape',
        name: 'Old Line',
        shapeKind: 'line',
        content: '{{dividerLabel:"Act II"}}',
        x: 10,
        y: 20,
        width: 300,
        height: 8,
        zIndex: 1,
      }],
    });

    expect(canvas.elements[0].content).toBe('{{dividerLabel:"Act II"}}');
    expect(canvas.elements[0].shapeRole).toBe('divider');
    expect(canvas.elements[0].appearance?.dividerAsset).toBe('/card-assets/dividers/gilded-filigree.svg');
  });
});
