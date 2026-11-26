import { beforeEach, describe, expect, it } from 'vitest';

import { beginProjectCardEdit, removeProjectCard, saveProjectCardEdit } from '@/features/project/client/cardEditSession';
import { setProjectPersistenceScope } from '@/features/project/persistence/projectPersistenceScope';
import { useProjectStore } from '@/features/project/store/workspaceStore';
import { createProjectScaleFixture } from '../../fixtures/projectScale';

const setup = () => {
  const fixture = createProjectScaleFixture(100);
  const front = { ...fixture.userTemplates[0]!, id: 'edit-front' };
  const back = { ...structuredClone(front), id: 'edit-back', name: 'Back', templateUsage: 'back-preset' as const };
  const set = { ...fixture.cardSets[0]!, templateIds: ['edit-front', 'edit-back'] };
  const card = { ...fixture.storedCards[0]!, templateId: 'edit-front', backingTemplateId: 'edit-back', backingData: { cardName: 'Back original' } };
  useProjectStore.setState({ cardSets: [set], activeCardSet: set, storedCards: [card], defaultTemplates: [], userTemplates: [front, back] });
  const session = beginProjectCardEdit(set.id, card.uniqueId);
  if (!session) throw new Error('Expected a valid owned card session');
  return { set, card, front, back, session };
};

describe('Project card edit session', () => {
  beforeEach(() => setProjectPersistenceScope('account:card-edit'));

  it('commits front and back content through the existing working copy', () => {
    const { session, card } = setup();
    expect(saveProjectCardEdit(session, { ...session.card, data: { ...session.card.data, cardName: 'Edited front' }, backingData: { cardName: 'Edited back' } })).toBe(true);
    const saved = useProjectStore.getState().storedCards.find((item) => item.uniqueId === card.uniqueId)!;
    expect(saved.data.cardName).toBe('Edited front');
    expect(saved.backingData?.cardName).toBe('Edited back');
    expect(saved.setId).toBe(card.setId);
  });

  it('refuses a draft that changes its Set, card or either Template identity', () => {
    const { session } = setup();
    for (const changed of [
      { ...session.card, uniqueId: 'other-card' },
      { ...session.card, setId: 'other-set' },
      { ...session.card, template: { ...session.card.template, id: 'other-front' } },
      { ...session.card, backingTemplateId: 'other-back' },
      { ...session.card, backingTemplate: { ...session.card.backingTemplate!, name: 'Changed back' } },
    ]) expect(saveProjectCardEdit(session, changed)).toBe(false);
    expect(useProjectStore.getState().storedCards[0]).toEqual(session.original);
    expect(beginProjectCardEdit('other-set', session.card.uniqueId)).toBeNull();
  });

  it.each(['card', 'removed', 'set', 'front', 'back', 'scope'] as const)(
    'refuses a stale %s without overwriting current work', (change) => {
      const { session, set, front, back } = setup();
      const state = useProjectStore.getState();
      if (change === 'card') useProjectStore.setState({ storedCards: [{ ...state.storedCards[0]!, data: { cardName: 'Changed elsewhere' } }] });
      if (change === 'removed') useProjectStore.setState({ storedCards: [] });
      if (change === 'set') useProjectStore.setState({ cardSets: [], activeCardSet: null });
      if (change === 'front') useProjectStore.setState({ userTemplates: [{ ...front, name: 'Changed front' }, back] });
      if (change === 'back') useProjectStore.setState({ userTemplates: [front, { ...back, name: 'Changed back' }] });
      if (change === 'scope') setProjectPersistenceScope('account:another');
      const before = structuredClone(useProjectStore.getState().storedCards);
      expect(saveProjectCardEdit(session, { ...session.card, data: { cardName: 'Draft' } })).toBe(false);
      expect(removeProjectCard(session)).toBe(false);
      expect(useProjectStore.getState().storedCards).toEqual(before);
      expect(session.card.data).toEqual(session.original.data);
      expect(set.id).toBe(session.setId);
    },
  );

  it('removes only the confirmed owned card and restores its front and back through Project recovery', () => {
    const { session, card, set } = setup();
    const sibling = { ...card, uniqueId: 'sibling', data: { cardName: 'Sibling' } };
    useProjectStore.setState((state) => ({ storedCards: [...state.storedCards, sibling], cardRemovalRecoveries: [] }));
    const templates = structuredClone(useProjectStore.getState().userTemplates);
    expect(removeProjectCard(session)).toBe(true);
    const state = useProjectStore.getState();
    expect(state.storedCards).toEqual([sibling]);
    expect(state.userTemplates).toEqual(templates);
    const recovery = state.cardRemovalRecoveries.findLast((entry) => entry.setId === set.id)!;
    expect(state.undoCardRemoval(recovery.id)).toEqual({ ok: true, count: 1 });
    expect(useProjectStore.getState().storedCards).toEqual([card, sibling]);
  });

  it('does not remove a card moved to another Set after confirmation opened', () => {
    const { session, card } = setup();
    const moved = { ...card, setId: 'different-set' };
    useProjectStore.setState((state) => ({
      storedCards: [moved],
      cardSets: [...state.cardSets, { id: 'different-set', name: 'Different Set' }],
      cardRemovalRecoveries: [],
    }));
    expect(removeProjectCard(session)).toBe(false);
    expect(useProjectStore.getState().storedCards).toEqual([moved]);
    expect(useProjectStore.getState().cardRemovalRecoveries).toEqual([]);
  });

  it.each(['same', 'different'] as const)('refuses duplicate card IDs in the %s Set before saving or removing', (location) => {
    const { session, card } = setup();
    const duplicate = { ...card, setId: location === 'same' ? session.setId : 'different-set', data: { cardName: 'Other work' } };
    useProjectStore.setState((state) => ({
      storedCards: [card, duplicate],
      cardSets: [...state.cardSets, { id: 'different-set', name: 'Different Set' }],
      cardRemovalRecoveries: [],
    }));
    expect(saveProjectCardEdit(session, { ...session.card, data: { cardName: 'Edited' } })).toBe(false);
    expect(useProjectStore.getState().storedCards).toEqual([card, duplicate]);
    expect(removeProjectCard(session)).toBe(false);
    expect(useProjectStore.getState().storedCards).toEqual([card, duplicate]);
    expect(useProjectStore.getState().cardRemovalRecoveries).toEqual([]);
  });
});
