"use client";

import { useCallback, useRef, useState } from 'react';
import { nanoid } from 'nanoid';

import type { CardFace, StoredDisplayCard } from '@/domain/cards';
import {
  createPersonalTemplateFork,
  createPersonalTemplateRevision,
  getTemplateLineageId,
  reconstructMinimalTemplateObject,
  type AppearanceStylePreset,
  type TCGCardTemplate,
} from '@/domain/templates';
import { useProjectStore, selectAllTemplates, type TemplateCommitChangeInput } from '@/features/project/client/workspace';
import { forgetAgentTemplateLink, syncAgentTemplateSave } from '@/features/studio-documents/client';
import { requireOkResponse } from '@/infrastructure/http/clientResponses';
import { buildTemplateSaveImpact, type TemplateSaveImpact } from '../lib/templateSaveImpact';

type ToastFn = (message: { title: string; description: string; variant?: 'default' | 'destructive' }) => unknown;

interface TemplateLibraryCapabilities {
  canSubmitTemplateRevisions: boolean;
  canPublishSharedLibrary: boolean;
}

export interface TemplateDesignScope {
  artifactIds: string[];
  face: CardFace;
}

export interface PendingTemplateSaveImpact {
  templateName: string;
  affectedArtifactCount: number;
  selectedArtifactCount: number;
  removedFieldKeys: string[];
  addedRequiredFieldKeys: string[];
  canSaveShared: boolean;
  canFork: boolean;
  variantName: string;
}

interface PendingTemplateSaveInternal {
  template: TCGCardTemplate;
  source: TCGCardTemplate | null;
  impact: TemplateSaveImpact;
  scopeIds: string[];
  face: CardFace;
  setId: string | null;
  resolve: (id: string) => void;
  reject: (error: Error) => void;
}

interface UseTemplateLibraryActionsInput {
  addOrUpdateAppearanceStyle: (style: AppearanceStylePreset) => string;
  addOrUpdateTemplate: (template: TCGCardTemplate, source?: TCGCardTemplate['templateSource']) => string;
  commitTemplateChange: (input: TemplateCommitChangeInput) => string;
  clearPersonalTemplateOverride: (templateId: string) => void;
  appearanceStyles: AppearanceStylePreset[];
  cloneTemplate: (templateId: string) => string | null;
  deleteAppearanceStyle: (styleId: string) => void;
  deleteTemplate: (templateId: string, source?: TCGCardTemplate['templateSource']) => void;
  projectCapabilities: TemplateLibraryCapabilities;
  setGeneratorSelectedTemplateId: (id: string | null) => void;
  setTemplateEditorSelectedTemplateId: (id: string | null) => void;
  storedCards: StoredDisplayCard[];
  templates: TCGCardTemplate[];
  toast: ToastFn;
  contextSetId?: string | null;
  designScope?: TemplateDesignScope | null;
}

const mutateShippedLibrary = async (path: '/api/styles' | '/api/templates' | '/api/templates/submissions', method: 'POST' | 'DELETE', body: unknown, fallback: string, headers?: Record<string, string>) => {
  const response = await fetch(path, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  await requireOkResponse(response, fallback);
  return await response.json() as Record<string, unknown>;
};

const createSharedLineageDraft = (template: TCGCardTemplate, source: TCGCardTemplate, createId: () => string): TCGCardTemplate => reconstructMinimalTemplateObject({
  ...template,
  id: source.id,
  templateSource: 'user',
  templateLibrarySource: 'personal',
  templateRegistryStatus: 'draft',
  templateLineageId: getTemplateLineageId(source) ?? source.id ?? undefined,
  // Keep the published base revision number for optimistic shared submission;
  // exact local draft identity is separate from that provider revision number.
  templateRevision: source.templateRevision ?? 0,
  templateRevisionId: `template-draft-${createId()}`,
  templateParentRevisionId: source.templateRevisionId,
  templateOriginLineageId: getTemplateLineageId(source) ?? source.id ?? undefined,
  templateOriginRevisionId: source.templateRevisionId,
});

export const prepareTemplateForLibrarySave = (
  template: TCGCardTemplate,
  canSubmitTemplateRevisions: boolean,
  createId: () => string = nanoid,
  previous?: TCGCardTemplate | null,
): TCGCardTemplate => {
  const source = previous ?? template;
  if (source.templateSource === 'default') {
    return canSubmitTemplateRevisions
      ? createSharedLineageDraft(template, source, createId)
      : reconstructMinimalTemplateObject(createPersonalTemplateFork(source, { ...template, id: null }, createId));
  }
  const isSharedDraft = source.templateRegistryStatus === 'draft'
    && source.templateOriginLineageId
    && source.templateOriginLineageId === source.templateLineageId;
  if (isSharedDraft) {
    return reconstructMinimalTemplateObject({
      ...template,
      id: source.id,
      templateSource: 'user',
      templateLibrarySource: 'personal',
      templateRegistryStatus: 'draft',
      templateLineageId: source.templateLineageId,
      templateRevision: source.templateRevision,
      templateRevisionId: `template-draft-${createId()}`,
      templateParentRevisionId: source.templateRevisionId,
      templateOriginLineageId: source.templateOriginLineageId,
      templateOriginRevisionId: source.templateOriginRevisionId,
    });
  }
  return reconstructMinimalTemplateObject(createPersonalTemplateRevision({ ...template, templateSource: 'user', templateLibrarySource: 'personal' }, previous));
};

export function useTemplateLibraryActions({
  addOrUpdateAppearanceStyle,
  addOrUpdateTemplate,
  commitTemplateChange,
  clearPersonalTemplateOverride,
  appearanceStyles,
  cloneTemplate,
  deleteAppearanceStyle,
  deleteTemplate,
  projectCapabilities,
  setGeneratorSelectedTemplateId,
  setTemplateEditorSelectedTemplateId,
  storedCards,
  templates,
  toast,
  contextSetId = null,
  designScope = null,
}: UseTemplateLibraryActionsInput) {
  const [templatePendingDeleteId, setTemplatePendingDeleteId] = useState<string | null>(null);
  const [pendingTemplateSaveImpact, setPendingTemplateSaveImpact] = useState<PendingTemplateSaveImpact | null>(null);
  const pendingSaveRef = useRef<PendingTemplateSaveInternal | null>(null);
  const pendingRevisionKeysRef = useRef(new Map<string, { fingerprint: string; key: string }>());
  const pendingNewTemplateKeysRef = useRef(new Map<string, { fingerprint: string; key: string }>());

  const handleSaveAppearanceStyle = useCallback((style: AppearanceStylePreset): string => {
    const savedId = addOrUpdateAppearanceStyle(style);
    if (projectCapabilities.canPublishSharedLibrary) {
      toast({ title: 'Style staged', description: `Saving "${style.name}" to the Forge Pipeline.` });
      void mutateShippedLibrary('/api/styles', 'POST', style, 'Unable to save the style to the Forge Pipeline.')
        .then(() => toast({ title: 'Pipeline style saved', description: `"${style.name}" is live in Appearance Studio.` }))
        .catch((error) => toast({ title: 'Pipeline style not saved', description: error instanceof Error ? error.message : 'Unable to save the style to the Forge Pipeline.', variant: 'destructive' }));
    } else toast({ title: 'Style Saved', description: `"${style.name}" is available in Appearance Studio.` });
    return savedId;
  }, [addOrUpdateAppearanceStyle, projectCapabilities.canPublishSharedLibrary, toast]);

  const handleDeleteAppearanceStyle = useCallback(async (styleId: string) => {
    const style = appearanceStyles.find((candidate) => candidate.id === styleId);
    if (projectCapabilities.canPublishSharedLibrary) {
      try { await mutateShippedLibrary('/api/styles', 'DELETE', { id: styleId }, 'Unable to archive the Forge Pipeline style.'); }
      catch (error) { toast({ title: 'Style not deleted', description: error instanceof Error ? error.message : 'Unable to archive the Forge Pipeline style.', variant: 'destructive' }); return; }
    }
    deleteAppearanceStyle(styleId);
    toast({ title: 'Style deleted', description: `"${style?.name || styleId}" has been removed.` });
  }, [appearanceStyles, deleteAppearanceStyle, projectCapabilities.canPublishSharedLibrary, toast]);

  const commitSave = useCallback(async (pending: Omit<PendingTemplateSaveInternal, 'resolve' | 'reject'>, decision: 'shared' | 'fork', variantName?: string) => {
    const { template, source, impact, scopeIds, face, setId } = pending;
    let templateToSave: TCGCardTemplate;
    let artifactIds: readonly string[] | undefined;
    if (decision === 'fork') {
      if (!source) throw new Error('The source Template is no longer available. Reload the design before saving a variant.');
      templateToSave = reconstructMinimalTemplateObject(createPersonalTemplateFork(source, {
        ...template,
        id: null,
        name: variantName?.trim() || `${template.name || source.name} Variant`,
      }));
      artifactIds = scopeIds;
    } else {
      templateToSave = prepareTemplateForLibrarySave(template, projectCapabilities.canSubmitTemplateRevisions, nanoid, source);
    }
    const savedTemplateId = commitTemplateChange({
      template: templateToSave,
      source: templateToSave.templateSource,
      sourceTemplateId: source?.id ?? template.id,
      artifactIds,
      face,
      removedFieldKeys: impact.removedFieldKeys,
      setId,
    });
    setTemplateEditorSelectedTemplateId(savedTemplateId);
    if (templateToSave.templateUsage !== 'back-preset') setGeneratorSelectedTemplateId(savedTemplateId);
    const templateForFile = selectAllTemplates(useProjectStore.getState()).find((candidate) => candidate.id === savedTemplateId);
    if (templateForFile?.templateSource === 'user') {
      try {
        const syncResult = await syncAgentTemplateSave(templateForFile);
        if (syncResult.status === 'synced') toast({ title: decision === 'fork' ? 'Template variant saved' : 'Template saved', description: `"${templateForFile.name}" is saved in this browser. Its linked ChatGPT working draft is now document revision ${syncResult.revision}.` });
        else if (syncResult.status === 'conflict') toast({ title: 'Template saved locally; ChatGPT draft is newer', description: `Your browser copy is safe. The linked ChatGPT working draft is already document revision ${syncResult.revision}; reopen the latest CardForge preview before syncing.`, variant: 'destructive' });
        else toast({ title: decision === 'fork' ? 'Template variant saved' : 'Template saved', description: `"${templateForFile.name}" is available in your personal browser library.` });
      } catch (error) {
        toast({ title: 'Template saved locally; ChatGPT sync failed', description: error instanceof Error ? `${error.message} Your browser copy is safe.` : 'Your browser copy is safe, but CardForge could not update its linked ChatGPT working draft.', variant: 'destructive' });
      }
    }
    return savedTemplateId;
  }, [commitTemplateChange, projectCapabilities.canSubmitTemplateRevisions, setGeneratorSelectedTemplateId, setTemplateEditorSelectedTemplateId, toast]);

  const handleSaveTemplate = useCallback(async (template: TCGCardTemplate): Promise<string> => {
    const source = templates.find((candidate) => candidate.id === template.id) ?? null;
    const impact = buildTemplateSaveImpact({ previous: source, next: template, cards: storedCards });
    const face: CardFace = designScope?.face ?? (template.templateUsage === 'back-preset' ? 'back' : 'front');
    const depends = (card: StoredDisplayCard) => face === 'front' ? card.templateId === source?.id : card.backingTemplateId === source?.id;
    const contextualScope = designScope?.artifactIds.length
      ? designScope.artifactIds.filter((id) => storedCards.some((card) => card.uniqueId === id && depends(card)))
      : contextSetId && source?.id
        ? storedCards.filter((card) => card.setId === contextSetId && depends(card)).map((card) => card.uniqueId)
        : [];
    const affectedArtifactCount = face === 'front' ? impact.frontArtifactIds.length : impact.backArtifactIds.length;
    const canSaveShared = source?.templateSource !== 'default' || projectCapabilities.canSubmitTemplateRevisions;
    const canFork = Boolean(source && (designScope?.artifactIds.length || (!canSaveShared && (contextSetId || source.templateSource === 'default'))));
    const needsDecision = impact.requiresReview || Boolean(designScope?.artifactIds.length) || (!canSaveShared && contextualScope.length > 0);
    const pending = { template, source, impact, scopeIds: contextualScope, face, setId: contextSetId };
    if (!needsDecision) {
      const decision = canSaveShared ? 'shared' : 'fork';
      return await commitSave(pending, decision);
    }
    return await new Promise<string>((resolve, reject) => {
      pendingSaveRef.current = { ...pending, resolve, reject };
      setPendingTemplateSaveImpact({
        templateName: template.name || source?.name || 'Template',
        affectedArtifactCount,
        selectedArtifactCount: contextualScope.length,
        removedFieldKeys: impact.removedFieldKeys,
        addedRequiredFieldKeys: impact.addedRequiredFieldKeys,
        canSaveShared,
        canFork,
        variantName: `${template.name || source?.name || 'Template'} Variant`,
      });
    });
  }, [commitSave, contextSetId, designScope, projectCapabilities.canSubmitTemplateRevisions, storedCards, templates]);

  const finishPendingTemplateSave = useCallback(async (decision: 'shared' | 'fork') => {
    const pending = pendingSaveRef.current;
    const presentation = pendingTemplateSaveImpact;
    if (!pending || !presentation) return;
    pendingSaveRef.current = null;
    setPendingTemplateSaveImpact(null);
    try { pending.resolve(await commitSave(pending, decision, presentation.variantName)); }
    catch (error) { pending.reject(error instanceof Error ? error : new Error('Template save failed.')); }
  }, [commitSave, pendingTemplateSaveImpact]);

  const cancelPendingTemplateSave = useCallback(() => {
    const pending = pendingSaveRef.current;
    pendingSaveRef.current = null;
    setPendingTemplateSaveImpact(null);
    if (pending) {
      const error = new Error('Save cancelled. Your Template draft is unchanged.');
      error.name = 'TemplateSaveCancelledError';
      pending.reject(error);
    }
  }, []);

  const setPendingTemplateSaveVariantName = useCallback((variantName: string) => {
    setPendingTemplateSaveImpact((current) => current ? { ...current, variantName } : current);
  }, []);

  const handleSubmitTemplateRevision = useCallback(async (template: TCGCardTemplate) => {
    if (!projectCapabilities.canSubmitTemplateRevisions) throw new Error('Template revision submission is not available for this account.');
    const current = selectAllTemplates(useProjectStore.getState()).find((candidate) => candidate.id === template.id) ?? template;
    if (!current.id) throw new Error('Save this Template before submitting a revision.');
    const payload = { ...current, templateSource: 'default' as const, templateLibrarySource: 'pipeline' as const, templateRegistryStatus: 'draft' as const };
    const fingerprint = JSON.stringify(payload);
    const previousKey = pendingRevisionKeysRef.current.get(current.id);
    const submissionKey = previousKey?.fingerprint === fingerprint ? previousKey.key : nanoid(32);
    pendingRevisionKeysRef.current.set(current.id, { fingerprint, key: submissionKey });
    const result = await mutateShippedLibrary('/api/templates', 'POST', payload, 'Unable to submit the Template revision.', { 'Idempotency-Key': submissionKey });
    const revision = result.revision && typeof result.revision === 'object' ? result.revision as { id?: string; revisionNumber?: number } : null;
    if (projectCapabilities.canPublishSharedLibrary && typeof revision?.revisionNumber === 'number') {
      addOrUpdateTemplate({
        ...payload,
        templateRegistryStatus: 'published',
        templateRevision: revision.revisionNumber,
        templateRevisionId: revision.id ?? current.templateRevisionId,
        templateParentRevisionId: current.templateRevisionId,
      }, 'default');
      clearPersonalTemplateOverride(current.id);
    }
    toast({
      title: projectCapabilities.canPublishSharedLibrary ? 'Template revision published' : 'Template revision submitted',
      description: projectCapabilities.canPublishSharedLibrary
        ? `Revision ${revision?.revisionNumber ?? Number(current.templateRevision ?? 0) + 1} is live. Your browser draft remains recoverable through revision history.`
        : `Revision ${revision?.revisionNumber ?? Number(current.templateRevision ?? 0) + 1} is in Forge Review. Your local authored work remains unchanged until you choose another revision.`,
    });
  }, [addOrUpdateTemplate, clearPersonalTemplateOverride, projectCapabilities.canPublishSharedLibrary, projectCapabilities.canSubmitTemplateRevisions, toast]);

  const handleContinueNewTemplateInPipeline = useCallback(async (template: TCGCardTemplate): Promise<string> => {
    if (!projectCapabilities.canSubmitTemplateRevisions || template.templateSource === 'default') throw new Error('Only a contributor or owner can continue a new personal Template in the Pipeline.');
    const fingerprint = JSON.stringify(template);
    const pending = pendingNewTemplateKeysRef.current.get(template.id!);
    const submissionKey = pending?.fingerprint === fingerprint ? pending.key : nanoid(32);
    pendingNewTemplateKeysRef.current.set(template.id!, { fingerprint, key: submissionKey });
    const result = await mutateShippedLibrary('/api/templates/submissions', 'POST', template, 'Unable to create the Template Pipeline draft.', { 'Idempotency-Key': submissionKey });
    const openInPipelineUrl = typeof result.openInPipelineUrl === 'string' ? result.openInPipelineUrl : null;
    if (!openInPipelineUrl?.startsWith('/account?section=library&scope=pipeline')) throw new Error('The Pipeline draft was created, but its secure handoff link was unavailable.');
    return openInPipelineUrl;
  }, [projectCapabilities.canSubmitTemplateRevisions]);

  const handleDeleteTemplate = useCallback((templateId: string) => setTemplatePendingDeleteId(templateId), []);

  const handleConfirmDeleteTemplate = useCallback(async () => {
    if (!templatePendingDeleteId) return;
    const templateId = templatePendingDeleteId;
    const templateToDelete = templates.find((candidate) => candidate.id === templateId);
    const frontCount = storedCards.filter((card) => card.templateId === templateId).length;
    const backCount = storedCards.filter((card) => card.backingTemplateId === templateId && card.templateId !== templateId).length;
    if (projectCapabilities.canPublishSharedLibrary && templateToDelete?.templateSource === 'default') {
      try { await mutateShippedLibrary('/api/templates', 'DELETE', { id: templateId, source: 'default' }, 'Unable to archive the Forge Pipeline template.'); }
      catch (error) { setTemplatePendingDeleteId(null); toast({ title: 'Template not deleted', description: error instanceof Error ? error.message : 'Unable to archive the Forge Pipeline template.', variant: 'destructive' }); return; }
    }
    void forgetAgentTemplateLink(templateId);
    deleteTemplate(templateId, templateToDelete?.templateSource);
    setTemplatePendingDeleteId(null);
    toast({ title: 'Template deleted', description: `${frontCount} front-dependent Artifact${frontCount === 1 ? '' : 's'} removed${backCount ? `; ${backCount} back-dependent Artifact${backCount === 1 ? '' : 's'} became front-only` : ''}.` });
  }, [deleteTemplate, projectCapabilities.canPublishSharedLibrary, storedCards, templatePendingDeleteId, templates, toast]);

  const handleCloneTemplate = useCallback((templateId: string): string | null => {
    const source = templates.find((template) => template.id === templateId);
    const newId = cloneTemplate(templateId);
    if (newId) toast({ title: 'Template cloned', description: `"Copy of ${source?.name || templateId}" created as an independent personal design.` });
    return newId;
  }, [cloneTemplate, toast, templates]);

  return {
    cancelPendingTemplateSave,
    confirmTemplateSaveFork: () => finishPendingTemplateSave('fork'),
    confirmTemplateSaveShared: () => finishPendingTemplateSave('shared'),
    handleCloneTemplate,
    handleConfirmDeleteTemplate,
    handleDeleteAppearanceStyle,
    handleDeleteTemplate,
    handleSaveAppearanceStyle,
    handleSaveTemplate,
    handleSubmitTemplateRevision,
    handleContinueNewTemplateInPipeline,
    pendingTemplateSaveImpact,
    setPendingTemplateSaveVariantName,
    setTemplatePendingDeleteId,
    templatePendingDeleteId,
  };
}
