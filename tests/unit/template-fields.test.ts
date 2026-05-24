import { describe, expect, it } from 'vitest';

import { extractTemplateFieldDefinitions } from '@/lib/templateFields';
import { buildScopedFieldDataKey, buildStaticSegmentFieldKey } from '@/lib/textBindings';
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
        editor: 'rules-textarea',
        contentModel: 'rulesBlocks',
        defaultValue: 'Deal 1 damage.',
        required: true,
        isImage: false,
        isMultiline: true,
        supportsRichText: true,
        sourceElementId: 'text-1',
        sourceElementName: 'Rules',
        sourceElementPreview: 'Deal 1 damage.',
        sourceElementContent: '{{rulesText:"Deal 1 damage."}}',
        helperText: 'Use one field for rules blocks. Prefix paragraphs with [ability], [effect], [reminder], [flavor], or [subtitle] to change how each block renders.',
      },
      {
        key: 'cardName',
        label: 'Card Name',
        control: 'textarea',
        editor: 'rich-textarea',
        contentModel: 'richText',
        defaultValue: 'Astral Relic',
        required: true,
        isImage: false,
        isMultiline: false,
        supportsRichText: true,
        sourceElementId: 'text-2',
        sourceElementName: 'Title',
        sourceElementPreview: 'Astral Relic',
        sourceElementContent: '{{cardName:"Astral Relic"}}',
        helperText: 'Use the visual editor toolbar for highlight, lists, emphasis, and inline color.',
      },
      {
        key: 'artworkUrl',
        label: 'Artwork Url',
        control: 'input',
        editor: 'plain-input',
        contentModel: 'image',
        defaultValue: undefined,
        required: false,
        isImage: true,
        isMultiline: false,
        supportsRichText: false,
        sourceElementId: undefined,
        sourceElementName: undefined,
        sourceElementPreview: undefined,
        sourceElementContent: undefined,
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

  it('uses explicit field metadata from bound text elements', () => {
    const template: TCGCardTemplate = {
      id: 'template-5',
      name: 'Template Explicit Rules',
      aspectRatio: '63:88',
      freeformCanvas: {
        width: 630,
        height: 880,
        elements: [
          {
            id: 'text-1',
            type: 'text',
            name: 'Rules Box',
            x: 0,
            y: 0,
            width: 200,
            height: 160,
            zIndex: 1,
            content: '{{rulesText:"[ability] Flying"}}',
            generatorFieldKind: 'rules',
            generatorFieldRequired: true,
            textAutoFit: true,
            textMinFontSizePx: 8,
          },
        ],
      },
    };

    const [field] = extractTemplateFieldDefinitions(template);
    expect(field.contentModel).toBe('rulesBlocks');
    expect(field.editor).toBe('rules-textarea');
    expect(field.required).toBe(true);
    expect(field.helperText).toContain('[ability]');
  });

  it('keeps single-line rich text fields rich-text editable in the generator', () => {
    const template: TCGCardTemplate = {
      id: 'template-6',
      name: 'Inline Variable Template',
      aspectRatio: '63:88',
      fieldContracts: [
        {
          key: 'title_var_1',
          elementId: 'text-1',
          type: 'richText',
          multiline: false,
        },
      ],
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
            height: 40,
            zIndex: 1,
            content: 'Legendary {{title_var_1:"Relic"}}',
          },
        ],
      },
    };

    const fields = extractTemplateFieldDefinitions(template);
    expect(fields).toHaveLength(2);

    const baseField = fields.find((field) => field.key === buildStaticSegmentFieldKey('text-1', 0));
    expect(baseField).toMatchObject({
      label: 'Title',
      contentModel: 'richText',
      editor: 'rich-textarea',
      control: 'textarea',
      defaultValue: 'Legendary ',
      sourceElementName: 'Title',
    });

    const field = fields.find((item) => item.key === 'title_var_1');
    expect(field).toBeDefined();
    expect(field?.contentModel).toBe('richText');
    expect(field?.editor).toBe('rich-textarea');
    expect(field?.control).toBe('textarea');
    expect(field?.sourceElementName).toBe('Title');
    expect(field?.sourceElementPreview).toBe('Legendary [Title Var 1]');
    expect(field?.sourceElementContent).toBe('Legendary {{title_var_1:"Relic"}}');
  });

  it('uses the variable name when no field contract label is defined', () => {
    const template: TCGCardTemplate = {
      id: 'template-7',
      name: 'Inline Variable Template',
      aspectRatio: '63:88',
      freeformCanvas: {
        width: 630,
        height: 880,
        elements: [
          {
            id: 'text-1',
            type: 'text',
            name: 'Headline',
            x: 0,
            y: 0,
            width: 200,
            height: 40,
            zIndex: 1,
            content: 'Ability: {{headline_var_1:"Flying"}}',
          },
        ],
      },
    };

    const field = extractTemplateFieldDefinitions(template).find((item) => item.key === 'headline_var_1');
    expect(field?.label).toBe('Headline Var 1');
    expect(field?.sourceElementPreview).toBe('Ability: [Headline Var 1]');
  });

  it('keeps scoped contracts with the same placeholder key as separate editable fields', () => {
    const template: TCGCardTemplate = {
      id: 'template-scoped-collision',
      name: 'Scoped Collision Template',
      aspectRatio: '63:88',
      fieldContracts: [
        {
          key: 'title',
          elementId: 'name-text',
          label: 'Card Title',
          type: 'richText',
          required: true,
          example: 'Ashen Crown',
        },
        {
          key: 'title',
          elementId: 'subtitle-text',
          label: 'Subtitle',
          type: 'text',
          required: false,
          example: 'Relic',
        },
      ],
      freeformCanvas: {
        width: 630,
        height: 880,
        elements: [
          {
            id: 'name-text',
            type: 'text',
            name: 'Name',
            x: 0,
            y: 0,
            width: 200,
            height: 40,
            zIndex: 1,
            content: '{{title:"Ashen Crown"}}',
          },
          {
            id: 'subtitle-text',
            type: 'text',
            name: 'Subtitle',
            x: 0,
            y: 50,
            width: 200,
            height: 40,
            zIndex: 2,
            content: '{{title:"Relic"}}',
          },
        ],
      },
    };

    const fields = extractTemplateFieldDefinitions(template);

    expect(fields).toHaveLength(2);
    expect(fields.map((field) => field.key)).toEqual([
      buildScopedFieldDataKey('name-text', 'title'),
      buildScopedFieldDataKey('subtitle-text', 'title'),
    ]);
    expect(fields.map((field) => field.label)).toEqual(['Card Title', 'Subtitle']);
    expect(fields.map((field) => field.sourceElementId)).toEqual(['name-text', 'subtitle-text']);
    expect(fields.map((field) => field.defaultValue)).toEqual(['Ashen Crown', 'Relic']);
  });

  it('adds a base text field for mixed static and variable text elements', () => {
    const template: TCGCardTemplate = {
      id: 'template-8',
      name: 'Rules Box Template',
      aspectRatio: '63:88',
      freeformCanvas: {
        width: 630,
        height: 880,
        elements: [
          {
            id: 'rules-1',
            type: 'text',
            name: 'Rules Box',
            x: 0,
            y: 0,
            width: 220,
            height: 140,
            zIndex: 1,
            content: '{{Ability:"**Flying**"}}\nWhen Emberclaw Whelp enters the battlefield, it deals 1 damage to any target.\n\n{{SubText:"_Small in size, fierce in spirit._"}}',
          },
        ],
      },
    };

    const fields = extractTemplateFieldDefinitions(template);
    expect(fields.map((field) => field.label)).toEqual(['Rules Box', 'Ability', 'Sub Text']);
    expect(fields[0].key).toBe(buildStaticSegmentFieldKey('rules-1', 1));
    expect(fields[0].defaultValue).toContain('When Emberclaw Whelp enters the battlefield');
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
