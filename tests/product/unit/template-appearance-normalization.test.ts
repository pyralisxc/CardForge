import { describe, expect, it } from 'vitest';

import {
  normalizeAppearanceForElement,
  reconstructFreeformCanvas,
} from '@/domain/templates';
import { gradientToCss, textureToCss } from '@/features/card-rendering/model/appearance';

describe('freeform appearance normalization', () => {
  it('preserves the legacy badge hard edge exactly without synthesizing a parchment layer', () => {
    const source = { type: 'shape' as const, backgroundImageUrl: 'linear-gradient(180deg,#0f172a 0 24%,#f8fafc 24% 100%)', fillColor: '#f8fafc', borderRadius: 'rounded-md' };
    const appearance = normalizeAppearanceForElement(source);
    expect(appearance.material?.gradient).toMatchObject({ type: 'linear', angle: 180, stops: [
      { color: '#0f172a', position: 0, opacity: 1 }, { color: '#0f172a', position: 24, opacity: 1 },
      { color: '#f8fafc', position: 24, opacity: 1 }, { color: '#f8fafc', position: 100, opacity: 1 },
    ] });
    expect(gradientToCss(appearance.material?.gradient)).toBe('linear-gradient(180deg, rgba(15,23,42,1) 0%, rgba(15,23,42,1) 24%, rgba(248,250,252,1) 24%, rgba(248,250,252,1) 100%)');
    expect(textureToCss(appearance.material?.texture)).toBeUndefined();
    expect(appearance.rawCss).toBeUndefined();
    expect(appearance.material?.fillColor).toBe('#f8fafc');
    expect(appearance.border?.radius).toBe(6);
    expect(source.backgroundImageUrl).toBe('linear-gradient(180deg,#0f172a 0 24%,#f8fafc 24% 100%)');
  });

  it('retains the existing logo angle and implicit endpoint colors', () => {
    expect(normalizeAppearanceForElement({ type: 'image', backgroundImageUrl: 'linear-gradient(135deg,#38bdf8,#facc15)' }).material?.gradient).toMatchObject({
      type: 'linear', angle: 135, stops: [{ color: '#38bdf8', position: 0, opacity: 1 }, { color: '#facc15', position: 100, opacity: 1 }],
    });
    expect(normalizeAppearanceForElement({ backgroundImageUrl: 'LINEAR-GRADIENT(135deg,#38bdf8,#facc15)' }).rawCss).toBeUndefined();
  });

  it.each(['linear-gradient(90deg,#000,#fff),url(other.png)', 'linear-gradient(90deg,red,blue)', 'linear-gradient(90deg,#0008,#fff)', 'linear-gradient(90deg,#000 80%,#fff 20%)'])('does not reinterpret unsupported or layered CSS: %s', (backgroundImageUrl) => {
    expect(normalizeAppearanceForElement({ backgroundImageUrl }).material?.gradient).toBeUndefined();
  });

  it('never replaces a persisted authored appearance with inferred legacy colors or textures', () => {
    const appearance = { material: { baseColor: '#123456', texture: { kind: 'parchment' as const, intensity: 7 } } };
    expect(normalizeAppearanceForElement({ appearance, backgroundImageUrl: 'linear-gradient(135deg,#38bdf8,#facc15)' })).toBe(appearance);
  });

  it('keeps borderless text borderless when legacy stroke defaults are present', () => {
    expect(normalizeAppearanceForElement({
      type: 'text',
      borderWidth: '_none_',
      strokeWidth: 2,
      strokeColor: '#fbbf24',
    }).border).toMatchObject({ kind: 'none', width: 0 });
  });

  it('does not inject a legacy stroke into reconstructed borderless text', () => {
    const canvas = reconstructFreeformCanvas({
      width: 630,
      height: 880,
      elements: [{
        id: 'title',
        type: 'text',
        name: 'Title',
        x: 40,
        y: 40,
        width: 400,
        height: 60,
        zIndex: 1,
        content: '{{title:"Title"}}',
        borderWidth: '_none_',
      }],
    });

    expect(canvas.elements[0]).toMatchObject({
      borderWidth: '_none_',
      appearance: { border: { kind: 'none', width: 0 } },
    });
    expect(canvas.elements[0].strokeWidth).toBeUndefined();
  });
});
