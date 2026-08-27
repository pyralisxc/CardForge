import { nanoid } from 'nanoid';
import type { StateCreator } from 'zustand';

import { reconcileCardSets, resolveActiveCardSet, type CardSet } from '@/domain/cards';
import { areTemplateFormatsCompatible } from '@/domain/card-formats';
import { PAPER_SIZES } from '@/domain/rendering';

import { resolveGeneratorFrontTemplateId, selectAllTemplates } from './selectors';
import type { ProjectState, SettingsSlice } from './types';
import { createDefaultActiveCardSet, normalizeActiveTab, WORKSPACE_TABS } from './workspaceDefaults';

const getCompatibleBackingId = (
  state: ProjectState,
  frontTemplateId: string | null,
  backingTemplateId: string | null,
): string | null => {
  if (!backingTemplateId) return null;
  const templates = selectAllTemplates(state);
  const front = templates.find((template) => template.id === frontTemplateId);
  const back = templates.find((template) => template.id === backingTemplateId && template.templateUsage === 'back-preset');
  return front && back && areTemplateFormatsCompatible(front, back) ? backingTemplateId : null;
};

const upsertCardSet = (sets: CardSet[], nextSet: CardSet): CardSet[] => {
  const next = [...sets];
  const index = next.findIndex((set) => set.id === nextSet.id);
  if (index >= 0) next[index] = nextSet;
  else next.push(nextSet);
  return next;
};

const normalizeSetForState = (state: ProjectState, set: CardSet): CardSet => {
  const templates = selectAllTemplates(state);
  const frontTemplateId = resolveGeneratorFrontTemplateId(templates, set.frontTemplateId);
  return {
    ...set,
    frontTemplateId,
    backingTemplateId: getCompatibleBackingId(state, frontTemplateId, set.backingTemplateId),
  };
};

const activateCardSet = (state: ProjectState, set: CardSet) => {
  const activeCardSet = normalizeSetForState(state, set);
  return {
    cardSets: upsertCardSet(state.cardSets, activeCardSet),
    activeCardSet,
    singleCardGeneratorSelectedTemplateId: activeCardSet.frontTemplateId,
  };
};

const retargetSetCards = (
  state: ProjectState,
  activeCardSet: CardSet,
) => state.storedCards.map((card) => (
  card.setId === activeCardSet.id
    ? {
        ...card,
        setName: activeCardSet.name,
        templateId: activeCardSet.frontTemplateId ?? card.templateId,
        backingTemplateId: activeCardSet.backingTemplateId,
      }
    : card
));

export const createSettingsSlice: StateCreator<ProjectState, [], [], SettingsSlice> = (set, get) => {
  const initialSet = createDefaultActiveCardSet();
  return {
    selectedPaperSize: PAPER_SIZES[0],
    activeTab: WORKSPACE_TABS[0],
    richTextHighlightColor: '#ffd700',
    cardSets: [initialSet],
    activeCardSet: initialSet,
    singleCardGeneratorSelectedTemplateId: null,
    templateEditorSelectedTemplateId: null,
    pdfMarginMm: 5,
    pdfCardSpacingMm: 0,
    pdfIncludeCutLines: false,
    pdfDuplexLayout: 'separate-pages',
    exportMode: 'physical',
    exportDpi: 300,

    setSelectedPaperSize: (size) => set({ selectedPaperSize: size }),
    setActiveTab: (tab) => set({ activeTab: normalizeActiveTab(tab) }),
    setRichTextHighlightColor: (color) => set({ richTextHighlightColor: color }),
    createCardSet: (name) => {
      const id = `set-${nanoid()}`;
      set((state) => {
        const nextSet: CardSet = {
          id,
          name: name?.trim() || 'Untitled Set',
          frontTemplateId: state.singleCardGeneratorSelectedTemplateId,
          backingTemplateId: null,
        };
        return activateCardSet(state, nextSet);
      });
      return id;
    },
    setActiveCardSetId: (id) => set((state) => {
      const requested = state.cardSets.find((candidate) => candidate.id === id);
      return requested ? activateCardSet(state, requested) : state;
    }),
    renameCardSet: (id, name) => {
      const requestedName = name.trim() || 'Untitled Set';
      if (!get().cardSets.some((candidate) => candidate.id === id)) return false;
      set((state) => {
        const currentSet = state.cardSets.find((candidate) => candidate.id === id);
        if (!currentSet) return state;
        const renamedSet = { ...currentSet, name: requestedName };
        return {
          cardSets: upsertCardSet(state.cardSets, renamedSet),
          activeCardSet: state.activeCardSet.id === id ? renamedSet : state.activeCardSet,
          storedCards: state.storedCards.map((card) => card.setId === id
            ? { ...card, setName: requestedName }
            : card),
        };
      });
      return true;
    },
    duplicateCardSet: (id) => {
      const source = get().cardSets.find((candidate) => candidate.id === id);
      if (!source) return null;
      const duplicateId = `set-${nanoid()}`;
      const duplicateName = `${source.name} copy`;
      set((state) => {
        const duplicate = normalizeSetForState(state, {
          ...source,
          id: duplicateId,
          name: duplicateName,
        });
        return {
          ...activateCardSet(state, duplicate),
          storedCards: [
            ...state.storedCards,
            ...state.storedCards
              .filter((card) => card.setId === id)
              .map((card) => ({
                ...card,
                uniqueId: `card-${nanoid()}`,
                setId: duplicateId,
                setName: duplicateName,
              })),
          ],
        };
      });
      return duplicateId;
    },
    deleteCardSet: (id) => {
      const current = get();
      if (current.cardSets.length <= 1 || !current.cardSets.some((candidate) => candidate.id === id)) return false;
      set((state) => {
        const cardSets = state.cardSets.filter((candidate) => candidate.id !== id);
        const requested = state.activeCardSet.id === id
          ? cardSets[0]
          : cardSets.find((candidate) => candidate.id === state.activeCardSet.id);
        if (!requested) return state;
        const activeCardSet = normalizeSetForState(state, requested);
        return {
          cardSets,
          activeCardSet,
          singleCardGeneratorSelectedTemplateId: activeCardSet.frontTemplateId,
          storedCards: state.storedCards.filter((card) => card.setId !== id),
        };
      });
      return true;
    },
    setCardSetsFromFiles: (sets, activeSetId) => {
      const state = get();
      const fallback = createDefaultActiveCardSet();
      const cardSets = reconcileCardSets({ cardSets: sets, storedCards: state.storedCards, fallback });
      const requested = resolveActiveCardSet({ cardSets, preferredId: activeSetId, fallback });
      const activeCardSet = normalizeSetForState(state, requested);
      set({
        cardSets: upsertCardSet(cardSets, activeCardSet),
        activeCardSet,
        singleCardGeneratorSelectedTemplateId: activeCardSet.frontTemplateId,
      });
      return cardSets.length;
    },
    mergeCardSetsFromFiles: (sets, activeSetId) => {
      const state = get();
      const fallback = createDefaultActiveCardSet();
      const imported = reconcileCardSets({ cardSets: sets, fallback });
      const merged = new Map(state.cardSets.map((set) => [set.id, set]));
      imported.forEach((set) => merged.set(set.id, set));
      const cardSets = Array.from(merged.values());
      const requested = resolveActiveCardSet({
        cardSets,
        preferredId: activeSetId ?? state.activeCardSet.id,
        fallback,
      });
      const activeCardSet = normalizeSetForState(state, requested);
      set({
        cardSets: upsertCardSet(cardSets, activeCardSet),
        activeCardSet,
        singleCardGeneratorSelectedTemplateId: activeCardSet.frontTemplateId,
      });
      return imported.length;
    },
    setActiveCardSetName: (name) => set((state) => {
      const activeCardSet = { ...state.activeCardSet, name: name.trim() || 'Untitled Set' };
      return {
        activeCardSet,
        cardSets: upsertCardSet(state.cardSets, activeCardSet),
        storedCards: retargetSetCards(state, activeCardSet),
      };
    }),
    setActiveCardSetFrontTemplateId: (id) => set((state) => {
      const activeCardSet = {
        ...state.activeCardSet,
        frontTemplateId: id,
        backingTemplateId: getCompatibleBackingId(state, id, state.activeCardSet.backingTemplateId),
      };
      return {
        activeCardSet,
        cardSets: upsertCardSet(state.cardSets, activeCardSet),
        storedCards: retargetSetCards(state, activeCardSet),
        singleCardGeneratorSelectedTemplateId: id,
      };
    }),
    setActiveCardSetBackingTemplateId: (id) => set((state) => {
      const frontTemplateId = resolveGeneratorFrontTemplateId(
        selectAllTemplates(state),
        state.singleCardGeneratorSelectedTemplateId,
      );
      const activeCardSet = {
        ...state.activeCardSet,
        frontTemplateId,
        backingTemplateId: getCompatibleBackingId(state, frontTemplateId, id),
      };
      return {
        singleCardGeneratorSelectedTemplateId: frontTemplateId,
        activeCardSet,
        cardSets: upsertCardSet(state.cardSets, activeCardSet),
        storedCards: retargetSetCards(state, activeCardSet),
      };
    }),
    setSingleCardGeneratorSelectedTemplateId: (id) => set((state) => {
      const activeCardSet = {
        ...state.activeCardSet,
        frontTemplateId: id,
        backingTemplateId: getCompatibleBackingId(state, id, state.activeCardSet.backingTemplateId),
      };
      return {
        singleCardGeneratorSelectedTemplateId: id,
        activeCardSet,
        cardSets: upsertCardSet(state.cardSets, activeCardSet),
        storedCards: retargetSetCards(state, activeCardSet),
      };
    }),
    setTemplateEditorSelectedTemplateId: (id) => set({ templateEditorSelectedTemplateId: id }),
    setPdfOptions: (options) => set((state) => ({
      pdfMarginMm: options.margin !== undefined ? Math.max(0, options.margin) : state.pdfMarginMm,
      pdfCardSpacingMm: options.spacing !== undefined ? Math.max(0, options.spacing) : state.pdfCardSpacingMm,
      pdfIncludeCutLines: options.cutLines !== undefined ? options.cutLines : state.pdfIncludeCutLines,
      pdfDuplexLayout: options.duplexLayout ?? state.pdfDuplexLayout,
    })),
    setExportMode: (mode) => set({ exportMode: mode }),
    setExportDpi: (dpi) => set({ exportDpi: Math.min(1200, Math.max(72, Math.round(dpi))) }),
  };
};
