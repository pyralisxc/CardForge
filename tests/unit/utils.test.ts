import { describe, expect, it } from 'vitest';
import {
  deriveImageFieldKey,
  extractUniquePlaceholderKeys,
  getBoundImageFieldKey,
  getImageFieldKeyForElement,
  parseCSV,
  parseRichText,
  replacePlaceholdersLocal,
  simplifyRatio,
  toTitleCase,
  unparseCSV,
} from '@/lib/utils';
import { buildTextBinding, isSimpleTextBinding, parseTextBinding } from '@/lib/textBindings';
import type { TCGCardTemplate } from '@/types';

describe('utils', () => {
  it('replaces placeholders with provided values and inline defaults', () => {
    const result = replacePlaceholdersLocal(
      '{{name}} - {{type:"Artifact"}} - {{missing}}',
      { name: 'Dragon Hoard' },
      true
    );

    expect(result).toBe('Dragon Hoard - Artifact - ');
  });

  it('preserves multiline text bindings through parse and replacement', () => {
    const binding = buildTextBinding('rulesText', 'Line one\n==Line two==');

    expect(binding).toBe('{{rulesText:"Line one\\n==Line two=="}}');
    expect(parseTextBinding(binding)).toEqual({
      field: 'rulesText',
      fallback: 'Line one\n==Line two==',
    });
    expect(replacePlaceholdersLocal(binding, {}, true)).toBe('Line one\n==Line two==');
  });

  it('detects simple binding strings and ignores full expressions', () => {
    expect(isSimpleTextBinding('{{rulesText:"Deal 1"}}')).toBe(true);
    expect(isSimpleTextBinding('When {{keyword:"Flying"}} enters, draw {{cards:"1"}}')).toBe(false);
  });

  it('parses highlight spans without stripping surrounding text', () => {
    expect(parseRichText('Before ==marked== after')).toEqual([
      { text: 'Before ' },
      { text: 'marked', highlight: 'rgba(255,215,0,0.35)' },
      { text: ' after' },
    ]);
  });

  it('extracts unique placeholders from freeform elements and card background', () => {
    const template: TCGCardTemplate = {
      id: 'template-1',
      name: 'Template',
      aspectRatio: '63:88',
      cardBackgroundImageUrl: '{{cardBg}}',
      freeformCanvas: {
        width: 630,
        height: 880,
        elements: [
          {
            id: 'text-1',
            type: 'text',
            name: 'Title',
            x: 0,
            y: 0,
            width: 200,
            height: 50,
            zIndex: 1,
            content: '{{cardName:"Sample"}}',
            backgroundImageUrl: '{{sectionBg}}',
          },
          {
            id: 'image-1',
            type: 'image',
            name: 'Art',
            x: 0,
            y: 60,
            width: 200,
            height: 120,
            zIndex: 2,
            imageSource: 'artworkUrl',
          },
        ],
      },
    };

    const keys = extractUniquePlaceholderKeys(template);
    expect(keys.find(k => k.key === 'cardName')?.defaultValue).toBe('Sample');
    expect(keys.find(k => k.key === 'sectionBg')).toBeDefined();
    expect(keys.find(k => k.key === 'artworkUrl')).toBeDefined();
    expect(keys.find(k => k.key === 'cardBg')).toBeDefined();
  });

  it('extracts unique placeholders from freeform elements', () => {
    const template: TCGCardTemplate = {
      id: 'template-freeform',
      name: 'Freeform',
      aspectRatio: '63:88',
      freeformCanvas: {
        width: 630,
        height: 880,
        elements: [
          {
            id: 'text-1',
            type: 'text',
            name: 'Title',
            x: 0,
            y: 0,
            width: 200,
            height: 50,
            zIndex: 1,
            content: '{{cardName:"Sample"}}',
          },
          {
            id: 'image-1',
            type: 'image',
            name: 'Art',
            x: 0,
            y: 60,
            width: 200,
            height: 120,
            zIndex: 2,
            imageSource: 'artworkUrl',
            backgroundImageUrl: '{{frameBg}}',
          },
        ],
      },
    };

    expect(extractUniquePlaceholderKeys(template)).toEqual([
      { key: 'cardName', defaultValue: 'Sample' },
      { key: 'artworkUrl' },
      { key: 'frameBg' },
    ]);
  });

  it('derives image field keys for placeholder and fixed-source image layers', () => {
    expect(
      getBoundImageFieldKey({
        imageSource: '{{artworkUrl}}',
        content: undefined,
      })
    ).toBe('artworkUrl');

    expect(
      getImageFieldKeyForElement({
        id: 'hero-art-layer',
        name: 'Hero Art',
        imageSource: 'https://example.com/default-art.png',
      })
    ).toBe('image_hero_art_hero_art_layer');

    expect(
      deriveImageFieldKey({
        id: 'layer-1',
        name: 'Frame Art',
      })
    ).toBe('image_frame_art_layer_1');
  });

  it('adds deterministic image placeholders for fixed image layers', () => {
    const template: TCGCardTemplate = {
      id: 'template-fixed-image',
      name: 'Fixed Image',
      aspectRatio: '63:88',
      freeformCanvas: {
        width: 630,
        height: 880,
        elements: [
          {
            id: 'hero-art-layer',
            type: 'image',
            name: 'Hero Art',
            x: 0,
            y: 60,
            width: 200,
            height: 120,
            zIndex: 1,
            imageSource: 'https://example.com/default-art.png',
          },
        ],
      },
    };

    expect(extractUniquePlaceholderKeys(template)).toEqual([
      { key: 'image_hero_art_hero_art_layer', defaultValue: 'https://example.com/default-art.png' },
    ]);
  });

  it('formats technical field names for labels', () => {
    expect(toTitleCase('mana_cost')).toBe('Mana Cost');
    expect(toTitleCase('cardName')).toBe('Card Name');
  });

  it('simplifies valid ratios and falls back for invalid values', () => {
    expect(simplifyRatio(1920, 1080)).toBe('16:9');
    expect(simplifyRatio(0, 1080)).toBe('63:88');
  });

  it('parses CSV with quoted commas, escaped quotes, CRLF, and quoted newlines', () => {
    const csv = 'name,text\r\n"Dragon, Elder","Says ""hello"""\r\nScout,"Line one\nLine two"';

    expect(parseCSV(csv)).toEqual([
      ['name', 'text'],
      ['Dragon, Elder', 'Says "hello"'],
      ['Scout', 'Line one\nLine two'],
    ]);
  });

  it('throws on malformed CSV instead of guessing through broken quotes', () => {
    expect(() => parseCSV('name,text\n"Dragon, Elder,Says hello')).toThrow();
  });

  it('generates CSV with quoted multiline and comma-bearing cells', () => {
    const csv = unparseCSV([
      ['name', 'text'],
      ['Dragon, Elder', 'Line one\nLine two'],
    ]);

    expect(csv).toBe('name,text\n"Dragon, Elder","Line one\nLine two"');
    expect(parseCSV(csv)).toEqual([
      ['name', 'text'],
      ['Dragon, Elder', 'Line one\nLine two'],
    ]);
  });
});
