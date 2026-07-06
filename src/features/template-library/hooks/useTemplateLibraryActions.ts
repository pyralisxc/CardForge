"use client";

import { useCallback, useState } from 'react';
import { nanoid } from 'nanoid';

import { useAppStore } from '@/store/appStore';
import { selectAllTemplates } from '@/store/selectors';
import type { AppearanceStylePreset, StoredDisplayCard, TCGCardTemplate } from '@/types';
import type { useToast } from '@/hooks/use-toast';

type ToastFn = ReturnType<typeof useToast>['toast'];

interface TemplateLibraryCapabilities {
  canWriteShippedLibrary: boolean;
}

interface UseTemplateLibraryActionsInput {
  addOrUpdateAppearanceStyle: (style: AppearanceStylePreset) => string;
  addOrUpdateTemplate: (template: TCGCardTemplate, source?: TCGCardTemplate['templateSource']) => string;
  cloneTemplate: (templateId: string) => string | null;
  deleteAppearanceStyle: (styleId: string) => void;
  deleteTemplate: (templateId: string, source?: TCGCardTemplate['templateSource']) => void;
  projectCapabilities: TemplateLibraryCapabilities;
  setSingleCardGeneratorSelectedTemplateId: (id: string | null) => void;
  storedCards: StoredDisplayCard[];
  templates: TCGCardTemplate[];
  toast: ToastFn;
}

export const prepareTemplateForLibrarySave = (
  template: TCGCardTemplate,
  canWriteShippedLibrary: boolean,
  createId: () => string = nanoid,
): TCGCardTemplate => {
  if (template.templateSource !== 'default' || canWriteShippedLibrary) {
    return {
      ...template,
      templateSource: template.templateSource === 'default' ? 'default' : 'user',
      templateLibrarySource: template.templateSource === 'default' ? template.templateLibrarySource : 'personal',
    };
  }

  return {
    ...template,
    id: createId(),
    templateSource: 'user',
    templateLibrarySource: 'personal',
  };
};

export function useTemplateLibraryActions({
  addOrUpdateAppearanceStyle,
  addOrUpdateTemplate,
  cloneTemplate,
  deleteAppearanceStyle,
  deleteTemplate,
  projectCapabilities,
  setSingleCardGeneratorSelectedTemplateId,
  storedCards,
  templates,
  toast,
}: UseTemplateLibraryActionsInput) {
  const [templatePendingDeleteId, setTemplatePendingDeleteId] = useState<string | null>(null);

  const handleSaveAppearanceStyle = useCallback((style: AppearanceStylePreset): string => {
    const savedId = addOrUpdateAppearanceStyle(style);
    if (projectCapabilities.canWriteShippedLibrary) {
      void fetch('/api/styles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(style),
      }).catch((error) => {
        console.warn('Unable to save style file:', error);
      });
    }
    toast({ title: 'Style Saved', description: `"${style.name}" is available in Appearance Studio.` });
    return savedId;
  }, [addOrUpdateAppearanceStyle, projectCapabilities.canWriteShippedLibrary, toast]);

  const handleDeleteAppearanceStyle = useCallback((styleId: string) => {
    deleteAppearanceStyle(styleId);
    if (projectCapabilities.canWriteShippedLibrary) {
      void fetch('/api/styles', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: styleId }),
      }).catch((error) => {
        console.warn('Unable to delete style file:', error);
      });
    }
  }, [deleteAppearanceStyle, projectCapabilities.canWriteShippedLibrary]);

  const handleSaveTemplate = useCallback((template: TCGCardTemplate): string => {
    const templateToSave = prepareTemplateForLibrarySave(template, projectCapabilities.canWriteShippedLibrary);
    const savedTemplateId = addOrUpdateTemplate(templateToSave, templateToSave.templateSource);
    setSingleCardGeneratorSelectedTemplateId(savedTemplateId);
    toast({
      title: 'Template Saved',
      description: templateToSave.templateSource === 'default'
        ? `"${templateToSave.name || savedTemplateId}" updated the Forge Pipeline template.`
        : `"${templateToSave.name || savedTemplateId}" has been saved to your Personal Library.`,
    });
    const templateForFile = selectAllTemplates(useAppStore.getState()).find(t => t.id === savedTemplateId);
    if (templateForFile && projectCapabilities.canWriteShippedLibrary) {
      void fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateForFile),
      }).catch((error) => {
        console.warn('Unable to save template to the Forge Pipeline:', error);
      });
    }
    return savedTemplateId;
  }, [addOrUpdateTemplate, projectCapabilities.canWriteShippedLibrary, setSingleCardGeneratorSelectedTemplateId, toast]);

  const handleDeleteTemplate = useCallback((templateId: string) => {
    setTemplatePendingDeleteId(templateId);
  }, []);

  const handleConfirmDeleteTemplate = useCallback(() => {
    if (!templatePendingDeleteId) return;
    const templateId = templatePendingDeleteId;
    const templateToDelete = templates.find(t => t.id === templateId);
    const dependentCardCount = storedCards.filter(card => card.templateId === templateId).length;
    deleteTemplate(templateId, templateToDelete?.templateSource);
    if (projectCapabilities.canWriteShippedLibrary) {
      void fetch('/api/templates', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: templateId, source: templateToDelete?.templateSource }),
      }).catch((error) => {
        console.warn('Unable to delete template from the Forge Pipeline:', error);
      });
    }
    setTemplatePendingDeleteId(null);
    toast({
      title: 'Template Deleted',
      description: `"${templateToDelete?.name || templateId}" and ${dependentCardCount} generated output${dependentCardCount === 1 ? '' : 's'} using it have been removed.`,
    });
  }, [deleteTemplate, projectCapabilities.canWriteShippedLibrary, storedCards, templatePendingDeleteId, templates, toast]);

  const handleCloneTemplate = useCallback((templateId: string): string | null => {
    const source = templates.find(t => t.id === templateId);
    const newId = cloneTemplate(templateId);
    if (newId) toast({ title: 'Template Cloned', description: `"Copy of ${source?.name || templateId}" created.` });
    return newId;
  }, [cloneTemplate, toast, templates]);

  return {
    handleCloneTemplate,
    handleConfirmDeleteTemplate,
    handleDeleteAppearanceStyle,
    handleDeleteTemplate,
    handleSaveAppearanceStyle,
    handleSaveTemplate,
    setTemplatePendingDeleteId,
    templatePendingDeleteId,
  };
}
