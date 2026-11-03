import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { assertOutputContentUnchanged, outputIntentSchema, validateOutputIntentDocument } from '@/features/studio-documents/outputIntent';

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
