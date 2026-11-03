import { z } from 'zod/v4';
import { PAPER_SIZES } from '@/domain/rendering';

/** An export handoff is a proposal to the browser, never permission to download. */
export const outputIntentSchema = z.object({
  documentId: z.string().uuid(),
  revision: z.number().int().positive(),
  setId: z.string().min(1),
  cardIds: z.array(z.string().min(1)).min(1).max(10000).refine((ids) => new Set(ids).size === ids.length, 'Card IDs must be unique.'),
  layout: z.enum(['sheet', 'screen']).default('sheet'),
  paper: z.string().refine((name) => PAPER_SIZES.some((paper) => paper.name === name), 'Unknown paper size.'),
  marginMm: z.number().finite().min(0),
  spacingMm: z.number().finite().min(0),
  cutLines: z.boolean(),
  duplex: z.enum(['same-page', 'separate-pages', 'separate-pages-short-edge']),
  mode: z.enum(['virtual', 'physical']),
  quality: z.union([z.literal(150), z.literal(300), z.literal(600)]),
}).strict();

export type OutputIntent = z.infer<typeof outputIntentSchema>;

/** Validate the authored objects before any display selector can drop missing references. */
export function validateOutputIntentDocument(intent: OutputIntent, value: unknown): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The source document is invalid.');
  const doc = value as Record<string, unknown>;
  if (!Array.isArray(doc.cardSets) || !Array.isArray(doc.storedCards) || !Array.isArray(doc.userTemplates)) throw new Error('The source document is incomplete.');
  const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
  const sets = doc.cardSets.filter(object).filter((x) => x.id === intent.setId);
  if (sets.length !== 1) throw new Error('The exact Set is missing or ambiguous.');
  const cards = doc.storedCards.filter(object);
  const templates = doc.userTemplates.filter(object);
  for (const id of intent.cardIds) {
    const matches = cards.filter((x) => x.uniqueId === id);
    if (matches.length !== 1 || matches[0].setId !== intent.setId) throw new Error(`Card ${id} is missing, ambiguous, or outside the Set.`);
    const card = matches[0];
    const validData = (data: unknown): boolean => object(data) && Object.values(data).every((v) => typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v)));
    if (typeof card.templateId !== 'string' || !validData(card.data)) throw new Error(`Card ${id} has invalid front data.`);
    const fronts = templates.filter((x) => x.id === card.templateId);
    if (fronts.length !== 1 || fronts[0].templateUsage === 'back-preset') throw new Error(`Card ${id} has a missing or ambiguous front Template.`);
    if (card.backingTemplateId != null) {
      if (typeof card.backingTemplateId !== 'string' || templates.filter((x) => x.id === card.backingTemplateId).length !== 1 || templates.find((x) => x.id === card.backingTemplateId)?.templateUsage !== 'back-preset' || (card.backingData != null && !validData(card.backingData))) throw new Error(`Card ${id} has invalid back data or Template.`);
    } else if (card.backingData != null && (!object(card.backingData) || Object.keys(card.backingData).length)) throw new Error(`Card ${id} has back data without a back Template.`);
  }
}
