"use client";

import { useCallback, useRef, useState } from 'react';
import { nanoid } from 'nanoid';

import { useProjectStore } from '@/features/project/client';
import { selectAllTemplates } from '@/features/project/client';
import type { StoredDisplayCard } from '@/domain/cards';
import type { AppearanceStylePreset, TCGCardTemplate } from '@/domain/templates';
import { requireOkResponse } from '@/infrastructure/http/clientResponses';
type ToastFn = (message: { title: string; description: string; variant?: 'default' | 'destructive' }) => unknown;

interface TemplateLibraryCapabilities {
  canSubmitTemplateRevisions: boolean;
  canPublishSharedLibrary: boolean;
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
  setTemplateEditorSelectedTemplateId: (id: string | null) => void;
  storedCards: StoredDisplayCard[];
  templates: TCGCardTemplate[];
  toast: ToastFn;
}

const mutateShippedLibrary = async (
  path: '/api/styles' | '/api/templates' | '/api/templates/submissions',
  method: 'POST' | 'DELETE',
  body: unknown,
  fallback: string,
  headers?: Record<string, string>,
) => {
  const response = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  await requireOkResponse(response, fallback);
  return await response.json() as Record<string, unknown>;
};

export const prepareTemplateForLibrarySave = (
  template: TCGCardTemplate,
  canSubmitTemplateRevisions: boolean,
  createId: () => string = nanoid,
): TCGCardTemplate => {
  if (template.templateSource !== 'default' || canSubmitTemplateRevisions) {
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
  setTemplateEditorSelectedTemplateId,
  storedCards,
  templates,
  toast,
}: UseTemplateLibraryActionsInput) {
  const [templatePendingDeleteId, setTemplatePendingDeleteId] = useState<string | null>(null);
  const pendingRevisionKeysRef = useRef(new Map<string, { fingerprint: string; key: string }>());
  const pendingNewTemplateKeysRef = useRef(new Map<string, { fingerprint: string; key: string }>());

  const handleSaveAppearanceStyle = useCallback((style: AppearanceStylePreset): string => {
    const savedId = addOrUpdateAppearanceStyle(style);
    if (projectCapabilities.canPublishSharedLibrary) {
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
  }, [addOrUpdateAppearanceStyle, projectCapabilities.canPublishSharedLibrary, toast]);

  const handleDeleteAppearanceStyle = useCallback(async (styleId: string) => {
    const style = appearanceStyles.find((candidate) => candidate.id === styleId);
    if (projectCapabilities.canPublishSharedLibrary) {
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
  }, [appearanceStyles, deleteAppearanceStyle, projectCapabilities.canPublishSharedLibrary, toast]);

  const handleSaveTemplate = useCallback(async (template: TCGCardTemplate): Promise<string> => {
    const templateToSave = prepareTemplateForLibrarySave(template, projectCapabilities.canSubmitTemplateRevisions);
    const savedTemplateId = addOrUpdateTemplate(templateToSave, templateToSave.templateSource);
    setTemplateEditorSelectedTemplateId(savedTemplateId);
    if (templateToSave.templateUsage !== 'back-preset') {
      setSingleCardGeneratorSelectedTemplateId(savedTemplateId);
    }
    const templateForFile = selectAllTemplates(useProjectStore.getState()).find(t => t.id === savedTemplateId);
    if (templateForFile?.templateSource === 'default' && projectCapabilities.canSubmitTemplateRevisions) {
      const publishesDirectly = projectCapabilities.canPublishSharedLibrary;
      const fingerprint = JSON.stringify(templateForFile);
      const pending = pendingRevisionKeysRef.current.get(savedTemplateId);
      const submissionKey = pending?.fingerprint === fingerprint ? pending.key : nanoid(32);
      pendingRevisionKeysRef.current.set(savedTemplateId, { fingerprint, key: submissionKey });
      toast({
        title: 'Draft saved in this browser',
        description: publishesDirectly
          ? `Publishing Template revision ${Number(templateForFile.templateRevision ?? 0) + 1} to the shared CardForge Library.`
          : `Submitting Template revision ${Number(templateForFile.templateRevision ?? 0) + 1} to Forge Review.`,
      });
      try {
        const result = await mutateShippedLibrary(
          '/api/templates',
          'POST',
          templateForFile,
          'Unable to submit the Template revision.',
          { 'Idempotency-Key': submissionKey },
        );
        const revision = result.revision && typeof result.revision === 'object'
          ? result.revision as { revisionNumber?: number }
          : null;
        if (publishesDirectly && typeof revision?.revisionNumber === 'number') {
          addOrUpdateTemplate({
            ...templateForFile,
            templateRevision: revision.revisionNumber,
            templateRegistryStatus: 'published',
          }, 'default');
        }
        toast({
          title: publishesDirectly ? 'Template changes published' : 'Template revision submitted',
          description: publishesDirectly
            ? `Revision ${revision?.revisionNumber ?? Number(templateForFile.templateRevision ?? 0) + 1} is live in the shared CardForge Library.`
            : `Revision ${revision?.revisionNumber ?? Number(templateForFile.templateRevision ?? 0) + 1} is saved for owner review. It becomes shared after publication.`,
        });
      } catch (error) {
        toast({
          title: publishesDirectly
            ? 'Browser draft saved; changes not published'
            : 'Browser draft saved; revision not submitted',
          description: error instanceof Error
            ? `${error.message} Your browser draft is safe; save again to retry.`
            : `Your browser draft is safe; save again to retry ${publishesDirectly ? 'publication' : 'submission'}.`,
          variant: 'destructive',
        });
      }
    } else {
      toast({
        title: 'Template saved in this browser',
        description: `"${templateToSave.name || savedTemplateId}" is available in your personal library on this device.`,
      });
    }
    return savedTemplateId;
  }, [addOrUpdateTemplate, projectCapabilities.canPublishSharedLibrary, projectCapabilities.canSubmitTemplateRevisions, setSingleCardGeneratorSelectedTemplateId, setTemplateEditorSelectedTemplateId, toast]);

  const handleContinueNewTemplateInPipeline = useCallback(async (template: TCGCardTemplate): Promise<string> => {
    if (!projectCapabilities.canSubmitTemplateRevisions || template.templateSource === 'default') {
      throw new Error('Only a developer or owner can continue a new personal Template in the Pipeline.');
    }

    const fingerprint = JSON.stringify(template);
    const pending = pendingNewTemplateKeysRef.current.get(template.id!);
    const submissionKey = pending?.fingerprint === fingerprint ? pending.key : nanoid(32);
    pendingNewTemplateKeysRef.current.set(template.id!, { fingerprint, key: submissionKey });

    const result = await mutateShippedLibrary(
      '/api/templates/submissions',
      'POST',
      template,
      'Unable to create the Template Pipeline draft.',
      { 'Idempotency-Key': submissionKey },
    );
    const openInPipelineUrl = typeof result.openInPipelineUrl === 'string'
      ? result.openInPipelineUrl
      : null;
    if (!openInPipelineUrl?.startsWith('/developer/cockpit?')) {
      throw new Error('The Pipeline draft was created, but its secure handoff link was unavailable.');
    }
    return openInPipelineUrl;
  }, [
    projectCapabilities.canSubmitTemplateRevisions,
  ]);

  const handleDeleteTemplate = useCallback((templateId: string) => {
    setTemplatePendingDeleteId(templateId);
  }, []);

  const handleConfirmDeleteTemplate = useCallback(async () => {
    if (!templatePendingDeleteId) return;
    const templateId = templatePendingDeleteId;
    const templateToDelete = templates.find(t => t.id === templateId);
    const dependentCardCount = storedCards.filter(card => card.templateId === templateId).length;
    if (projectCapabilities.canPublishSharedLibrary && templateToDelete?.templateSource === 'default') {
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
  }, [deleteTemplate, projectCapabilities.canPublishSharedLibrary, storedCards, templatePendingDeleteId, templates, toast]);

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
    handleContinueNewTemplateInPipeline,
    setTemplatePendingDeleteId,
    templatePendingDeleteId,
  };
}
