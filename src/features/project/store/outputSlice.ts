import { nanoid } from 'nanoid';
import type { StateCreator } from 'zustand';

import type { StoredDisplayCard } from '@/domain/cards';

import { selectAllTemplates } from './selectors';
import type { OutputSlice, ProjectState } from './types';
import { createDefaultActiveCardSet } from './workspaceDefaults';

export const createOutputSlice: StateCreator<ProjectState, [], [], OutputSlice> = (set, get) => ({
  storedCards: [],
  editingCardUniqueId: null,
  isEditDialogOpen: false,

  addGeneratedCards: (newCards) => {
    const activeCardSet = get().activeCardSet;
    const storedCards = newCards.map((card) => ({
      uniqueId: card.uniqueId,
      templateId: card.template.id!,
      backingTemplateId: card.backingTemplateId ?? card.backingTemplate?.id ?? activeCardSet.backingTemplateId,
      setId: card.setId ?? activeCardSet.id,
      setName: card.setName ?? activeCardSet.name,
      data: card.data,
    }));
    set((state) => ({ storedCards: [...state.storedCards, ...storedCards] }));
  },
  clearGeneratedCards: () => set({ storedCards: [] }),
  removeGeneratedCard: (cardUniqueId) => set((state) => {
    const storedCards = state.storedCards.filter((card) => card.uniqueId !== cardUniqueId);
    if (storedCards.length === state.storedCards.length) return state;
    const removedActiveEdit = state.editingCardUniqueId === cardUniqueId;
    return {
      storedCards,
      editingCardUniqueId: removedActiveEdit ? null : state.editingCardUniqueId,
      isEditDialogOpen: removedActiveEdit ? false : state.isEditDialogOpen,
    };
  }),
  updateGeneratedCard: (updatedCard) => set((state) => ({
    storedCards: state.storedCards.map((card) => card.uniqueId === updatedCard.uniqueId
      ? {
          uniqueId: updatedCard.uniqueId,
          templateId: updatedCard.template.id!,
          backingTemplateId: updatedCard.backingTemplateId
            ?? updatedCard.backingTemplate?.id
            ?? card.backingTemplateId
            ?? null,
          setId: updatedCard.setId ?? card.setId,
          setName: updatedCard.setName ?? card.setName,
          data: updatedCard.data,
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
    const templates = selectAllTemplates(get());
    const activeCardSet = get().activeCardSet || createDefaultActiveCardSet();
    let successCount = 0;
    let skippedCount = 0;
    const storedCards: StoredDisplayCard[] = [];

    loadedCards.forEach((card) => {
      const template = templates.find((candidate) => candidate.id === card.templateId);
      if (!template) {
        skippedCount += 1;
        return;
      }
      storedCards.push({
        uniqueId: card.uniqueId || nanoid(),
        templateId: template.id!,
        backingTemplateId: card.backingTemplateId ?? null,
        setId: card.setId ?? activeCardSet.id,
        setName: card.setName ?? activeCardSet.name,
        data: card.data || {},
      });
      successCount += 1;
    });
    set({ storedCards });
    return { successCount, skippedCount };
  },
  mergeStoredCardsFromFile: (loadedCards) => {
    const templates = selectAllTemplates(get());
    const activeCardSet = get().activeCardSet || createDefaultActiveCardSet();
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
      const uniqueId = card.uniqueId || nanoid();
      merged.set(uniqueId, {
        uniqueId,
        templateId: template.id!,
        backingTemplateId: card.backingTemplateId ?? null,
        setId: card.setId ?? activeCardSet.id,
        setName: card.setName ?? activeCardSet.name,
        data: card.data || {},
      });
      successCount += 1;
    });
    set({ storedCards: Array.from(merged.values()) });
    return { successCount, skippedCount };
  },
  openEditDialog: (cardUniqueId) => set({ editingCardUniqueId: cardUniqueId, isEditDialogOpen: true }),
  closeEditDialog: () => set({ editingCardUniqueId: null, isEditDialogOpen: false }),
});
