import { describe, expect, it } from 'vitest';

import { extractTemplateFieldDefinitions } from '@/lib/templateFields';
import type { TCGCardTemplate } from '@/types';

describe('extractTemplateFieldDefinitions', () => {
  it('derives shared generator field metadata from template usage', () => {
    const template: TCGCardTemplate = {
      id: 'template-1',
      name: 'Template',
      aspectRatio: '63:88',
      freeformCanvas: {
        width: 630,
        height: 880,
        elements: [
          {
            id: 'text-1',
            type: 'text',
            name: 'Rules',
            x: 0,
            y: 0,
            width: 200,
            height: 120,
            zIndex: 1,
            content: '{{rulesText:"Deal 1 damage."}}',
          },
          {
            id: 'text-2',
            type: 'text',
            name: 'Title',
            x: 0,
            y: 0,
            width: 200,
            height: 40,
            zIndex: 2,
            content: '{{cardName:"Astral Relic"}}',
          },
          {
            id: 'image-1',
            type: 'image',
            name: 'Artwork',
            x: 0,
            y: 0,
            width: 200,
            height: 200,
            zIndex: 0,
            content: 'artworkUrl',
            imageSource: 'artworkUrl',
          },
        ],
      },
    };

    const fields = extractTemplateFieldDefinitions(template);

    expect(fields).toEqual([
      {
        key: 'rulesText',
        label: 'Rules Text',
        control: 'textarea',
        editor: 'rich-textarea',
        defaultValue: 'Deal 1 damage.',
        required: true,
        isImage: false,
        isMultiline: true,
        supportsRichText: true,
        helperText: 'Use the formatting toolbar for highlight, lists, emphasis, and inline color.',
      },
      {
        key: 'cardName',
        label: 'Card Name',
        control: 'input',
        editor: 'plain-input',
        defaultValue: 'Astral Relic',
        required: true,
        isImage: false,
        isMultiline: false,
        supportsRichText: true,
        helperText: 'This field supports inline rich-text markers such as ==highlight== and [color:#hex]text[/color].',
      },
      {
        key: 'artworkUrl',
        label: 'Artwork Url',
        control: 'input',
        editor: 'plain-input',
        defaultValue: undefined,
        required: false,
        isImage: true,
        isMultiline: false,
        supportsRichText: false,
        helperText: undefined,
      },
    ]);
  });

  it('marks known optional metadata fields as not required', () => {
    const template: TCGCardTemplate = {
      id: 'template-2',
      name: 'Template Optional',
      aspectRatio: '63:88',
      freeformCanvas: {
        width: 630,
        height: 880,
        elements: [
          {
            id: 'text-1',
            type: 'text',
            name: 'Flavor',
            x: 0,
            y: 0,
            width: 200,
            height: 120,
            zIndex: 1,
            content: '{{flavorText}}',
          },
        ],
      },
    };

    const [field] = extractTemplateFieldDefinitions(template);
    expect(field.key).toBe('flavorText');
    expect(field.required).toBe(false);
  });

  it('marks placeholder-bound image layers as image fields', () => {
    const template: TCGCardTemplate = {
      id: 'template-3',
      name: 'Template Placeholder Image',
      aspectRatio: '63:88',
      freeformCanvas: {
        width: 630,
        height: 880,
        elements: [
          {
            id: 'image-1',
            type: 'image',
            name: 'Artwork',
            x: 0,
            y: 0,
            width: 200,
            height: 200,
            zIndex: 1,
            imageSource: '{{artworkUrl}}',
          },
        ],
      },
    };

    const [field] = extractTemplateFieldDefinitions(template);
    expect(field.key).toBe('artworkUrl');
    expect(field.isImage).toBe(true);
    expect(field.required).toBe(false);
  });

  it('adds a deterministic image field for fixed-source image layers', () => {
    const template: TCGCardTemplate = {
      id: 'template-4',
      name: 'Template Fixed Art',
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
            y: 0,
            width: 200,
            height: 200,
            zIndex: 1,
            imageSource: 'https://example.com/default-art.png',
          },
        ],
      },
    };

    const [field] = extractTemplateFieldDefinitions(template);
    expect(field.key).toBe('image_hero_art_hero_art_layer');
    expect(field.isImage).toBe(true);
    expect(field.defaultValue).toBe('https://example.com/default-art.png');
    expect(field.required).toBe(false);
  });
});