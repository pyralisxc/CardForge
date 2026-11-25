"use client";

import { useCallback } from 'react';

import type { CardSetMetadata, StoredDisplayCard } from '@/domain/cards';
import type { DisplayCard } from '@/domain/rendering';
import { createPersonalTemplateFork, type TCGCardTemplate, type TemplateSource } from '@/domain/templates';

import { getTemplateOwnerSetId } from '../model/setTemplateOwnership';
import { hydrateProjectWorkspaceForScope } from '../store/workspaceStore';
import { selectAllGeneratedDisplayCards, selectAllTemplates } from '../store/selectors';
import { useProjectStore } from '../store/workspaceStore';
import { getProjectPersistenceScope, type ProjectPersistenceScope } from '../persistence/projectPersistenceScope';

export const hydrateProjectLibraryWorkspaceForScope = (
  scope: ProjectPersistenceScope,
) => hydrateProjectWorkspaceForScope(scope);

export interface LibraryCardEditSession {
  scope: ProjectPersistenceScope;
  setId: string;
  card: DisplayCard;
  original: StoredDisplayCard;
}

/**
 * Project-owned projection/capabilities exposed to Library.
 *
 * Storage Management owns source aggregation and Library meaning; Project owns
 * workspace state and mutations. This hook prevents Library from depending on
 * the raw Zustand store while keeping one state owner.
 */
export function useProjectLibraryWorkspace() {
  const cardSets = useProjectStore((state) => state.cardSets);
  const activeSetId = useProjectStore((state) => state.activeCardSet?.id ?? null);
  const activeSetName = useProjectStore((state) => state.activeCardSet?.name ?? 'No Set selected');
  const storedCards = useProjectStore((state) => state.storedCards);
  const defaultTemplates = useProjectStore((state) => state.defaultTemplates);
  const userTemplates = useProjectStore((state) => state.userTemplates);
  const displayCards = useProjectStore(selectAllGeneratedDisplayCards);
  const templates = useProjectStore(selectAllTemplates);

  const setDefaultTemplatesFromFiles = useProjectStore((state) => state.setDefaultTemplatesFromFiles);
  const updateCardSetMetadata = useProjectStore((state) => state.updateCardSetMetadata);
  const setActiveCardSetId = useProjectStore((state) => state.setActiveCardSetId);
  const setTemplateEditorSelectedTemplateId = useProjectStore((state) => state.setTemplateEditorSelectedTemplateId);
  const setStudioView = useProjectStore((state) => state.setStudioView);
  const createCardSet = useProjectStore((state) => state.createCardSet);
  const duplicateCardSet = useProjectStore((state) => state.duplicateCardSet);
  const cloneTemplate = useProjectStore((state) => state.cloneTemplate);
  const deleteCardSet = useProjectStore((state) => state.deleteCardSet);
  const addOrUpdateTemplate = useProjectStore((state) => state.addOrUpdateTemplate);

  const beginCardEdit = useCallback((setId: string, cardId: string): LibraryCardEditSession | null => {
    const scope = getProjectPersistenceScope();
    if (scope === 'unscoped-disabled') return null;
    const state = useProjectStore.getState();
    const original = state.storedCards.find((card) => card.uniqueId === cardId
      && (card.setId ?? state.cardSets[0]?.id) === setId);
    const card = selectAllGeneratedDisplayCards(state).find((item) => item.uniqueId === cardId
      && (item.setId ?? state.cardSets[0]?.id) === setId);
    if (!original || !card || !state.cardSets.some((set) => set.id === setId)) return null;
    return { scope, setId, card: structuredClone(card), original: structuredClone(original) };
  }, []);

  const saveCardEdit = useCallback((session: LibraryCardEditSession, card: DisplayCard): boolean => {
    const state = useProjectStore.getState();
    const current = state.storedCards.find((item) => item.uniqueId === session.original.uniqueId);
    const resolved = selectAllGeneratedDisplayCards(state).find((item) => item.uniqueId === session.original.uniqueId);
    if (getProjectPersistenceScope() !== session.scope || !current || !resolved
      || !state.cardSets.some((set) => set.id === session.setId)
      || (current.setId ?? state.cardSets[0]?.id) !== session.setId
      || card.uniqueId !== session.original.uniqueId
      || JSON.stringify(current) !== JSON.stringify(session.original)
      || JSON.stringify(resolved.template) !== JSON.stringify(session.card.template)
      || JSON.stringify(resolved.backingTemplate) !== JSON.stringify(session.card.backingTemplate)) return false;
    state.updateGeneratedCard(card);
    return true;
  }, []);

  const openTemplateDesign = useCallback((templateId: string) => {
    const ownerId = getTemplateOwnerSetId(useProjectStore.getState(), templateId);
    if (ownerId) setActiveCardSetId(ownerId);
    setTemplateEditorSelectedTemplateId(templateId);
    setStudioView('template');
  }, [setActiveCardSetId, setStudioView, setTemplateEditorSelectedTemplateId]);

  const prepareTemplateForDesign = useCallback((template: TCGCardTemplate, options?: {
    source?: TemplateSource;
    copy?: boolean;
  }) => {
    if (options?.copy) return addOrUpdateTemplate({
      ...createPersonalTemplateFork(structuredClone(template)),
      templateContributorName: template.templateContributorName,
    }, 'user');
    return addOrUpdateTemplate(template, options?.source ?? 'default');
  }, [addOrUpdateTemplate]);

  return {
    cardSets,
    activeSetId,
    activeSetName,
    storedCards,
    defaultTemplates,
    userTemplates,
    displayCards,
    templates,
    actions: {
      createSet: createCardSet,
      beginCardEdit,
      saveCardEdit,
      setDefaultTemplatesFromFiles,
      updateSetMetadata: (setId: string, patch: Partial<Omit<CardSetMetadata, 'workflow'>>) => updateCardSetMetadata(setId, patch),
      activateSet: setActiveCardSetId,
      openTemplateDesign,
      duplicateSet: duplicateCardSet,
      duplicateTemplate: cloneTemplate,
      deleteSet: deleteCardSet,
      installTemplate: addOrUpdateTemplate,
      prepareTemplateForDesign,
    },
  };
}
