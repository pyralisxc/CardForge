"use client";

import { useCallback, useState } from 'react';
import { nanoid } from 'nanoid';

import { useProjectStore } from '@/features/project/client';
import { selectAllTemplates } from '@/features/project/client';
import type { StoredDisplayCard } from '@/domain/cards';
import type { AppearanceStylePreset, TCGCardTemplate } from '@/domain/templates';
import { requireOkResponse } from '@/infrastructure/http/clientResponses';
type ToastFn = (message: { title: string; description: string; variant?: 'default' | 'destructive' }) => unknown;

interface TemplateLibraryCapabilities {
  canWriteShippedLibrary: boolean;
}

interface UseTemplateLibraryActionsInput {
  addOrUpdateAppearanceStyle: (style: AppearanceStylePreset) => string;
  addOrUpdateTemplate: (template: TCGCardTemplate, source?: TCGCardTemplate['templateSource']) => string;
  appearanceStyles: AppearanceStylePreset[];
  cloneTemplate: (templateId: string) => string | null;
  deleteAppearanceStyle: (styleId: string) => void;
  deleteTemplate: (templateId: string, source?: TCGCardTemplate['templateSource']) => void;
  projectCapabilities: TemplateLibraryCapabilities;
  setSingleCardGeneratorSelectedTemplateId: (id: string | null) => void;
  storedCards: StoredDisplayCard[];
  templates: TCGCardTemplate[];
  toast: ToastFn;
}

const mutateShippedLibrary = async (
  path: '/api/styles' | '/api/templates',
  method: 'POST' | 'DELETE',
  body: unknown,
  fallback: string,
) => {
  const response = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  await requireOkResponse(response, fallback);
};

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
  appearanceStyles,
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
      toast({ title: 'Style staged', description: `Saving "${style.name}" to the Forge Pipeline.` });
      void mutateShippedLibrary('/api/styles', 'POST', style, 'Unable to save the style to the Forge Pipeline.')
        .then(() => toast({ title: 'Pipeline style saved', description: `"${style.name}" is live in Appearance Studio.` }))
        .catch((error) => toast({
          title: 'Pipeline style not saved',
          description: error instanceof Error ? error.message : 'Unable to save the style to the Forge Pipeline.',
          variant: 'destructive',
        }));
    } else {
      toast({ title: 'Style Saved', description: `"${style.name}" is available in Appearance Studio.` });
    }
    return savedId;
  }, [addOrUpdateAppearanceStyle, projectCapabilities.canWriteShippedLibrary, toast]);

  const handleDeleteAppearanceStyle = useCallback(async (styleId: string) => {
    const style = appearanceStyles.find((candidate) => candidate.id === styleId);
    if (projectCapabilities.canWriteShippedLibrary) {
      try {
        await mutateShippedLibrary('/api/styles', 'DELETE', { id: styleId }, 'Unable to archive the Forge Pipeline style.');
      } catch (error) {
        toast({
          title: 'Style not deleted',
          description: error instanceof Error ? error.message : 'Unable to archive the Forge Pipeline style.',
          variant: 'destructive',
        });
        return;
      }
    }
    deleteAppearanceStyle(styleId);
    toast({ title: 'Style deleted', description: `"${style?.name || styleId}" has been removed.` });
  }, [appearanceStyles, deleteAppearanceStyle, projectCapabilities.canWriteShippedLibrary, toast]);

  const handleSaveTemplate = useCallback((template: TCGCardTemplate): string => {
    const templateToSave = prepareTemplateForLibrarySave(template, projectCapabilities.canWriteShippedLibrary);
    const savedTemplateId = addOrUpdateTemplate(templateToSave, templateToSave.templateSource);
    setSingleCardGeneratorSelectedTemplateId(savedTemplateId);
    const templateForFile = selectAllTemplates(useProjectStore.getState()).find(t => t.id === savedTemplateId);
    if (templateForFile?.templateSource === 'default' && projectCapabilities.canWriteShippedLibrary) {
      toast({ title: 'Template staged', description: `Saving "${templateForFile.name || savedTemplateId}" to the Forge Pipeline.` });
      void mutateShippedLibrary('/api/templates', 'POST', templateForFile, 'Unable to save the template to the Forge Pipeline.')
        .then(() => toast({
          title: 'Pipeline template saved',
          description: `"${templateForFile.name || savedTemplateId}" is live in the Forge Pipeline.`,
        }))
        .catch((error) => toast({
          title: 'Pipeline template not saved',
          description: error instanceof Error ? error.message : 'Unable to save the template to the Forge Pipeline.',
          variant: 'destructive',
        }));
    } else {
      toast({
        title: 'Template Saved',
        description: `"${templateToSave.name || savedTemplateId}" has been saved to your Personal Library.`,
      });
    }
    return savedTemplateId;
  }, [addOrUpdateTemplate, projectCapabilities.canWriteShippedLibrary, setSingleCardGeneratorSelectedTemplateId, toast]);

  const handleDeleteTemplate = useCallback((templateId: string) => {
    setTemplatePendingDeleteId(templateId);
  }, []);

  const handleConfirmDeleteTemplate = useCallback(async () => {
    if (!templatePendingDeleteId) return;
    const templateId = templatePendingDeleteId;
    const templateToDelete = templates.find(t => t.id === templateId);
    const dependentCardCount = storedCards.filter(card => card.templateId === templateId).length;
    if (projectCapabilities.canWriteShippedLibrary && templateToDelete?.templateSource === 'default') {
      try {
        await mutateShippedLibrary(
          '/api/templates',
          'DELETE',
          { id: templateId, source: 'default' },
          'Unable to archive the Forge Pipeline template.',
        );
      } catch (error) {
        setTemplatePendingDeleteId(null);
        toast({
          title: 'Template not deleted',
          description: error instanceof Error ? error.message : 'Unable to archive the Forge Pipeline template.',
          variant: 'destructive',
        });
        return;
      }
    }
    deleteTemplate(templateId, templateToDelete?.templateSource);
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
