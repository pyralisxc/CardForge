import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { assertOutputContentUnchanged, outputIntentSchema, validateOutputIntentDocument } from '@/features/studio-documents/outputIntent';
import { materializeProjectTemplateOwnership, parseProjectDocumentValue } from '@/features/project/model/projectDocument';
import { createProjectScaleFixture } from '../../fixtures/projectScale';

const raw = { documentId: 'a2393740-a748-42cc-a942-1aa7c16641db', revision: 2, setId: 'set', cardIds: ['b', 'a'], paper: 'A4 (210×297 mm)', marginMm: 5, spacingMm: 0, cutLines: false, duplex: 'same-page', mode: 'virtual', quality: 150 };
const document = { cardSets: [{ id: 'set' }], storedCards: [{ uniqueId: 'a', setId: 'set', templateId: 'front', data: {} }, { uniqueId: 'b', setId: 'set', templateId: 'front', data: {}, backingTemplateId: 'back', backingData: {} }], userTemplates: [{ id: 'front' }, { id: 'back', templateUsage: 'back-preset' }] };
describe('exact output intent', () => {
  it('preserves selected order and defaults to sheets with an available back', () => {
    const intent = outputIntentSchema.parse(raw);
    expect(intent.layout).toBe('sheet'); expect(intent.cardIds).toEqual(['b', 'a']);
    expect(() => validateOutputIntentDocument(intent, document)).not.toThrow();
  });
  it('rejects repair of selected content but permits unrelated cleanup', () => {
    const intent = outputIntentSchema.parse(raw);
    const unrelated = { ...document, storedCards: [...document.storedCards, { uniqueId: 'other', setId: 'other', templateId: 'front', data: {} }] };
    expect(() => assertOutputContentUnchanged(intent, unrelated, document)).not.toThrow();
    const changed = { ...document, storedCards: document.storedCards.map((card) => card.uniqueId === 'b' ? { ...card, backingData: { art: 'changed' } } : card) };
    expect(() => assertOutputContentUnchanged(intent, document, changed)).toThrow('needs repair');
  });
  it('keeps exact Output valid through legacy Set ownership conversion', () => {
    const source = createProjectScaleFixture(100);
    source.storedCards = source.storedCards.slice(0, 2);
    source.userTemplates[0].templateContributorName = 'Original contributor';
    source.userTemplates[0].freeformCanvas!.elements = [{
      id: 'label', name: 'Label', type: 'text', x: 20, y: 30, width: 500, height: 80, zIndex: 1,
      content: 'Synthetic {{cardName}}', fontSizePx: 30, textColor: '#000000',
    }];
    const back = { ...source.userTemplates[0], id: 'synthetic-back', templateUsage: 'back-preset' as const, name: 'Back' };
    source.userTemplates.push(back);
    source.storedCards[1].backingTemplateId = back.id;
    source.storedCards[1].backingData = {};
    const parsed = parseProjectDocumentValue(source);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const intent = outputIntentSchema.parse({ ...raw, setId: 'scale-set-100', cardIds: ['scale-card-2', 'scale-card-1'] });
    const converted = materializeProjectTemplateOwnership(parsed.document).document;
    expect(() => assertOutputContentUnchanged(intent, parsed.document, converted)).not.toThrow();
    const frontTemplateId = converted.storedCards.find((card) => card.uniqueId === 'scale-card-1')!.templateId;
    const frontTemplate = converted.userTemplates.find((template) => template.id === frontTemplateId)!;
    expect(frontTemplate.templateContributorName).toBe('Original contributor');
    for (const field of ['name', 'templateContributorName'] as const) {
      const changed = structuredClone(converted);
      const template = changed.userTemplates.find((entry) => entry.id === frontTemplateId)!;
      if (field === 'name') template.name = 'Changed name';
      else template.templateContributorName = 'Changed contributor';
      expect(() => assertOutputContentUnchanged(intent, parsed.document, changed)).toThrow('needs repair');
    }
  });
  it('exposes a JSON schema for the protocol', () => {
    expect(z.toJSONSchema(outputIntentSchema, { io: 'input' })).toMatchObject({ type: 'object' });
  });
  it('rejects missing pins, duplicates, missing Template and wrong Set', () => {
    expect(outputIntentSchema.safeParse({ ...raw, revision: undefined }).success).toBe(false);
    expect(outputIntentSchema.safeParse({ ...raw, cardIds: ['a', 'a'] }).success).toBe(false);
    const intent = outputIntentSchema.parse(raw);
    expect(() => validateOutputIntentDocument(intent, { ...document, userTemplates: [{ id: 'front' }] })).toThrow('back');
    expect(() => validateOutputIntentDocument(intent, { ...document, storedCards: document.storedCards.map((card) => ({ ...card, setId: 'other' })) })).toThrow('outside');
  });
});
