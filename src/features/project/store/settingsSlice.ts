import { nanoid } from 'nanoid';
import type { StateCreator } from 'zustand';

import { reconcileCardSets, resolveActiveCardSet, type CardSet } from '@/domain/cards';
import { areTemplateFormatsCompatible } from '@/domain/card-formats';
import { PAPER_SIZES } from '@/domain/rendering';

import { selectAllTemplates } from './selectors';
import type { ProjectState, SettingsSlice } from './types';
import { normalizeStudioView } from './workspaceDefaults';

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

const activateCardSet = (state: ProjectState, set: CardSet) => {
  return {
    cardSets: upsertCardSet(state.cardSets, set),
    activeCardSet: set,
  };
};

export const createSettingsSlice: StateCreator<ProjectState, [], [], SettingsSlice> = (set, get) => {
  return {
    selectedPaperSize: PAPER_SIZES[0],
    studioView: 'template',
    richTextHighlightColor: '#ffd700',
    cardSets: [],
    activeCardSet: null,
    generatorSelectedTemplateId: null,
    generatorSelectedBackingTemplateId: null,
    templateEditorSelectedTemplateId: null,
    pdfMarginMm: 5,
    pdfCardSpacingMm: 0,
    pdfIncludeCutLines: false,
    pdfDuplexLayout: 'separate-pages',
    exportMode: 'physical',
    exportDpi: 300,

    setSelectedPaperSize: (size) => set({ selectedPaperSize: size }),
    setStudioView: (view) => set({ studioView: normalizeStudioView(view) }),
    setRichTextHighlightColor: (color) => set({ richTextHighlightColor: color }),
    createCardSet: (name) => {
      const id = `set-${nanoid()}`;
      set((state) => {
        const nextSet: CardSet = {
          id,
          name: name?.trim() || 'Untitled Set',
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
          activeCardSet: state.activeCardSet?.id === id ? renamedSet : state.activeCardSet,
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
        const sourceCards = state.storedCards.filter((card) => card.setId === id);
        const cardIds = new Map(sourceCards.map((card) => [card.uniqueId, `card-${nanoid()}`]));
        const tagIds = new Map((source.organization?.tags ?? []).map((tag) => [tag.id, `tag-${nanoid()}`]));
        const organization = source.organization ? {
          ...source.organization,
          tags: source.organization.tags.map((tag) => ({ ...tag, id: tagIds.get(tag.id)! })),
          groupTagId: source.organization.groupTagId ? tagIds.get(source.organization.groupTagId) : undefined,
          positions: Object.fromEntries(Object.entries(source.organization.positions).flatMap(([cardId, position]) => {
            const nextId = cardIds.get(cardId);
            return nextId ? [[nextId, position] as const] : [];
          })),
        } : undefined;
        const duplicate: CardSet = {
          ...source,
          id: duplicateId,
          name: duplicateName,
          ...(organization ? { organization } : {}),
        };
        return {
          ...activateCardSet(state, duplicate),
          storedCards: [
            ...state.storedCards,
            ...sourceCards.map((card) => ({
                ...card,
                uniqueId: cardIds.get(card.uniqueId)!,
                setId: duplicateId,
                setName: duplicateName,
                tagIds: card.tagIds?.flatMap((tagId) => tagIds.get(tagId) ? [tagIds.get(tagId)!] : []),
              })),
          ],
        };
      });
      return duplicateId;
    },
    deleteCardSet: (id) => {
      const current = get();
      if (!current.cardSets.some((candidate) => candidate.id === id)) return false;
      set((state) => {
        const cardSets = state.cardSets.filter((candidate) => candidate.id !== id);
        if (cardSets.length === 0) {
          return {
            cardSets: [],
            activeCardSet: null,
            storedCards: state.storedCards.filter((card) => card.setId !== id),
          };
        }
        const requested = state.activeCardSet?.id === id
          ? cardSets[0]
          : cardSets.find((candidate) => candidate.id === state.activeCardSet?.id);
        if (!requested) return state;
        return {
          cardSets,
          activeCardSet: requested,
          storedCards: state.storedCards.filter((card) => card.setId !== id),
        };
      });
      return true;
    },
    setCardSetsFromFiles: (sets, activeSetId) => {
      const state = get();
      const cardSets = reconcileCardSets({ cardSets: sets, storedCards: state.storedCards });
      const activeCardSet = resolveActiveCardSet({ cardSets, preferredId: activeSetId });
      set({
        cardSets,
        activeCardSet,
      });
      return cardSets.length;
    },
    mergeCardSetsFromFiles: (sets, activeSetId) => {
      const state = get();
      const imported = reconcileCardSets({ cardSets: sets });
      const merged = new Map(state.cardSets.map((set) => [set.id, set]));
      imported.forEach((set) => merged.set(set.id, set));
      const cardSets = Array.from(merged.values());
      const requested = resolveActiveCardSet({
        cardSets,
        preferredId: activeSetId ?? state.activeCardSet?.id,
      });
      set({
        cardSets,
        activeCardSet: requested,
      });
      return imported.length;
    },
    setActiveCardSetName: (name) => set((state) => {
      if (!state.activeCardSet) return state;
      const activeCardSet = { ...state.activeCardSet, name: name.trim() || 'Untitled Set' };
      return {
        activeCardSet,
        cardSets: upsertCardSet(state.cardSets, activeCardSet),
        storedCards: state.storedCards.map((card) => card.setId === activeCardSet.id
          ? { ...card, setName: activeCardSet.name }
          : card),
      };
    }),
    setGeneratorSelectedTemplateId: (id) => set((state) => ({
      generatorSelectedTemplateId: id,
      generatorSelectedBackingTemplateId: getCompatibleBackingId(
        state,
        id,
        state.generatorSelectedBackingTemplateId,
      ),
    })),
    setGeneratorSelectedBackingTemplateId: (id) => set((state) => ({
      generatorSelectedBackingTemplateId: getCompatibleBackingId(
        state,
        state.generatorSelectedTemplateId,
        id,
      ),
    })),
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
