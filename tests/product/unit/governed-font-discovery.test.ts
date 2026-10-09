import { beforeEach, describe, expect, it, vi } from 'vitest';

const fixtures = vi.hoisted(() => ({
  fonts: [] as Array<{ name: string; value: string; category: string; cssFamily: string; sourceUrl: string }>,
  fail: false,
}));

vi.mock('@/features/pipeline/server/catalogCache', () => ({
  getCachedCardForgeStudioBootstrap: async () => {
    if (fixtures.fail) throw new Error('Pipeline registry unavailable');
    return {
      templates: { defaults: [], userTemplates: [] },
      styles: { styles: [] },
      fonts: { fonts: fixtures.fonts, registry: { configured: true, total: fixtures.fonts.length } },
    };
  },
  getCachedCardForgeStudioAssets: async () => ({
    assets: { textures: [], dividers: [], icons: [], imageAssets: [] },
  }),
}));

import { CARD_FONT_OPTIONS, cardFontFamilyToCss } from '@/domain/rendering';
import { searchStudioCreationLibrary } from '@/features/studio-documents/server/studioCreationLibrary';

beforeEach(() => {
  fixtures.fonts = [];
  fixtures.fail = false;
});

describe('governed font discovery and historical renderer compatibility', () => {
  it('never invents published Pipeline fonts from compatibility/runtime options', async () => {
    expect(CARD_FONT_OPTIONS.some((font) => font.value === 'font-cinzel')).toBe(true);
    expect(await searchStudioCreationLibrary({ kinds: ['font'] })).toEqual([]);
  });

  it('lists only actual published Pipeline font assets when they exist', async () => {
    fixtures.fonts = [{
      name: 'Approved Starter Serif',
      value: 'font-contributor-asset-1',
      category: 'Classic',
      cssFamily: '"font-contributor-asset-1", serif',
      sourceUrl: 'https://example.test/approved.woff2',
    }];
    expect(await searchStudioCreationLibrary({ kinds: ['font'] })).toEqual([{
      id: 'font-contributor-asset-1',
      name: 'Approved Starter Serif',
      kind: 'font',
      value: 'font-contributor-asset-1',
      category: 'Classic',
      url: 'https://example.test/approved.woff2',
    }]);
    expect((await searchStudioCreationLibrary({ kinds: ['font'] })).some((font) => font.id === 'font-cinzel')).toBe(false);
  });

  it('does not fabricate a fallback catalog on Pipeline unavailability', async () => {
    fixtures.fail = true;
    await expect(searchStudioCreationLibrary({ kinds: ['font'] })).rejects.toThrow(/unavailable/);
  });

  it('keeps existing saved font ids on their original renderer CSS stacks', () => {
    expect(cardFontFamilyToCss('font-cinzel')).toContain('--font-cardforge-cinzel');
    expect(cardFontFamilyToCss('font-barlow-condensed')).toContain('--font-cardforge-barlow-condensed');
    expect(cardFontFamilyToCss('font-serif')).toContain('Georgia');
  });
});
