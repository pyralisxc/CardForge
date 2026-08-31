import { nanoid } from 'nanoid';
import type { StateCreator } from 'zustand';

import { normalizeCardTagIds, type StoredDisplayCard } from '@/domain/cards';

import { selectAllTemplates } from './selectors';
import type { OutputSlice, ProjectState } from './types';

const ensureImportSet = (getState: () => ProjectState): NonNullable<ProjectState['activeCardSet']> => {
  const state = getState();
  if (state.activeCardSet) return state.activeCardSet;
  const id = state.createCardSet('Recovered Set');
  const nextState = getState();
  const set = nextState.cardSets.find((candidate) => candidate.id === id) ?? nextState.activeCardSet;
  if (!set) throw new Error('CardForge could not create the required Set.');
  return set;
};

export const createOutputSlice: StateCreator<ProjectState, [], [], OutputSlice> = (set, get) => ({
  storedCards: [],
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
    set((state) => ({ storedCards: [...state.storedCards, ...storedCards] }));
  },
  clearGeneratedCards: () => set((state) => ({
    storedCards: state.activeCardSet
      ? state.storedCards.filter((card) => card.setId && card.setId !== state.activeCardSet?.id)
      : state.storedCards,
  })),
  removeGeneratedCard: (cardUniqueId) => {
    get().removeGeneratedCards([cardUniqueId]);
  },
  removeGeneratedCards: (cardUniqueIds) => {
    const removals = new Set(cardUniqueIds);
    if (!removals.size) return 0;
    const removedCount = get().storedCards.filter((card) => removals.has(card.uniqueId)).length;
    if (!removedCount) return 0;
    set((state) => {
      const removedActiveEdit = state.editingCardUniqueId !== null && removals.has(state.editingCardUniqueId);
      return {
        storedCards: state.storedCards.filter((card) => !removals.has(card.uniqueId)),
        editingCardUniqueId: removedActiveEdit ? null : state.editingCardUniqueId,
        isEditDialogOpen: removedActiveEdit ? false : state.isEditDialogOpen,
      };
    });
    return removedCount;
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
    set((state) => ({
      storedCards: state.storedCards.map((card) => {
        if (!moving.has(card.uniqueId) || card.setId === targetSet.id) return card;
        changedCount += 1;
        return { ...card, setId: targetSet.id, setName: targetSet.name };
      }),
    }));
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
  updateGeneratedCard: (updatedCard) => set((state) => ({
    storedCards: state.storedCards.map((card) => card.uniqueId === updatedCard.uniqueId
      ? {
          uniqueId: updatedCard.uniqueId,
          templateId: updatedCard.template.id!,
          backingTemplateId: updatedCard.backingTemplateId
            ?? updatedCard.backingTemplate?.id
            ?? card.backingTemplateId
            ?? null,
          backingData: updatedCard.backingData,
          setId: updatedCard.setId ?? card.setId,
          setName: updatedCard.setName ?? card.setName,
          data: updatedCard.data,
          tagIds: updatedCard.tagIds ?? card.tagIds,
          updatedAt: new Date().toISOString(),
        }
      : card),
  })),
  retargetGeneratedCardsTemplate: (fromTemplateId, toTemplateId) => set((state) => {
    if (!fromTemplateId || !toTemplateId || fromTemplateId === toTemplateId) return state;
    let changed = false;
    const storedCards = state.storedCards.map((card) => {
      if (card.templateId !== fromTemplateId) return card;
      changed = true;
      return { ...card, templateId: toTemplateId };
    });
    return changed ? { storedCards } : state;
  }),
  retargetGeneratedCardsBackingTemplate: (fromTemplateId, toTemplateId) => set((state) => {
    if (!fromTemplateId || !toTemplateId || fromTemplateId === toTemplateId) return state;
    let changed = false;
    const storedCards = state.storedCards.map((card) => {
      if (card.backingTemplateId !== fromTemplateId) return card;
      changed = true;
      return { ...card, backingTemplateId: toTemplateId };
    });
    return changed ? { storedCards } : state;
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
    set({ storedCards });
    return { successCount, skippedCount };
  },
  mergeStoredCardsFromFile: (loadedCards) => {
    const activeCardSet = ensureImportSet(get);
    const templates = selectAllTemplates(get());
    const merged = new Map<string, StoredDisplayCard>();
    get().storedCards.forEach((card) => merged.set(card.uniqueId || nanoid(), card));
    let successCount = 0;
    let skippedCount = 0;

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
      merged.set(uniqueId, {
        uniqueId,
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
    set({ storedCards: Array.from(merged.values()) });
    return { successCount, skippedCount };
  },
  openEditDialog: (cardUniqueId) => set({ editingCardUniqueId: cardUniqueId, isEditDialogOpen: true }),
  closeEditDialog: () => set({ editingCardUniqueId: null, isEditDialogOpen: false }),
});
