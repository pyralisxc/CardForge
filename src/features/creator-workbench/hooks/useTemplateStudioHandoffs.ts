"use client";

import { useCallback, useRef, useState } from 'react';

import type { TemplateCardFormatSource } from '@/domain/card-formats';
import type { StoredDisplayCard } from '@/domain/cards';
import type { TCGCardTemplate } from '@/domain/templates';
import type { ToastFn } from '@/components/ui/use-toast';
import type { StudioView } from '@/features/project/client/workspace';

export type GeneratorBackWorkflowMode = 'edit' | 'create' | 'manage';

export type PendingTemplateRetarget = {
  count: number;
  fromTemplateId: string | null;
  name: string;
  side: 'back';
  toTemplateId: string;
};

type TemplateStudioHandoffOptions = {
  activeBackingTemplateId: string | null;
  focusStudioRegion: (selector: string) => void;
  retargetGeneratedCardsBackingTemplate: (fromTemplateId: string, toTemplateId: string) => void;
  /** Kept while the generator-back path is migrated; front retargeting is now Save-impact owned. */
  retargetGeneratedCardsTemplate: (fromTemplateId: string, toTemplateId: string) => void;
  saveTemplateToLibrary: (template: TCGCardTemplate) => Promise<string>;
  setGeneratorBackingTemplateId: (templateId: string | null) => void;
  setStudioView: (view: StudioView) => void;
  setTemplateEditorSelectedTemplateId: (templateId: string | null) => void;
  storedCards: StoredDisplayCard[];
  toast: ToastFn;
};

export function useTemplateStudioHandoffs({
  activeBackingTemplateId,
  focusStudioRegion,
  retargetGeneratedCardsBackingTemplate,
  saveTemplateToLibrary,
  setGeneratorBackingTemplateId,
  setStudioView,
  setTemplateEditorSelectedTemplateId,
  storedCards,
  toast,
}: TemplateStudioHandoffOptions) {
  const [matchingBackRequest, setMatchingBackRequest] = useState<{ key: number; formatSource: TemplateCardFormatSource } | null>(null);
  const [pendingTemplateRetarget, setPendingTemplateRetarget] = useState<PendingTemplateRetarget | null>(null);
  const [pendingGeneratorBackSave, setPendingGeneratorBackSave] = useState<{ previousBackingTemplateId: string | null } | null>(null);
  const [generatorBackWorkflow, setGeneratorBackWorkflow] = useState<GeneratorBackWorkflowMode | null>(null);
  const matchingBackSequenceRef = useRef(0);

  const handleSaveTemplate = useCallback(async (template: TCGCardTemplate) => {
    const sourceTemplateId = template.id;
    const savedTemplateId = await saveTemplateToLibrary(template);
    if (template.templateUsage === 'back-preset') {
      const previousBackingTemplateId = pendingGeneratorBackSave?.previousBackingTemplateId
        ?? (activeBackingTemplateId === sourceTemplateId ? sourceTemplateId : null);
      const shouldOfferSetUpdate = pendingGeneratorBackSave !== null
        || (sourceTemplateId !== savedTemplateId && activeBackingTemplateId === sourceTemplateId);
      if (shouldOfferSetUpdate) {
        const dependentCardCount = previousBackingTemplateId ? storedCards.filter((card) => card.backingTemplateId === previousBackingTemplateId).length : 0;
        setPendingTemplateRetarget({ count: dependentCardCount, fromTemplateId: previousBackingTemplateId, name: template.name || 'this card back', side: 'back', toTemplateId: savedTemplateId });
      }
      setPendingGeneratorBackSave(null);
    }
    return savedTemplateId;
  }, [activeBackingTemplateId, pendingGeneratorBackSave, saveTemplateToLibrary, storedCards]);

  const applyPendingTemplateRetarget = useCallback(() => {
    if (!pendingTemplateRetarget) return;
    setGeneratorBackingTemplateId(pendingTemplateRetarget.toTemplateId);
    if (pendingTemplateRetarget.fromTemplateId) retargetGeneratedCardsBackingTemplate(pendingTemplateRetarget.fromTemplateId, pendingTemplateRetarget.toTemplateId);
    toast({
      title: 'Saved back applied',
      description: pendingTemplateRetarget.count > 0
        ? `The Generator and ${pendingTemplateRetarget.count} existing card${pendingTemplateRetarget.count === 1 ? '' : 's'} now use the saved back.`
        : 'The Generator now uses the saved back.',
    });
    setPendingTemplateRetarget(null);
  }, [pendingTemplateRetarget, retargetGeneratedCardsBackingTemplate, setGeneratorBackingTemplateId, toast]);

  const dismissPendingTemplateRetarget = useCallback(() => setPendingTemplateRetarget(null), []);
  const clearMatchingBackRequest = useCallback(() => setMatchingBackRequest(null), []);
  const handleEditCardBack = useCallback((templateId: string) => {
    setPendingGeneratorBackSave(null);
    setGeneratorBackWorkflow('edit');
    setTemplateEditorSelectedTemplateId(templateId);
    setStudioView('template');
    focusStudioRegion('[data-testid="layout-studio-panel"]');
  }, [focusStudioRegion, setStudioView, setTemplateEditorSelectedTemplateId]);
  const handleManageCardBacks = useCallback(() => {
    setPendingGeneratorBackSave(null);
    setGeneratorBackWorkflow('manage');
    setStudioView('template');
    focusStudioRegion('[data-card-back-library]');
  }, [focusStudioRegion, setStudioView]);
  const handleCreateMatchingBack = useCallback((formatSource: TemplateCardFormatSource) => {
    setGeneratorBackWorkflow('create');
    setPendingGeneratorBackSave({ previousBackingTemplateId: activeBackingTemplateId });
    matchingBackSequenceRef.current += 1;
    setMatchingBackRequest({ key: matchingBackSequenceRef.current, formatSource });
    setStudioView('template');
  }, [activeBackingTemplateId, setStudioView]);
  const handleReturnToGenerator = useCallback(() => {
    setGeneratorBackWorkflow(null);
    setPendingGeneratorBackSave(null);
    setStudioView('generate');
    focusStudioRegion('[data-workflow-step="setup"]');
  }, [focusStudioRegion, setStudioView]);
  const handleStudioViewChange = useCallback((view: StudioView) => {
    if (view !== 'template') { setGeneratorBackWorkflow(null); setPendingGeneratorBackSave(null); }
    setStudioView(view);
  }, [setStudioView]);

  return {
    applyPendingTemplateRetarget,
    clearMatchingBackRequest,
    dismissPendingTemplateRetarget,
    generatorBackWorkflow,
    handleCreateMatchingBack,
    handleEditCardBack,
    handleManageCardBacks,
    handleReturnToGenerator,
    handleSaveTemplate,
    handleStudioViewChange,
    matchingBackRequest,
    pendingTemplateRetarget,
  };
}
