import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CardAssetOption, FreeformCardElement } from '@/domain/templates';
import { CONSOLIDATED_ELEMENT_KITS } from '@/features/template-editor/lib/elementKits';
import { buildDividerLibrarySelection } from '@/features/template-editor/lib/dividerLibrarySelection';
import { appearanceToStyle, textureLayerMetadata, authoredCardFoundationStyle } from '@/features/card-rendering/model/appearance';
import { AppearanceSurface } from '@/features/card-rendering/components/AppearanceSurface';
import { VectorShapeElement } from '@/features/card-rendering/components/VectorShapeElement';
const seed = { id: 'divider', type: 'shape', x: 12, y: 34, rotation: 15, opacity: .7, zIndex: 2,
  ...CONSOLIDATED_ELEMENT_KITS.find(k => k.label === 'Divider / Rule')!.preset } as FreeformCardElement;
const asset = { id: 'vellum', name: 'Rules Vellum', kind: 'divider', tileMode: 'stretch', seamless: false, allowedTargets: ['divider'], url: '/vellum.svg', defaultWidth: 450, defaultHeight: 230 } as CardAssetOption;
describe('Divider Library geometry', () => {
  it('adopts catalog recommendations once without moving/rotating the element', () => {
    const updates = buildDividerLibrarySelection(seed, asset);
    expect(updates).toMatchObject({ width: 450, height: 230, appearance: { dividerAsset: '/vellum.svg' } });
    expect({ ...seed, ...updates }).toMatchObject({ x: 12, y: 34, rotation: 15, opacity: .7, zIndex: 2 });
    expect(buildDividerLibrarySelection(seed, { ...asset, defaultWidth: 420, defaultHeight: 72 })).toMatchObject({ width: 420, height: 72 });
    expect(buildDividerLibrarySelection({ ...seed, ...updates }, { ...asset, defaultWidth: 420, defaultHeight: 72 }).width).toBeUndefined();
  });
  it('preserves custom, already selected, and invalid recommendation geometry', () => {
    for (const element of [{ ...seed, height: 80 }, { ...seed, width: 600 }, { ...seed, appearance: { ...seed.appearance, dividerAsset: '/old.svg' } }]) {
      expect(buildDividerLibrarySelection(element, asset).width).toBeUndefined();
    }
    for (const defaultHeight of [undefined, 0, -1, NaN]) expect(buildDividerLibrarySelection(seed, { ...asset, defaultHeight }).height).toBeUndefined();
  });
});
describe('uploaded texture surface', () => {
  it.each([100, 25, 0])('keeps intensity %s on only the texture with source and layer properties intact', intensity => {
    const appearance = { assetSource: '/ornament.svg', material: { baseColor: '#fff', texture: { kind: 'uploaded' as const, imageSource: '/ink.png', intensity, textureScale: 80, blendMode: 'multiply', tileMode: 'repeat' as const }, gradient: { type: 'linear' as const, stops: [{ id: 'a', color: '#fff', position: 0 }, { id: 'b', color: '#999', position: 100 }] } } };
    const style = appearanceToStyle(appearance);
    expect(textureLayerMetadata(style)).toEqual({ index: 1, opacity: intensity / 100 });
    expect(style.backgroundSize).toBe('80px 80px, 80px 80px, auto');
    const html = renderToStaticMarkup(createElement(AppearanceSurface, { style }, 'Unfaded text'));
    expect(html).toContain('Unfaded text'); expect(html).toContain('/ink.png');
    if (intensity !== 100) { expect(html).toContain(`opacity:${intensity / 100}`); expect(html).toContain('mix-blend-mode:multiply'); }
    expect(appearance.material.texture.intensity).toBe(intensity);
    expect(textureLayerMetadata(authoredCardFoundationStyle({ cardBackgroundImageFit: 'contain' }, 'url(/foundation.png)', style))).toEqual({ index: 2, opacity: intensity / 100 });
  });
  it('keeps procedural intensity in its gradient and unspecified uploaded strength at legacy full opacity', () => {
    expect(textureLayerMetadata(appearanceToStyle({ material: { texture: { kind: 'grain', intensity: 25 } } }))).toBeUndefined();
    expect(textureLayerMetadata(appearanceToStyle({ material: { texture: { kind: 'uploaded', imageSource: '/ink.png' } } }))).toEqual({ index: 0, opacity: 1 });
  });
});
describe('vector authored stroke', () => {
  const shape = { ...seed, shapeKind: 'rectangle', shapeRole: undefined, width: 400, height: 300, strokeWidth: 16 } as FreeformCardElement;
  it.each([0, 60, 120])('uses authored radius %s in geometry and texture clip, in element units', radius => {
    const element = { ...shape, appearance: { border: { kind: 'solid' as const, width: 16, radius }, material: { texture: { kind: 'uploaded' as const, imageSource: '/ink.png' } } } };
    const html = renderToStaticMarkup(createElement(VectorShapeElement, { element, style: appearanceToStyle(element.appearance) }));
    expect(html).toContain(`rx="${radius / 4}" ry="${radius / 3}"`);
  });
  it('masks a double stroke gap, honors none, and does not round a path', () => {
    const render = (kind: 'double' | 'none', shapeKind = 'rectangle') => renderToStaticMarkup(createElement(VectorShapeElement, { element: { ...shape, shapeKind: shapeKind as FreeformCardElement['shapeKind'], appearance: { border: { kind, width: 16, radius: 60 } } } }));
    expect(render('double')).toContain('<mask'); expect(render('double')).toContain('stroke-width="5.333333333333333"');
    expect(render('none')).not.toContain('stroke-width'); expect(render('double', 'corner-frame')).not.toContain('rx=');
  });
});
