import { nanoid } from 'nanoid';
import type { StateCreator } from 'zustand';

import { normalizeCardTagIds, type StoredDisplayCard } from '@/domain/cards';

import { prepareCardSetTemplateBindings } from '../model/setTemplateOwnership';
import { selectAllGeneratedDisplayCards, selectAllTemplates } from './selectors';
import type { OutputSlice, ProjectState } from './types';

const toStoredCard = (updatedCard: import('@/domain/rendering').DisplayCard, previous?: StoredDisplayCard): StoredDisplayCard => ({
  uniqueId: updatedCard.uniqueId,
  templateId: updatedCard.template.id!,
  backingTemplateId: updatedCard.backingTemplateId ?? updatedCard.backingTemplate?.id ?? previous?.backingTemplateId ?? null,
  ...(updatedCard.backingData !== undefined
    ? { backingData: updatedCard.backingData }
    : previous?.backingData !== undefined ? { backingData: previous.backingData } : {}),
  setId: updatedCard.setId ?? previous?.setId,
  setName: updatedCard.setName ?? previous?.setName,
  data: updatedCard.data,
  tagIds: updatedCard.tagIds ?? previous?.tagIds,
  updatedAt: new Date().toISOString(),
});

const ensureImportSet = (getState: () => ProjectState): NonNullable<ProjectState['activeCardSet']> => {
  const state = getState();
  if (state.activeCardSet) return state.activeCardSet;
  const id = state.createCardSet('Recovered Set');
  const nextState = getState();
  const set = nextState.cardSets.find((candidate) => candidate.id === id) ?? nextState.activeCardSet;
  if (!set) throw new Error('CardForge could not create the required Set.');
  return set;
};

const withCardSetTemplateReferences = (state: ProjectState, storedCards: StoredDisplayCard[]) => {
  const { userTemplates, storedCards: cards, cardSets, templateIdsBySet } = prepareCardSetTemplateBindings(state, storedCards, selectAllTemplates(state));
  const activeCardSet = state.activeCardSet
    ? cardSets.find((set) => set.id === state.activeCardSet?.id) ?? state.activeCardSet
    : null;
  const selected = state.activeCardSet ? templateIdsBySet.get(state.activeCardSet.id) : undefined;
  return {
    storedCards: cards, cardSets, activeCardSet, userTemplates,
    ...(state.generatorSelectedTemplateId && selected?.has(state.generatorSelectedTemplateId)
      ? { generatorSelectedTemplateId: selected.get(state.generatorSelectedTemplateId)! } : {}),
    ...(state.generatorSelectedBackingTemplateId && selected?.has(state.generatorSelectedBackingTemplateId)
      ? { generatorSelectedBackingTemplateId: selected.get(state.generatorSelectedBackingTemplateId)! } : {}),
  };
};

export const createOutputSlice: StateCreator<ProjectState, [], [], OutputSlice> = (set, get) => ({
  storedCards: [],
  cardRemovalRecoveries: [],
  bulkRevisionUndo: null,
  editingCardUniqueId: null,
  isEditDialogOpen: false,

  addGeneratedCards: (newCards) => {
    const activeCardSet = get().activeCardSet;
    if (!activeCardSet) return;
    const storedCards = newCards.map((card) => ({
      uniqueId: card.uniqueId,
      templateId: card.template.id!,
      backingTemplateId: card.backingTemplateId ?? card.backingTemplate?.id ?? null,
      ...(card.backingData ? { backingData: card.backingData } : {}),
      setId: card.setId ?? activeCardSet.id,
      setName: card.setName ?? activeCardSet.name,
      data: card.data,
      ...(card.tagIds?.length ? { tagIds: card.tagIds } : {}),
      ...(card.updatedAt ? { updatedAt: card.updatedAt } : {}),
    }));
    set((state) => withCardSetTemplateReferences(state, [...state.storedCards, ...storedCards]));
  },
  clearGeneratedCards: () => set((state) => ({
    ...withCardSetTemplateReferences(state, state.activeCardSet
      ? state.storedCards.filter((card) => (card.setId || state.cardSets[0]?.id) !== state.activeCardSet?.id)
      : state.storedCards),
    cardRemovalRecoveries: state.cardRemovalRecoveries.filter((entry) => entry.setId !== state.activeCardSet?.id),
  })),
  removeGeneratedCard: (cardUniqueId) => {
    get().removeGeneratedCards([cardUniqueId]);
  },
  removeGeneratedCards: (cardUniqueIds) => {
    const removals = new Set(cardUniqueIds);
    if (!removals.size) return 0;
    const state = get();
    const removed = state.storedCards.filter((card) => removals.has(card.uniqueId));
    if (!removed.length) return 0;
    const templates = new Set(selectAllTemplates(state).map((template) => template.id));
    const order = state.storedCards.map((card) => card.uniqueId);
    const visibleCards = selectAllGeneratedDisplayCards(state);
    const recoveries = state.cardSets.flatMap((owner) => {
      const cards = removed.filter((card) => (card.setId || state.cardSets[0]?.id) === owner.id);
      if (!cards.length) return [];
      return [{
        id: nanoid(), setId: owner.id, cards: structuredClone(cards), order,
        setOrder: visibleCards.filter((card) => (card.setId ?? state.cardSets[0]?.id) === owner.id).map((card) => card.uniqueId),
        requiredTemplateIds: [...new Set(cards.flatMap((card) => [card.templateId, card.backingTemplateId])
          .filter((id): id is string => Boolean(id && templates.has(id))))],
      }];
    });
    set((state) => {
      const removedActiveEdit = state.editingCardUniqueId !== null && removals.has(state.editingCardUniqueId);
      return {
        ...withCardSetTemplateReferences(state, state.storedCards.filter((card) => !removals.has(card.uniqueId))),
        cardRemovalRecoveries: [...state.cardRemovalRecoveries, ...recoveries],
        editingCardUniqueId: removedActiveEdit ? null : state.editingCardUniqueId,
        isEditDialogOpen: removedActiveEdit ? false : state.isEditDialogOpen,
      };
    });
    return removed.length;
  },
  undoCardRemoval: (recoveryId) => {
    const state = get();
    const recovery = state.cardRemovalRecoveries.find((entry) => entry.id === recoveryId);
    if (!recovery) return { ok: false, reason: 'not-found' };
    if (state.cardRemovalRecoveries.findLast((entry) => entry.setId === recovery.setId) !== recovery) return { ok: false, reason: 'newer-removal' };
    const owner = state.cardSets.find((candidate) => candidate.id === recovery.setId);
    const templateIds = new Set(selectAllTemplates(state).map((template) => template.id));
    const currentIds = new Set(state.storedCards.map((card) => card.uniqueId));
    if (!owner) return { ok: false, reason: 'not-found' };
    if (recovery.requiredTemplateIds.some((id) => !templateIds.has(id))) return { ok: false, reason: 'template-unavailable' };
    if (recovery.cards.some((card) => currentIds.has(card.uniqueId))) return { ok: false, reason: 'conflict' };
    const snapshots = new Map(recovery.cards.map((card) => [card.uniqueId, { ...structuredClone(card), setId: owner.id, setName: owner.name }]));
    const successors = new Map<string, string>();
    let next: string | undefined;
    for (let index = recovery.order.length - 1; index >= 0; index -= 1) {
      const id = recovery.order[index]!;
      if (currentIds.has(id)) next = id;
      else if (next && snapshots.has(id)) successors.set(id, next);
    }
    const before = new Map<string, StoredDisplayCard[]>();
    const after = new Map<string, StoredDisplayCard[]>();
    const trailing: StoredDisplayCard[] = [];
    let previous: string | undefined;
    for (const id of recovery.order) {
      if (currentIds.has(id)) previous = id;
      const card = snapshots.get(id);
      if (!card) continue;
      const successor = successors.get(id);
      const anchor = successor ?? previous;
      if (!anchor) trailing.push(card);
      else {
        const groups = successor ? before : after;
        const group = groups.get(anchor) ?? [];
        group.push(card);
        groups.set(anchor, group);
      }
    }
    const restored = state.storedCards.flatMap((card) => [...(before.get(card.uniqueId) ?? []), card, ...(after.get(card.uniqueId) ?? [])]).concat(trailing);
    set({ ...withCardSetTemplateReferences(state, restored), cardRemovalRecoveries: state.cardRemovalRecoveries.filter((entry) => entry.id !== recoveryId) });
    return { ok: true, count: recovery.cards.length };
  },
  dismissCardRemoval: (recoveryId) => {
    if (get().cardRemovalRecoveries.some((entry) => entry.id === recoveryId)) {
      set((state) => ({ cardRemovalRecoveries: state.cardRemovalRecoveries.filter((entry) => entry.id !== recoveryId) }));
    }
  },
  moveGeneratedCardToSet: (cardUniqueId, setId) => (
    get().moveGeneratedCardsToSet([cardUniqueId], setId) === 1
  ),
  moveGeneratedCardsToSet: (cardUniqueIds, setId) => {
    const targetSet = get().cardSets.find((candidate) => candidate.id === setId);
    if (!targetSet) return 0;
    const moving = new Set(cardUniqueIds);
    if (!moving.size) return 0;
    let changedCount = 0;
    set((state) => {
      const storedCards = state.storedCards.map((card) => {
        if (!moving.has(card.uniqueId) || card.setId === targetSet.id) return card;
        changedCount += 1;
        return { ...card, setId: targetSet.id, setName: targetSet.name };
      });
      return withCardSetTemplateReferences(state, storedCards);
    });
    return changedCount;
  },
  reorderGeneratedCard: (cardUniqueId, direction) => {
    const cards = get().storedCards;
    const currentIndex = cards.findIndex((card) => card.uniqueId === cardUniqueId);
    if (currentIndex < 0) return false;
    const current = cards[currentIndex];
    const sameSet = (card: StoredDisplayCard) => card.setId === current.setId;
    let swapIndex = -1;
    if (direction === 'earlier') {
      for (let index = currentIndex - 1; index >= 0; index -= 1) {
        if (sameSet(cards[index])) { swapIndex = index; break; }
      }
    } else {
      for (let index = currentIndex + 1; index < cards.length; index += 1) {
        if (sameSet(cards[index])) { swapIndex = index; break; }
      }
    }
    if (swapIndex < 0) return false;
    const reordered = [...cards];
    [reordered[currentIndex], reordered[swapIndex]] = [reordered[swapIndex], reordered[currentIndex]];
    set({ storedCards: reordered });
    return true;
  },
  updateGeneratedCard: (updatedCard) => set((state) => {
    const storedCards = state.storedCards.map((card) => card.uniqueId === updatedCard.uniqueId
      ? toStoredCard(updatedCard, card)
      : card);
    return withCardSetTemplateReferences(state, storedCards);
  }),
  reviseGeneratedCards: (updatedCards) => {
    const byId = new Map(updatedCards.map((card) => [card.uniqueId, card]));
    const previous = get().storedCards.filter((card) => byId.has(card.uniqueId));
    if (!previous.length || previous.length !== byId.size) return 0;
    set((state) => {
      const storedCards = state.storedCards.map((card) => {
        const update = byId.get(card.uniqueId);
        return update ? toStoredCard(update, card) : card;
      });
      return {
        ...withCardSetTemplateReferences(state, storedCards),
        bulkRevisionUndo: previous.map((card) => structuredClone(card)),
      };
    });
    return previous.length;
  },
  undoLastBulkRevision: () => {
    const previous = get().bulkRevisionUndo;
    if (!previous?.length) return 0;
    const byId = new Map(previous.map((card) => [card.uniqueId, card]));
    set((state) => ({
      ...withCardSetTemplateReferences(state, state.storedCards.map((card) => byId.get(card.uniqueId) ?? card)),
      bulkRevisionUndo: null,
    }));
    return previous.length;
  },
  retargetGeneratedCardsTemplate: (fromTemplateId, toTemplateId) => set((state) => {
    if (!fromTemplateId || !toTemplateId || fromTemplateId === toTemplateId) return state;
    let changed = false;
    const storedCards = state.storedCards.map((card) => {
      if (card.templateId !== fromTemplateId) return card;
      changed = true;
      return { ...card, templateId: toTemplateId };
    });
    return changed ? withCardSetTemplateReferences(state, storedCards) : state;
  }),
  retargetGeneratedCardsBackingTemplate: (fromTemplateId, toTemplateId) => set((state) => {
    if (!fromTemplateId || !toTemplateId || fromTemplateId === toTemplateId) return state;
    let changed = false;
    const storedCards = state.storedCards.map((card) => {
      if (card.backingTemplateId !== fromTemplateId) return card;
      changed = true;
      return { ...card, backingTemplateId: toTemplateId };
    });
    return changed ? withCardSetTemplateReferences(state, storedCards) : state;
  }),
  setStoredCardsFromFile: (loadedCards) => {
    const activeCardSet = ensureImportSet(get);
    const templates = selectAllTemplates(get());
    let successCount = 0;
    let skippedCount = 0;
    const storedCards: StoredDisplayCard[] = [];

    loadedCards.forEach((card) => {
      const template = templates.find((candidate) => candidate.id === card.templateId);
      if (!template) {
        skippedCount += 1;
        return;
      }
      const targetSet = card.setId
        ? get().cardSets.find((candidate) => candidate.id === card.setId)
        : activeCardSet;
      storedCards.push({
        uniqueId: card.uniqueId || nanoid(),
        templateId: template.id!,
        backingTemplateId: card.backingTemplateId ?? null,
        backingData: card.backingData,
        setId: targetSet?.id ?? activeCardSet.id,
        setName: targetSet?.name ?? card.setName ?? activeCardSet.name,
        data: card.data || {},
        ...(normalizeCardTagIds(card.tagIds).length ? { tagIds: normalizeCardTagIds(card.tagIds) } : {}),
        ...(card.updatedAt && !Number.isNaN(Date.parse(card.updatedAt)) ? { updatedAt: card.updatedAt } : {}),
      });
      successCount += 1;
    });
    set((state) => ({ ...withCardSetTemplateReferences(state, storedCards), cardRemovalRecoveries: [] }));
    return { successCount, skippedCount };
  },
  mergeStoredCardsFromFile: (loadedCards) => {
    const activeCardSet = ensureImportSet(get);
    const templates = selectAllTemplates(get());
    const merged = new Map<string, StoredDisplayCard>();
    get().storedCards.forEach((card) => merged.set(card.uniqueId || nanoid(), card));
    let successCount = 0;
    let skippedCount = 0;

    const importedSetIds = new Set<string>();

    loadedCards.forEach((card) => {
      const template = templates.find((candidate) => candidate.id === card.templateId);
      if (!template) {
        skippedCount += 1;
        return;
      }
      const targetSet = card.setId
        ? get().cardSets.find((candidate) => candidate.id === card.setId)
        : activeCardSet;
      const uniqueId = card.uniqueId || nanoid();
      importedSetIds.add(targetSet?.id ?? activeCardSet.id);
      merged.set(uniqueId, {
        uniqueId,
        templateId: template.id!,
        backingTemplateId: card.backingTemplateId ?? null,
        ...(card.backingData !== undefined ? { backingData: card.backingData } : {}),
        setId: targetSet?.id ?? activeCardSet.id,
        setName: targetSet?.name ?? card.setName ?? activeCardSet.name,
        data: card.data || {},
        ...(normalizeCardTagIds(card.tagIds).length ? { tagIds: normalizeCardTagIds(card.tagIds) } : {}),
        ...(card.updatedAt && !Number.isNaN(Date.parse(card.updatedAt)) ? { updatedAt: card.updatedAt } : {}),
      });
      successCount += 1;
    });
    set((state) => ({
      ...withCardSetTemplateReferences(state, Array.from(merged.values())),
      cardRemovalRecoveries: state.cardRemovalRecoveries.filter((entry) => !importedSetIds.has(entry.setId)),
    }));
    return { successCount, skippedCount };
  },
  openEditDialog: (cardUniqueId) => set({ editingCardUniqueId: cardUniqueId, isEditDialogOpen: true }),
  closeEditDialog: () => set({ editingCardUniqueId: null, isEditDialogOpen: false }),
});
