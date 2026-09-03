import { describe, expect, it } from 'vitest';

import type { CardSet, StoredDisplayCard } from '@/domain/cards';
import type { TCGCardTemplate } from '@/domain/templates';
import { createCardSetTransfer } from '@/features/project/model/cardTransfer';
import { createStableAgentCardId } from '@/features/studio-documents/server/cardSetWorkingDocuments';

const set: CardSet = {
  id: 'set-1',
  name: 'Test Set',
};
const card: StoredDisplayCard = {
  uniqueId: 'card-1',
  templateId: 'official-template',
  backingTemplateId: null,
  setId: 'set-1',
  setName: 'Test Set',
  data: { name: 'Card One' },
};

const template = (id: string, source: 'pipeline' | 'personal'): TCGCardTemplate => ({
  id,
  name: id,
  aspectRatio: '63:88',
  templateSource: source === 'pipeline' ? 'default' : 'user',
  templateLibrarySource: source,
  freeformCanvas: { width: 630, height: 880, elements: [] },
});

describe('MCP workflow hardening', () => {
  it('documents why data-derived ids must not be reused as implicit edit identity', () => {
    const first = createStableAgentCardId('set-1', { data: { name: 'Card One', rules: 'Flying' } });
    const revised = createStableAgentCardId('set-1', { data: { name: 'Card One', rules: 'Flying, haste' } });
    expect(first).not.toBe(revised);
  });

  it('does not export transient published catalog Templates as personal Set dependencies', () => {
    const transfer = createCardSetTransfer({
      set,
      storedCards: [card],
      templates: [
        template('official-template', 'pipeline'),
        template('unrelated-personal', 'personal'),
      ],
    });
    expect(transfer.templates).toEqual([]);
    expect(transfer.cards).toHaveLength(1);
    expect(transfer.sets[0]).toEqual(set);
    expect(transfer.cards[0]?.templateId).toBe('official-template');
  });
});
