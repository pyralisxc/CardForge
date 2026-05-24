import { describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

import { appearanceToElementRenderFields, appearanceToStyle, gradientToCss, normalizeAppearanceForElement, textureToCss } from '@/lib/appearance';
import { stylePresetPayloadSchema } from '@/lib/apiValidation';
import type { FreeformCardElement } from '@/types';

const baseElement: FreeformCardElement = {
  id: 'element-1',
  type: 'text',
  name: 'Rules',
  x: 0,
  y: 0,
  width: 200,
  height: 100,
  zIndex: 1,
  content: '{{rulesText:"Draw a card."}}',
};

describe('structured appearance helpers', () => {
  it('converts gradients and textures to layered CSS', () => {
    const gradient = gradientToCss({
      type: 'linear',
      angle: 90,
      stops: [
        { id: 'a', color: '#7a52cc', position: 0, opacity: 0.8 },
        { id: 'b', color: '#d5ad54', position: 100, opacity: 0.35 },
      ],
    });
    const texture = textureToCss({ kind: 'etched', intensity: 50, scale: 8 });

    expect(gradient).toContain('linear-gradient(90deg');
    expect(gradient).toContain('rgba(122,82,204,0.8)');
    expect(texture).toContain('repeating-linear-gradient');
  });

  it('renders structured appearance into CSS for previews and PDF capture', () => {
    const style = appearanceToStyle({
      material: {
        baseColor: '#120f0b',
        textColor: '#f7e6b0',
        texture: { kind: 'foil', intensity: 40, scale: 12 },
      },
      border: { kind: 'relic', color: '#d5ad54', width: 4, radius: 8 },
      effects: { glow: 20, innerHighlight: 30 },
    });

    expect(style.backgroundColor).toBe('#120f0b');
    expect(style.backgroundImage).toContain('repeating-linear-gradient');
    expect(style.borderColor).toBe('#d5ad54');
    expect(style.boxShadow).toContain('0 0 20px');
  });

  it('renders asset-backed textures and dividers as file URLs', () => {
    const textureStyle = appearanceToStyle({
      material: {
        baseColor: '#f4e2ba',
        texture: {
          kind: 'uploaded',
          assetSource: '/card-assets/textures/parchment-grain.svg',
          imageSource: '/card-assets/textures/parchment-grain.svg',
          textureScale: 160,
          blendMode: 'multiply',
          tileMode: 'repeat',
        },
      },
      border: { kind: 'solid', color: '#d5ad54', width: 1 },
    });
    const dividerStyle = appearanceToStyle({
      dividerAsset: '/card-assets/dividers/gem-center.svg',
      assetKind: 'divider',
      tileMode: 'stretch',
      material: {
        baseColor: 'transparent',
        texture: { kind: 'none' },
      },
      border: { kind: 'none', width: 0 },
    });

    expect(textureStyle.backgroundImage).toContain('url(/card-assets/textures/parchment-grain.svg)');
    expect(textureStyle.backgroundSize).toBe('160px 160px');
    expect(textureStyle.backgroundRepeat).toBe('repeat');
    expect(textureStyle.backgroundBlendMode).toBe('multiply');

    expect(dividerStyle.backgroundImage).toContain('url(/card-assets/dividers/gem-center.svg)');
    expect(dividerStyle.backgroundSize).toBe('100% 100%');
    expect(dividerStyle.backgroundRepeat).toBe('no-repeat');
  });

  it('derives structured appearance from flat element styling', () => {
    const appearance = normalizeAppearanceForElement({
      ...baseElement,
      backgroundColor: '#15100b',
      backgroundImageUrl: 'linear-gradient(180deg, #fff6d8, #c69343)',
      textColor: '#20140a',
      borderColor: '#d5ad54',
      borderWidth: 'border-4',
      borderRadius: 'rounded-lg',
    });

    expect(appearance.material?.baseColor).toBe('#15100b');
    expect(appearance.material?.texture?.kind).toBe('parchment');
    expect(appearance.border?.width).toBe(4);
    expect(appearance.border?.radius).toBe(8);
  });

  it('preserves content fields while applying structured appearance render fields', () => {
    const element = {
      ...baseElement,
      content: '{{cardName:"Emberclaw"}}',
      appearance: {
        material: { baseColor: '#160d25', textColor: '#f4eaff' },
        border: { kind: 'foil' as const, color: '#d5ad54', width: 3, radius: 10 },
      },
    };

    const updates = appearanceToElementRenderFields(element);

    expect(element.content).toBe('{{cardName:"Emberclaw"}}');
    expect(updates.backgroundColor).toBe('#160d25');
    expect(updates.textColor).toBe('#f4eaff');
    expect(updates.borderColor).toBe('#d5ad54');
  });

  it('loads premium CardForge style presets that reference shipped asset URLs', async () => {
    const styleFiles = [
      'data/styles/material-arcane-forge-parchment.json',
      'data/styles/material-obsidian-neon-premium.json',
      'data/styles/frame-gilded-relic-premium.json',
      'data/styles/frame-ttrpg-vellum-premium.json',
    ];

    await Promise.all(styleFiles.map(async (relativePath) => {
      const raw = await fs.readFile(path.join(process.cwd(), relativePath), 'utf8');
      const parsedJson = JSON.parse(raw);
      const parsed = stylePresetPayloadSchema.safeParse(parsedJson);
      expect(parsed.success, `${relativePath} should be a valid style preset`).toBe(true);
      expect(raw).toContain('/card-assets/');
    }));
  });
});
