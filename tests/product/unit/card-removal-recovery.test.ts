import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getCardTitle } from '@/domain/cards';
import { reconstructMinimalTemplateObject } from '@/domain/templates';
import { createProjectDocumentFromState } from '@/features/project/model/projectDocument';
import { applyProjectDocumentToWorkspace } from '@/features/project/client/projectWorkspaceDocument';
import { hydrateProjectWorkspaceForScope, persistProjectWorkspaceNow, useProjectStore } from '@/features/project/store/workspaceStore';

let scopeNumber = 0;
const current = () => useProjectStore.getState();
const ids = () => current().storedCards.map((card) => card.uniqueId);
const latest = (setId = 'set-a') => current().cardRemovalRecoveries.findLast((entry) => entry.setId === setId)!;
const replacement = () => createProjectDocumentFromState({
  cardSets: [{ id: 'set-a', name: 'New revision' }],
  storedCards: [{ uniqueId: 'new', templateId: 'front', setId: 'set-a', data: { title: 'New work' } }],
  userTemplates: current().userTemplates, appearanceStyles: [],
});

describe('session-only Set removal recovery', () => {
  beforeEach(async () => {
    await hydrateProjectWorkspaceForScope(`account:removal-${++scopeNumber}`);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const owner = { id: 'set-a', name: 'Alpha' };
    useProjectStore.setState({
      cardSets: [ { ...owner, templateIds: ['front', 'back'] }, { id: 'set-b', name: 'Beta', templateIds: ['front-b', 'back-b'] } ], activeCardSet: owner,
      userTemplates: [
        reconstructMinimalTemplateObject({ id: 'front', name: 'Front', templateSource: 'user' }),
        reconstructMinimalTemplateObject({ id: 'back', name: 'Back', templateSource: 'user', templateUsage: 'back-preset' }),
        reconstructMinimalTemplateObject({ id: 'front-b', name: 'Front B', templateSource: 'user' }),
        reconstructMinimalTemplateObject({ id: 'back-b', name: 'Back B', templateSource: 'user', templateUsage: 'back-preset' }),
      ],
      storedCards: ['a', 'b', 'c', 'other'].map((uniqueId) => ({
        uniqueId,
        templateId: uniqueId === 'other' ? 'front-b' : 'front',
        setId: uniqueId === 'other' ? 'set-b' : owner.id,
        data: { title: uniqueId, detail: 'Original' },
        backingTemplateId: uniqueId === 'other' ? 'back-b' : 'back',
        backingData: { title: `Back ${uniqueId}` },
      })),
    });
    await persistProjectWorkspaceNow();
  });

  it('keeps Set-relative fallback names while restoring the workspace-wide order', () => {
    const original = current().storedCards;
    const unnamed = { ...original[3]!, data: {} };
    useProjectStore.setState({ storedCards: [original[0]!, unnamed, original[1]!, original[2]!] });
    expect(current().removeGeneratedCards(['other'])).toBe(1);
    const entry = latest('set-b');
    expect(getCardTitle(entry.cards[0]!, entry.setOrder.indexOf('other'))).toBe('Card 1');
    expect(entry.order.indexOf('other')).toBe(1);
    expect(current().undoCardRemoval(entry.id)).toMatchObject({ ok: true });
    expect(ids()).toEqual(['a', 'other', 'b', 'c']);
  });

  it('excludes cards with unavailable front Templates from the visible Set-relative label', () => {
    const original = current().storedCards;
    const hidden = { ...original[0]!, uniqueId: 'hidden', templateId: 'missing' };
    const unnamed = { ...original[1]!, data: {} };
    useProjectStore.setState({ storedCards: [hidden, unnamed, original[2]!, original[3]!] });
    expect(current().removeGeneratedCards(['b'])).toBe(1);
    const entry = latest();
    expect(getCardTitle(entry.cards[0]!, entry.setOrder.indexOf('b'))).toBe('Card 1');
    expect(entry.order).toEqual(['hidden', 'b', 'c', 'other']);
    expect(current().undoCardRemoval(entry.id)).toMatchObject({ ok: true });
    expect(ids()).toEqual(['hidden', 'b', 'c', 'other']);
  });

  it('restores only the removed snapshots once without changing unrelated work', () => {
    const original = structuredClone(current().storedCards);
    const oldReference = current().storedCards[0];
    expect(current().removeGeneratedCards(['a', 'c'])).toBe(2);
    oldReference.data.title = 'Changed old reference';
    oldReference.backingData!.title = 'Changed old back reference';
    expect(current().cardRemovalRecoveries).toHaveLength(1);
    const entry = latest();
    expect(entry.cards.map((card) => card.uniqueId)).toEqual(['a', 'c']);
    expect(current().undoCardRemoval(entry.id)).toMatchObject({ ok: true });
    expect(current().storedCards.map(({ setName: _name, ...card }) => card)).toEqual(original);
    expect(current().undoCardRemoval(entry.id)).toMatchObject({ ok: false });
  });

  it('keeps consecutive removals in a per-Set stack with stable recovery IDs', () => {
    current().removeGeneratedCards(['b']);
    const first = latest();
    current().removeGeneratedCards(['a']);
    const second = latest();
    expect(second.id).not.toBe(first.id);
    const before = current();
    expect(current().undoCardRemoval(first.id)).toEqual({ ok: false, reason: 'newer-removal' });
    expect(current()).toBe(before);
    expect(current().undoCardRemoval(second.id)).toMatchObject({ ok: true });
    expect(current().undoCardRemoval(first.id)).toMatchObject({ ok: true });
    expect(ids()).toEqual(['a', 'b', 'c', 'other']);
  });

  it('restores a large removed batch in order without moving newer work', () => {
    const cards = Array.from({ length: 1000 }, (_, index) => ({ uniqueId: `batch-${index}`, templateId: 'front', setId: 'set-a', data: { title: `Card ${index}` } }));
    useProjectStore.setState({ storedCards: cards });
    current().removeGeneratedCards(cards.map((card) => card.uniqueId));
    useProjectStore.setState((state) => ({ storedCards: [...state.storedCards, { uniqueId: 'newer', templateId: 'front', setId: 'set-a', data: { title: 'Newer' } }] }));
    expect(current().undoCardRemoval(latest().id)).toMatchObject({ ok: true, count: 1000 });
    expect(ids()).toEqual(['newer', ...cards.map((card) => card.uniqueId)]);
  });

  it('can dismiss a later removal without misplacing an earlier recovery', () => {
    current().removeGeneratedCards(['b']);
    const first = latest();
    current().removeGeneratedCards(['a']);
    current().dismissCardRemoval(latest().id);
    expect(current().undoCardRemoval(first.id)).toMatchObject({ ok: true });
    expect(ids()).toEqual(['b', 'c', 'other']);
  });

  it('never overwrites a reused card ID or consumes recovery on refusal', () => {
    current().removeGeneratedCards(['a', 'b']);
    const entry = latest();
    useProjectStore.setState((state) => ({ storedCards: [...state.storedCards, { ...entry.cards[0], data: { title: 'New work' } }] }));
    const before = current();
    expect(current().undoCardRemoval(entry.id)).toEqual({ ok: false, reason: 'conflict' });
    expect(current()).toBe(before);
    expect(current().cardRemovalRecoveries).toContain(entry);
    expect(current().storedCards.find((card) => card.uniqueId === 'a')?.data.title).toBe('New work');
    expect(ids()).not.toContain('b');
  });

  it('retires old recovery when native adoption refreshes a Set with the same ID', async () => {
    current().removeGeneratedCards(['a']);
    const entry = latest();
    await persistProjectWorkspaceNow();
    const other = structuredClone(current().storedCards.find((card) => card.uniqueId === 'other'));
    await applyProjectDocumentToWorkspace(replacement(), 'adopt');
    const refreshed = current();
    expect(current().undoCardRemoval(entry.id)).toMatchObject({ ok: false });
    expect(current()).toBe(refreshed);
    expect(current().cardRemovalRecoveries).toHaveLength(0);
    expect(ids()).toEqual(['other', 'new']);
    expect(current().storedCards.find((card) => card.uniqueId === 'other')).toEqual(other);
  });

  it('retains current work and recovery while a required Template is unavailable', () => {
    current().removeGeneratedCards(['a']);
    const entry = latest();
    const templates = current().userTemplates;
    useProjectStore.setState({ userTemplates: templates.filter((template) => template.id !== 'back') });
    const before = current();
    expect(current().undoCardRemoval(entry.id)).toEqual({ ok: false, reason: 'template-unavailable' });
    expect(current()).toBe(before);
    useProjectStore.setState({ userTemplates: templates });
    expect(current().undoCardRemoval(entry.id)).toMatchObject({ ok: true, count: 1 });
  });

  it.each(['cards', 'set'])('invalidates only the incoming Set’s recovery on native %s merge', (kind) => {
    current().removeGeneratedCards(['a', 'other']);
    const alpha = latest();
    const beta = latest('set-b');
    if (kind === 'cards') current().mergeStoredCardsFromFile([{ uniqueId: 'incoming', templateId: 'front', setId: 'set-a', data: { title: 'Imported' } }]);
    else current().mergeCardSetsFromFiles([{ id: 'set-a', name: 'Refreshed Alpha' }]);
    expect(current().undoCardRemoval(alpha.id)).toEqual({ ok: false, reason: 'not-found' });
    expect(current().cardRemovalRecoveries).toContain(beta);
    expect(current().undoCardRemoval(beta.id)).toMatchObject({ ok: true });
  });

  it('preserves live work and recovery when a prepared native install is cancelled', async () => {
    current().removeGeneratedCards(['a']);
    const entry = latest();
    await persistProjectWorkspaceNow();
    const before = current();
    const controller = new AbortController();
    await expect(applyProjectDocumentToWorkspace(replacement(), 'adopt', {
      signal: controller.signal, validatePreparedDocument: () => controller.abort(),
    })).rejects.toThrow();
    expect(current()).toBe(before);
    expect(current().undoCardRemoval(entry.id)).toMatchObject({ ok: true });
  });

  it('replaces implicit legacy cards with their owning revision instead of moving them to another Set', async () => {
    useProjectStore.setState((state) => ({ storedCards: [...state.storedCards, { uniqueId: 'legacy', templateId: 'front', data: { title: 'Old Alpha' } }] }));
    await persistProjectWorkspaceNow();
    await applyProjectDocumentToWorkspace(replacement(), 'adopt');
    expect(ids()).toEqual(['other', 'new']);
  });

  it('does not leak recovery into a deleted and re-imported same-ID Set', () => {
    current().removeGeneratedCards(['a']);
    const entry = latest();
    current().deleteCardSet('set-a');
    current().mergeCardSetsFromFiles([{ id: 'set-a', name: 'Different work' }]);
    expect(current().undoCardRemoval(entry.id)).toMatchObject({ ok: false });
    expect(ids()).toEqual(['other']);
  });

  it.each([undefined, ''])('does not move implicit legacy Artifacts into the next Set when their owner is deleted (%s)', (setId) => {
    useProjectStore.setState((state) => ({ storedCards: [...state.storedCards, { uniqueId: 'legacy', templateId: 'front', setId, data: { title: 'Legacy' } }] }));
    current().removeGeneratedCards(['a']);
    current().deleteCardSet('set-a');
    expect(ids()).toEqual(['other']);
  });

  it('leaves the first Set’s implicit Artifacts and recovery intact when clearing another Set', () => {
    useProjectStore.setState((state) => ({ storedCards: [...state.storedCards, { uniqueId: 'legacy', templateId: 'front', data: { title: 'Legacy' } }] }));
    current().removeGeneratedCards(['a']);
    const entry = latest();
    current().setActiveCardSetId('set-b');
    current().clearGeneratedCards();
    expect(ids()).toEqual(['b', 'c', 'legacy']);
    expect(current().undoCardRemoval(entry.id)).toMatchObject({ ok: true });
    expect(ids()).toEqual(['a', 'b', 'c', 'legacy']);
  });

  it('keeps another Set’s recovery independent of newer removals and native copies', async () => {
    current().removeGeneratedCards(['a']);
    const alpha = latest();
    current().removeGeneratedCards(['other']);
    const beta = latest('set-b');
    current().renameCardSet('set-a', 'Renamed Alpha');
    await persistProjectWorkspaceNow();
    await applyProjectDocumentToWorkspace(replacement(), 'copy');
    expect(current().undoCardRemoval(alpha.id)).toMatchObject({ ok: true });
    expect(current().storedCards.find((card) => card.uniqueId === 'a')?.setName).toBe('Renamed Alpha');
    expect(current().cardRemovalRecoveries).toContain(beta);
    expect(current().undoCardRemoval(beta.id)).toMatchObject({ ok: true });
  });

  it('does not persist recovery across successful hydration or account round trips', async () => {
    current().removeGeneratedCards(['a']);
    const entry = latest();
    await persistProjectWorkspaceNow();
    await useProjectStore.persist.rehydrate();
    expect(current().cardRemovalRecoveries).toHaveLength(0);
    expect(current().undoCardRemoval(entry.id)).toMatchObject({ ok: false });
    expect(ids()).not.toContain('a');
    current().removeGeneratedCards(['b']);
    const next = latest();
    await persistProjectWorkspaceNow();
    const scope = `account:removal-${scopeNumber}` as const;
    await hydrateProjectWorkspaceForScope(`account:other-removal-${scopeNumber}`);
    expect(current().undoCardRemoval(next.id)).toMatchObject({ ok: false });
    await hydrateProjectWorkspaceForScope(scope);
    expect(current().undoCardRemoval(next.id)).toMatchObject({ ok: false });
    expect(ids()).toEqual(['c', 'other']);
  });
});
