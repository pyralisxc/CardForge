import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { outputIntentSchema, validateOutputIntentDocument } from '@/features/studio-documents/outputIntent';

const raw = { documentId: 'a2393740-a748-42cc-a942-1aa7c16641db', revision: 2, setId: 'set', cardIds: ['b', 'a'], paper: 'A4 (210×297 mm)', marginMm: 5, spacingMm: 0, cutLines: false, duplex: 'same-page', mode: 'virtual', quality: 150 };
const document = { cardSets: [{ id: 'set' }], storedCards: [{ uniqueId: 'a', setId: 'set', templateId: 'front', data: {} }, { uniqueId: 'b', setId: 'set', templateId: 'front', data: {}, backingTemplateId: 'back', backingData: {} }], userTemplates: [{ id: 'front' }, { id: 'back', templateUsage: 'back-preset' }] };
describe('exact output intent', () => {
  it('preserves selected order and defaults to sheets with an available back', () => {
    const intent = outputIntentSchema.parse(raw);
    expect(intent.layout).toBe('sheet'); expect(intent.cardIds).toEqual(['b', 'a']);
    expect(() => validateOutputIntentDocument(intent, document)).not.toThrow();
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
