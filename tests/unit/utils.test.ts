import { describe, expect, it } from 'vitest';
import {
  extractUniquePlaceholderKeys,
  parseCSV,
  replacePlaceholdersLocal,
  simplifyRatio,
  toTitleCase,
} from '@/lib/utils';
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
});
