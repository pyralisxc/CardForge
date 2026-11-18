import { nanoid } from 'nanoid';
import type { StateCreator } from 'zustand';

import { authoredPlanValuesEqual, reconcileCardSets, resolveActiveCardSet, type CardSet } from '@/domain/cards';
import { areTemplateFormatsCompatible } from '@/domain/card-formats';
import { PAPER_SIZES } from '@/domain/rendering';
import { createPersonalTemplateFork, reconstructMinimalTemplateObject } from '@/domain/templates';

import { getCardSetTemplateIds, getTemplateOwnerSetId, inheritCompletedSetUpdateReviews, prepareSetTemplateAcquisition, SetTemplateOwnershipError } from '../model/setTemplateOwnership';
import { resolveGeneratorFrontTemplateId, selectAllTemplates } from './selectors';
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

const activateCardSet = (state: ProjectState, set: CardSet) => ({
  cardSets: upsertCardSet(state.cardSets, set),
  activeCardSet: set,
});

const withTemplateReference = (set: CardSet, templateId: string): CardSet => {
  const normalizedId = templateId.trim();
  if (!normalizedId || set.templateIds?.includes(normalizedId)) return set;
  return { ...set, templateIds: [...(set.templateIds ?? []), normalizedId] };
};

const mergeSetUpdateReviews = (
  existing: CardSet['updateReviews'],
  incoming: CardSet['updateReviews'],
): CardSet['updateReviews'] => {
  if (!existing?.length) return incoming?.length ? incoming : existing ?? incoming;
  const bySource = new Map(existing.map((review) => [
    JSON.stringify([review.templateId, review.sourceLineageId, review.sourceRevisionId]), review,
  ]));
  (incoming ?? []).forEach((review) => {
    const key = JSON.stringify([review.templateId, review.sourceLineageId, review.sourceRevisionId]);
    const previous = bySource.get(key);
    if (previous && !authoredPlanValuesEqual(previous, review)) {
      throw new SetTemplateOwnershipError('conflict', 'The imported Set has a conflicting Update Review record. Existing decisions were kept; open an independent copy or resolve the source snapshot before merging.');
    }
    bySource.set(key, structuredClone(review));
  });
  return [...bySource.values()];
};

export const createSettingsSlice: StateCreator<ProjectState, [], [], SettingsSlice> = (set, get) => ({
  selectedPaperSize: PAPER_SIZES[0],
  studioView: 'template',
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
  createCardSet: (name) => {
    const id = `set-${nanoid()}`;
    set((state) => activateCardSet(state, {
      id,
      name: name?.trim() || 'Untitled Set',
    }));
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
    const current = get();
    const source = current.cardSets.find((candidate) => candidate.id === id);
    if (!source) return null;
    const sourceCards = current.storedCards.filter((card) => (
      card.setId === id || (!card.setId && current.cardSets[0]?.id === id)
    ));
    const templateIds = new Set(getCardSetTemplateIds(current, id));
    const sourceTemplates = [...templateIds].map((templateId) => current.userTemplates.find((template) => (
      template.id === templateId && getTemplateOwnerSetId(current, templateId) === id
    )));
    if (sourceTemplates.some((template) => !template)) return null;
    const copiedTemplates = sourceTemplates.map((template) => {
      const sourceTemplate = template!;
      return reconstructMinimalTemplateObject({
        ...createPersonalTemplateFork(structuredClone(sourceTemplate)),
        templateContributorName: sourceTemplate.templateContributorName,
      });
    });
    const copiedTemplateIds = new Map([...templateIds].map((templateId, index) => [templateId, copiedTemplates[index].id!]));
    const duplicateId = `set-${nanoid()}`;
    const duplicateName = `${source.name} copy`;
    set((state) => {
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
        ...(source.organization.templatePositions ? { templatePositions: Object.fromEntries(
          Object.entries(source.organization.templatePositions).flatMap(([templateId, position]) => {
            const nextId = copiedTemplateIds.get(templateId);
            return nextId ? [[nextId, { ...position }] as const] : [];
          }),
        ) } : {}),
      } : undefined;
      const duplicate: CardSet = {
        ...source,
        ...(source.plan ? { plan: structuredClone(source.plan) } : {}),
        id: duplicateId,
        name: duplicateName,
        templateIds: [...templateIds].map((templateId) => copiedTemplateIds.get(templateId)!),
        updateReviews: source.updateReviews?.flatMap((review) => {
          if (review.outcome !== 'reviewed') return [];
          const templateId = copiedTemplateIds.get(review.templateId);
          return templateId ? [{ ...structuredClone(review), templateId }] : [];
        }),
        ...(organization ? { organization } : {}),
      };
      return {
        ...activateCardSet(state, duplicate),
        userTemplates: [...state.userTemplates, ...copiedTemplates],
        storedCards: [
          ...state.storedCards,
          ...sourceCards.map((card) => ({
            ...card,
            uniqueId: cardIds.get(card.uniqueId)!,
            setId: duplicateId,
            setName: duplicateName,
            templateId: copiedTemplateIds.get(card.templateId)!,
            backingTemplateId: card.backingTemplateId ? copiedTemplateIds.get(card.backingTemplateId)! : card.backingTemplateId,
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
      const ownedTemplateIds = new Set(getCardSetTemplateIds(state, id).filter((templateId) => getTemplateOwnerSetId(state, templateId) === id));
      const userTemplates = state.userTemplates.filter((template) => !template.id || !ownedTemplateIds.has(template.id));
      const templates = selectAllTemplates({ ...state, userTemplates });
      const generatorSelectedTemplateId = resolveGeneratorFrontTemplateId(templates, state.generatorSelectedTemplateId);
      const selection = {
        generatorSelectedTemplateId,
        generatorSelectedBackingTemplateId: getCompatibleBackingId({ ...state, userTemplates }, generatorSelectedTemplateId, state.generatorSelectedBackingTemplateId),
        templateEditorSelectedTemplateId: state.templateEditorSelectedTemplateId && ownedTemplateIds.has(state.templateEditorSelectedTemplateId)
          ? generatorSelectedTemplateId : state.templateEditorSelectedTemplateId,
      };
      const cardSets = state.cardSets.filter((candidate) => candidate.id !== id);
      const cardRemovalRecoveries = state.cardRemovalRecoveries.filter((entry) => entry.setId !== id);
      if (cardSets.length === 0) {
        return {
          cardSets: [],
          userTemplates,
          ...selection,
          cardRemovalRecoveries,
          activeCardSet: null,
          storedCards: state.storedCards.filter((card) => (card.setId || state.cardSets[0]?.id) !== id),
        };
      }
      const requested = state.activeCardSet?.id === id
        ? cardSets[0]
        : cardSets.find((candidate) => candidate.id === state.activeCardSet?.id);
      if (!requested) return state;
      return {
        cardSets,
        userTemplates,
        ...selection,
        cardRemovalRecoveries,
        activeCardSet: requested,
        storedCards: state.storedCards.filter((card) => (card.setId || state.cardSets[0]?.id) !== id),
      };
    });
    return true;
  },
  setCardSetsFromFiles: (sets, activeSetId) => {
    const state = get();
    const cardSets = reconcileCardSets({ cardSets: sets, storedCards: state.storedCards });
    const activeCardSet = resolveActiveCardSet({ cardSets, preferredId: activeSetId });
    set({ cardSets, activeCardSet, cardRemovalRecoveries: [] });
    return cardSets.length;
  },
  mergeCardSetsFromFiles: (sets, activeSetId) => {
    const state = get();
    const imported = reconcileCardSets({ cardSets: sets });
    const merged = new Map(state.cardSets.map((set) => [set.id, set]));
    imported.forEach((incoming) => {
      const existing = merged.get(incoming.id);
      merged.set(incoming.id, existing
        ? {
          ...incoming,
          templateIds: [...new Set([...(existing.templateIds ?? []), ...(incoming.templateIds ?? [])])],
          updateReviews: mergeSetUpdateReviews(existing.updateReviews, incoming.updateReviews),
        }
        : incoming);
    });
    const cardSets = Array.from(merged.values());
    const requested = resolveActiveCardSet({
      cardSets,
      preferredId: activeSetId ?? state.activeCardSet?.id,
    });
    const importedSetIds = new Set(imported.map((owner) => owner.id));
    set({ cardSets, activeCardSet: requested, cardRemovalRecoveries: state.cardRemovalRecoveries.filter((entry) => !importedSetIds.has(entry.setId)) });
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
  referenceTemplateInCardSet: (setId, templateId) => {
    const normalizedId = templateId.trim();
    if (!normalizedId || !get().cardSets.some((candidate) => candidate.id === setId)) return false;
    set((state) => {
      const acquired = prepareSetTemplateAcquisition(state, setId, [normalizedId], selectAllTemplates(state));
      const workingId = acquired.templateIds.get(normalizedId)!;
      const stillUsed = state.storedCards.some((card) => (card.setId ?? state.cardSets[0]?.id) === setId
        && (card.templateId === normalizedId || card.backingTemplateId === normalizedId));
      const inheritedSets = inheritCompletedSetUpdateReviews(
        state.cardSets, getTemplateOwnerSetId(state, normalizedId), normalizedId, setId, workingId,
      );
      const cardSets = inheritedSets.map((candidate) => candidate.id === setId
        ? withTemplateReference(!stillUsed && workingId !== normalizedId
          ? { ...candidate, templateIds: candidate.templateIds?.filter((id) => id !== normalizedId) }
          : candidate, workingId)
        : candidate);
      const activeCardSet = state.activeCardSet?.id === setId
        ? cardSets.find((candidate) => candidate.id === setId) ?? state.activeCardSet
        : state.activeCardSet;
      return { cardSets, activeCardSet, userTemplates: acquired.userTemplates };
    });
    return true;
  },
  unreferenceTemplateFromCardSet: (setId, templateId) => {
    const state = get();
    if (state.storedCards.some((card) => (card.setId ?? state.cardSets[0]?.id) === setId
      && (card.templateId === templateId || card.backingTemplateId === templateId))) return false;
    const target = state.cardSets.find((candidate) => candidate.id === setId);
    if (!target?.templateIds?.includes(templateId)) return false;
    set((current) => {
      const owned = getTemplateOwnerSetId(current, templateId) === setId;
      const cardSets = current.cardSets.map((candidate) => candidate.id === setId
        ? {
          ...candidate,
          templateIds: candidate.templateIds?.filter((id) => id !== templateId),
          ...(candidate.organization?.templatePositions ? { organization: {
            ...candidate.organization,
            templatePositions: Object.fromEntries(Object.entries(candidate.organization.templatePositions).filter(([id]) => id !== templateId)),
          } } : {}),
        }
        : candidate);
      const activeCardSet = current.activeCardSet?.id === setId
        ? cardSets.find((candidate) => candidate.id === setId) ?? current.activeCardSet
        : current.activeCardSet;
      return { cardSets, activeCardSet, ...(owned ? { userTemplates: current.userTemplates.filter((template) => template.id !== templateId) } : {}) };
    });
    return true;
  },
  // Choosing a Generator option is only transient tool state. A Set begins
  // referencing a Template when the design is actually saved into that Set or
  // an Artifact using it is generated/moved there.
  setGeneratorSelectedTemplateId: (id) => set((state) => ({
    generatorSelectedTemplateId: id,
    generatorSelectedBackingTemplateId: getCompatibleBackingId(
      state,
      id,
      state.generatorSelectedBackingTemplateId,
    ),
  })),
  setGeneratorSelectedBackingTemplateId: (id) => set((state) => ({
    generatorSelectedBackingTemplateId: getCompatibleBackingId(state, state.generatorSelectedTemplateId, id),
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
});
