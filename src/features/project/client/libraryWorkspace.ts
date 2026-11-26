"use client";

import { useCallback } from 'react';

import type { CardSetMetadata } from '@/domain/cards';
import { createPersonalTemplateFork, type TCGCardTemplate, type TemplateSource } from '@/domain/templates';

import { getTemplateOwnerSetId } from '../model/setTemplateOwnership';
import { hydrateProjectWorkspaceForScope } from '../store/workspaceStore';
import { selectAllGeneratedDisplayCards, selectAllTemplates } from '../store/selectors';
import { useProjectStore } from '../store/workspaceStore';
import type { ProjectPersistenceScope } from '../persistence/projectPersistenceScope';
import { beginProjectCardEdit, saveProjectCardEdit } from './cardEditSession';

export const hydrateProjectLibraryWorkspaceForScope = (
  scope: ProjectPersistenceScope,
) => hydrateProjectWorkspaceForScope(scope);

export type { ProjectCardEditSession as LibraryCardEditSession } from './cardEditSession';

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
      beginCardEdit: beginProjectCardEdit,
      saveCardEdit: saveProjectCardEdit,
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
