import { describe, expect, it } from 'vitest';

import type { TCGCardTemplate, TemplateFieldDefinition } from '@/domain/templates';
import {
  getMissingRequiredFieldLabels,
  initializeCardDataFromTemplate,
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
