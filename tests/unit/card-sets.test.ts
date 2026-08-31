import { describe, expect, it } from 'vitest';

import { reconcileCardSets, resolveActiveCardSet, type CardSet, type StoredDisplayCard } from '@/domain/cards';
import type { TCGCardTemplate } from '@/domain/templates';
import {
  createCardSetTransfer,
  createCardTransfer,
  parseCardForgeTransferValue,
} from '@/features/project/model/cardTransfer';
import { parseProjectDocumentValue } from '@/features/project/model/projectDocument';

const template: TCGCardTemplate = {
  id: 'template-front',
  name: 'Front',
  aspectRatio: '63:88',
  templateSource: 'user',
  templateLibrarySource: 'personal',
  freeformCanvas: { width: 630, height: 880, elements: [] },
};

const card: StoredDisplayCard = {
  uniqueId: 'card-1',
  templateId: 'template-front',
  setId: 'set-clash',
  setName: 'Clash of Fists',
  data: { title: 'Stone Slam' },
};

const set: CardSet = {
  id: 'set-clash',
  name: 'Clash of Fists',
};

describe('first-class local card sets', () => {
  it('promotes legacy card membership into set records without duplicating ids', () => {
    const result = reconcileCardSets({
      cardSets: [],
      activeCardSet: set,
      storedCards: [card, { ...card, uniqueId: 'card-2' }],
    });
    expect(result).toEqual([set]);
    expect(resolveActiveCardSet({ cardSets: result, preferredId: set.id })).toEqual(set);
  });

  it('upgrades legacy version-1 project files by deriving their set registry', () => {
    const parsed = parseProjectDocumentValue({
      version: 1,
      userTemplates: [template],
      storedCards: [card],
      appearanceStyles: [],
      exportSettings: {},
      customAssets: {},
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.document.cardSets).toEqual([set]);
    expect(parsed.document.activeCardSetId).toBe(set.id);
  });

  it('exports a self-contained set transfer and a one-card transfer', () => {
    const setTransfer = createCardSetTransfer({
      set,
      storedCards: [card],
      templates: [template],
    });
    expect(setTransfer).toMatchObject({
      cardforgeTransfer: 1,
      kind: 'set',
      sets: [set],
      cards: [card],
    });
    expect(setTransfer.templates.map((candidate) => candidate.id)).toEqual(['template-front']);
    expect(parseCardForgeTransferValue(setTransfer)?.kind).toBe('set');

    const cardTransfer = createCardTransfer({ card, set, templates: [template] });
    expect(cardTransfer.kind).toBe('card');
    expect(cardTransfer.cards).toHaveLength(1);
    expect(parseCardForgeTransferValue(cardTransfer)?.cards[0]?.uniqueId).toBe('card-1');
  });
});
