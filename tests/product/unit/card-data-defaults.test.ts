import { describe, expect, it } from 'vitest';

import type { TCGCardTemplate, TemplateFieldDefinition } from '@/domain/templates';
import {
  getMissingRequiredFieldLabels,
  initializeCardDataFromTemplate,
  completeCardDataWithTemplateDefaults,
} from '@/features/card-generator/lib/cardDataDefaults';

const requiredField: TemplateFieldDefinition = {
  key: 'Title',
  label: 'Title',
  control: 'input',
  editor: 'text-editor',
  contentModel: 'text',
  required: true,
  isImage: false,
  isMultiline: false,
  supportsRichText: true,
};

describe('card data defaults', () => {
  it('resolves saved preview defaults before inline fallbacks while preserving explicit empty and companion values', () => {
    const template: TCGCardTemplate = {
      id: 'review-copy', name: 'Review copy', aspectRatio: '63:88',
      fieldContracts: [
        { key: 'Ability', type: 'text', defaultValue: 'Complete saved ability' },
        { key: 'Title', type: 'text', defaultValue: 'Default title' },
      ],
      freeformCanvas: { width: 630, height: 880, elements: [
        { id: 'rules', name: 'Rules', type: 'text', content: '{{Ability:"Inline fallback"}}', x: 0, y: 0, width: 100, height: 100, zIndex: 0 },
      ] },
      templatePreviewData: { Title: '', '__cardforgeFieldStyle.Ability.fontWeight': 'font-bold' },
    };
    const [, data] = initializeCardDataFromTemplate(template, template.templatePreviewData);
    expect(data).toMatchObject({ Ability: 'Complete saved ability', Title: '', '__cardforgeFieldStyle.Ability.fontWeight': 'font-bold' });
    expect(template.freeformCanvas?.elements[0].content).toBe('{{Ability:"Inline fallback"}}');
  });

  it('does not insert an image override when editing a card that uses its template artwork', () => {
    const template: TCGCardTemplate = {
      id: 'art', name: 'Artwork', aspectRatio: '63:88',
      fieldContracts: [{ key: 'Artwork', label: 'Artwork', type: 'image', required: false }],
      freeformCanvas: { width: 630, height: 880, elements: [
        { id: 'art', type: 'image', name: 'Artwork', x: 0, y: 0, width: 100, height: 100, zIndex: 0, imageSource: '{{Artwork}}' },
      ] },
    };
    const [fields, data] = initializeCardDataFromTemplate(template, { Title: 'Keep me' }, true);
    expect(data.Artwork).toBeUndefined();
    expect(data.Title).toBe('Keep me');
    expect(completeCardDataWithTemplateDefaults(fields, data, true)).toEqual(data);
    const [, overridden] = initializeCardDataFromTemplate(template, { Artwork: 'https://example.com/art.png' }, true);
    expect(overridden.Artwork).toBe('https://example.com/art.png');
  });
  it('preserves detailed field overrides while initializing editable values', () => {
    const template: TCGCardTemplate = {
      id: 'generated-back',
      name: 'Generated Back',
      aspectRatio: '63:88',
      fieldContracts: [{ key: 'Title', label: 'Title', type: 'text', required: true }],
    };
    const [, data] = initializeCardDataFromTemplate(template, {
      Title: 'Custom back title',
      '__cardforgeFieldStyle.Title.fontWeight': 'font-bold',
      '__cardforgeImageField.Artwork.fit': 'contain',
    });

    expect(data).toMatchObject({
      Title: 'Custom back title',
      '__cardforgeFieldStyle.Title.fontWeight': 'font-bold',
      '__cardforgeImageField.Artwork.fit': 'contain',
    });
  });

  it('reports required fields for either face through the shared validator', () => {
    expect(getMissingRequiredFieldLabels([requiredField], {})).toEqual(['Title']);
    expect(getMissingRequiredFieldLabels([requiredField], { Title: 'Ready' })).toEqual([]);
  });
});
