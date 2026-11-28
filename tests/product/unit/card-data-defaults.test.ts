import { describe, expect, it } from 'vitest';

import { extractTemplateFieldDefinitions, normalizeTemplateFieldContracts, type TCGCardTemplate, type TemplateFieldDefinition } from '@/domain/templates';
import { createBulkDisplayCards } from '@/features/card-generator/lib/bulkPreview';
import { buildResolvedTextSegments } from '@/features/card-rendering/components/CardTextContent';
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
  it('keeps an example as guidance rather than a card default through Template normalization', () => {
    const template: TCGCardTemplate = {
      id: 'example-only', name: 'Example only', aspectRatio: '63:88',
      fieldContracts: [{ key: 'Rank', elementId: 'rank', type: 'text', required: true, example: 'King' }],
      freeformCanvas: { width: 630, height: 880, elements: [
        { id: 'rank', type: 'text', name: 'Rank', content: '{{Rank}}', x: 0, y: 0, width: 100, height: 100, zIndex: 0 },
      ] },
    };
    expect(extractTemplateFieldDefinitions(template)[0].defaultValue).toBeUndefined();
    const normalized = normalizeTemplateFieldContracts(template);
    const fields = extractTemplateFieldDefinitions(normalized);
    expect(fields[0]).toMatchObject({ key: 'Rank', required: true, example: 'King' });
    expect(fields[0].defaultValue).toBeUndefined();
    expect(normalized.fieldContracts?.[0].defaultValue).toBeUndefined();
    expect(getMissingRequiredFieldLabels(fields, completeCardDataWithTemplateDefaults(fields, {}))).toEqual(['Rank']);
    expect(initializeCardDataFromTemplate(normalized, { Rank: '' })[1].Rank).toBe('');
    expect(initializeCardDataFromTemplate(normalized, { Rank: 'Queen' })[1].Rank).toBe('Queen');
    const withDefault = normalizeTemplateFieldContracts({ ...template, fieldContracts: [{ ...template.fieldContracts![0], defaultValue: 'Ace' }] });
    expect(completeCardDataWithTemplateDefaults(extractTemplateFieldDefinitions(withDefault), {}).Rank).toBe('Ace');
    const withEmptyDefault = normalizeTemplateFieldContracts({ ...template, fieldContracts: [{ ...template.fieldContracts![0], defaultValue: '' }] });
    expect(extractTemplateFieldDefinitions(withEmptyDefault)[0].defaultValue).toBe('');
  });

  it('does not resolve an omitted example in an appended card, but preserves an explicit value', () => {
    const template: TCGCardTemplate = {
      id: 'example-output', name: 'Example output', aspectRatio: '63:88',
      fieldContracts: [{ key: 'Rank', elementId: 'label', type: 'text', required: false, example: 'King' }],
      freeformCanvas: { width: 630, height: 880, elements: [
        { id: 'label', type: 'text', name: 'Label', content: 'Rank: {{Rank}}', x: 0, y: 0, width: 100, height: 100, zIndex: 0 },
      ] },
    };
    const normalized = normalizeTemplateFieldContracts(template);
    const fields = extractTemplateFieldDefinitions(normalized);
    const [card] = createBulkDisplayCards({ template: normalized, fieldDefinitions: fields, rows: [['Other'], ['value']], columnMapping: {} });
    const element = normalized.freeformCanvas!.elements[0];
    expect(card.data.Rank).toBe('');
    expect(buildResolvedTextSegments(normalized, element, card.data).map((segment) => segment.text).join('')).toBe('Rank: ');
    expect(buildResolvedTextSegments(normalized, element, { Rank: 'Queen' }).map((segment) => segment.text).join('')).toBe('Rank: Queen');
    expect(buildResolvedTextSegments(normalized, element, { Rank: '' }).map((segment) => segment.text).join('')).toBe('Rank: ');
  });
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
