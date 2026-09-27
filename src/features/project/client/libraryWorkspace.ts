"use client";

import { useCallback } from 'react';

import type { CardSetMetadata } from '@/domain/cards';
import type { TCGCardTemplate, TemplateSource } from '@/domain/templates';

import { hydrateProjectWorkspaceForScope } from '../store/workspaceStore';
import { selectAllGeneratedDisplayCards, selectAllTemplates } from '../store/selectors';
import { useProjectStore } from '../store/workspaceStore';
import type { ProjectPersistenceScope } from '../persistence/projectPersistenceScope';

export const hydrateProjectLibraryWorkspaceForScope = (
  scope: ProjectPersistenceScope,
) => hydrateProjectWorkspaceForScope(scope);

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
  const duplicateCardSet = useProjectStore((state) => state.duplicateCardSet);
  const cloneTemplate = useProjectStore((state) => state.cloneTemplate);
  const deleteCardSet = useProjectStore((state) => state.deleteCardSet);
  const addOrUpdateTemplate = useProjectStore((state) => state.addOrUpdateTemplate);

  const openTemplateDesign = useCallback((templateId: string) => {
    setTemplateEditorSelectedTemplateId(templateId);
    setStudioView('template');
  }, [setStudioView, setTemplateEditorSelectedTemplateId]);

  const prepareTemplateForDesign = useCallback((template: TCGCardTemplate, options?: {
    source?: TemplateSource;
    copy?: boolean;
  }) => {
    const installedId = addOrUpdateTemplate(template, options?.source ?? 'default');
    return options?.copy ? cloneTemplate(installedId) : installedId;
  }, [addOrUpdateTemplate, cloneTemplate]);

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
