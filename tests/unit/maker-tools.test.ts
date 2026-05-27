import { describe, expect, it } from 'vitest';

import { buildDiscoveredCardAsset } from '@/lib/cardAssets';
import { getElementCapabilities, isDividerElement, SHAPE_PRIMITIVE_OPTIONS } from '@/lib/elementCapabilities';
import { reconstructFreeformCanvas } from '@/store/appStore';
import type { FreeformCardElement } from '@/types';

const shapeElement: Partial<FreeformCardElement> = { type: 'shape', shapeKind: 'rectangle' };
const dividerElement: Partial<FreeformCardElement> = { type: 'shape', shapeKind: 'line', shapeRole: 'divider' };

describe('Card Template Maker tool capability map', () => {
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

  it('builds divider registry assets only as divider-target assets', () => {
    const dividerAsset = buildDiscoveredCardAsset({
      url: '/card-assets/dividers/gilded-filigree.svg',
      kind: 'divider',
      relativePath: 'gilded-filigree.svg',
    });

    expect(dividerAsset.kind).toBe('divider');
    expect(dividerAsset.allowedTargets).toContain('divider');
    expect(dividerAsset.tileMode).not.toBe('repeat');
  });

  it('builds registry texture assets with repeat-safe defaults', () => {
    const textureAsset = buildDiscoveredCardAsset({
      url: '/card-assets/textures/arcane-hatch.svg',
      kind: 'texture',
      relativePath: 'arcane-hatch.svg',
    });

    expect(textureAsset.kind).toBe('texture');
    expect(textureAsset.seamless).toBe(true);
    expect(textureAsset.tileMode).toBe('repeat');
  });

  it('normalizes divider line shapes without destroying payload data', () => {
    const canvas = reconstructFreeformCanvas({
      width: 400,
      height: 560,
      elements: [{
        id: 'divider-line',
        type: 'shape',
        name: 'Divider Line',
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
