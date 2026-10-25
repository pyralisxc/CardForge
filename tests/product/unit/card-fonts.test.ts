import { describe, expect, it } from 'vitest';

import {
  AVAILABLE_FONTS,
  CARD_FONT_OPTIONS,
  cardFontFamilyToCss,
  mapRegistryRowsToCardFontOptions,
  mergeCardFontOptions,
  createPipelineFontFaceCss,
} from '@/domain/rendering';

describe('card font registry', () => {
  it('keeps saved font ids available for existing templates', () => {
    const ids = AVAILABLE_FONTS.map((font) => font.value);

    expect(ids).toEqual(expect.arrayContaining([
      'font-sans',
      'font-serif',
      'font-mono',
      'font-cinzel',
      'font-lato',
      'font-trajan',
      'font-book',
      'font-humanist',
      'font-condensed',
      'font-engraved',
    ]));
  });

  it('adds local card-focused families to the selector list', () => {
    const ids = AVAILABLE_FONTS.map((font) => font.value);

    expect(ids).toEqual(expect.arrayContaining([
      'font-cormorant',
      'font-alegreya',
      'font-uncial',
      'font-orbitron',
      'font-rajdhani',
      'font-barlow-condensed',
      'font-spectral',
    ]));
  });

  it('resolves selector ids through the shared CSS stacks', () => {
    expect(cardFontFamilyToCss('font-cinzel')).toContain('--font-cardforge-cinzel');
    expect(cardFontFamilyToCss('font-orbitron')).toContain('--font-cardforge-orbitron');
    expect(cardFontFamilyToCss('font-contributor-aurora-display')).toBe('"font-contributor-aurora-display"');
    expect(cardFontFamilyToCss('Custom Card Font')).toBe('Custom Card Font');
  });

  it('keeps selector options backed by full registry entries', () => {
    expect(AVAILABLE_FONTS).toHaveLength(CARD_FONT_OPTIONS.length);
    expect(AVAILABLE_FONTS.map((font) => font.value)).toEqual(CARD_FONT_OPTIONS.map((font) => font.value));
  });

  it('maps published contributor font registry rows into selectable font options', () => {
    const fonts = mapRegistryRowsToCardFontOptions([
      {
        asset_id: 'contributor-fonts-display-1',
        name: 'Aurora Display',
        url: 'https://example.test/aurora.woff2',
        metadata: {
          category: 'Fantasy',
          fallback: 'serif',
        },
      },
      {
        asset_id: 'contributor-fonts-bad',
        name: '',
        url: 'https://example.test/bad.txt',
        metadata: {},
      },
    ]);

    expect(fonts).toEqual([
      {
        name: 'Aurora Display',
        value: 'font-contributor-contributor-fonts-display-1',
        category: 'Fantasy',
        cssFamily: '"font-contributor-contributor-fonts-display-1", serif',
        sourceUrl: 'https://example.test/aurora.woff2',
      },
    ]);
  });

  it('respects the exact published Font weight descriptor rather than inventing variable faces', () => {
    const options = mapRegistryRowsToCardFontOptions([
      { asset_id: 'official-static', name: 'Static Face', url: 'https://example.test/static.ttf', metadata: { category: 'Utility', fontWeightRange: '400' } },
      { asset_id: 'official-variable', name: 'Variable Face', url: 'https://example.test/variable.ttf', metadata: { category: 'Classic', fontWeightRange: '200 800' } },
    ]);
    const css = createPipelineFontFaceCss(options);
    expect(css).toContain('font-weight: 400;');
    expect(css).toContain('font-weight: 200 800;');
    expect(options.map(item => item.fontWeightRange)).toEqual(['400', '200 800']);
  });

  it('merges reviewed contributor fonts after built-ins without duplicate ids', () => {
    const fonts = mergeCardFontOptions(CARD_FONT_OPTIONS, [
      {
        name: 'System Sans Duplicate',
        value: 'font-sans',
        category: 'System',
        cssFamily: 'Duplicate',
        sourceUrl: 'https://example.test/duplicate.woff2',
      },
      {
        name: 'Aurora Display',
        value: 'font-contributor-aurora-display',
        category: 'Fantasy',
        cssFamily: '"Aurora Display", serif',
        sourceUrl: 'https://example.test/aurora.woff2',
      },
    ]);

    expect(fonts.at(-1)?.value).toBe('font-contributor-aurora-display');
    expect(fonts.filter((font) => font.value === 'font-sans')).toHaveLength(1);
  });
});
