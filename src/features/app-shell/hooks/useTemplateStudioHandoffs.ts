"use client";

import { useCallback, useRef, useState } from 'react';

import type { TemplateCardFormatSource } from '@/domain/card-formats';
import type { StoredDisplayCard } from '@/domain/cards';
import type { TCGCardTemplate } from '@/domain/templates';
import type { ToastFn } from '@/components/ui/use-toast';

export type GeneratorBackWorkflowMode = 'edit' | 'create' | 'manage';

export type PendingTemplateRetarget = {
  count: number;
  fromTemplateId: string | null;
  name: string;
  side: 'front' | 'back';
  toTemplateId: string;
};

type TemplateStudioHandoffOptions = {
  activeBackingTemplateId: string | null;
  focusStudioRegion: (selector: string) => void;
  retargetGeneratedCardsBackingTemplate: (fromTemplateId: string, toTemplateId: string) => void;
  retargetGeneratedCardsTemplate: (fromTemplateId: string, toTemplateId: string) => void;
  saveTemplateToLibrary: (template: TCGCardTemplate) => Promise<string>;
  setActiveCardSetBackingTemplateId: (templateId: string | null) => void;
  setActiveTab: (tab: string) => void;
  setTemplateEditorSelectedTemplateId: (templateId: string | null) => void;
  storedCards: StoredDisplayCard[];
  toast: ToastFn;
};

export function useTemplateStudioHandoffs({
  activeBackingTemplateId,
  focusStudioRegion,
  retargetGeneratedCardsBackingTemplate,
  retargetGeneratedCardsTemplate,
  saveTemplateToLibrary,
  setActiveCardSetBackingTemplateId,
  setActiveTab,
  setTemplateEditorSelectedTemplateId,
  storedCards,
  toast,
}: TemplateStudioHandoffOptions) {
  const [matchingBackRequest, setMatchingBackRequest] = useState<{
    key: number;
    formatSource: TemplateCardFormatSource;
  } | null>(null);
  const [pendingTemplateRetarget, setPendingTemplateRetarget] = useState<PendingTemplateRetarget | null>(null);
  const [pendingGeneratorBackSave, setPendingGeneratorBackSave] = useState<{
    previousBackingTemplateId: string | null;
  } | null>(null);
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
        const dependentCardCount = previousBackingTemplateId
          ? storedCards.filter((card) => card.backingTemplateId === previousBackingTemplateId).length
          : 0;
        setPendingTemplateRetarget({
          count: dependentCardCount,
          fromTemplateId: previousBackingTemplateId,
          name: template.name || 'this card back',
          side: 'back',
          toTemplateId: savedTemplateId,
        });
      }
      setPendingGeneratorBackSave(null);
    } else if (sourceTemplateId && savedTemplateId !== sourceTemplateId) {
      const dependentCardCount = storedCards.filter((card) => card.templateId === sourceTemplateId).length;
      if (dependentCardCount > 0) {
        setPendingTemplateRetarget({
          count: dependentCardCount,
          fromTemplateId: sourceTemplateId,
          name: template.name || 'this Template',
          side: 'front',
          toTemplateId: savedTemplateId,
        });
      }
    }

    return savedTemplateId;
  }, [activeBackingTemplateId, pendingGeneratorBackSave, saveTemplateToLibrary, storedCards]);

  const applyPendingTemplateRetarget = useCallback(() => {
    if (!pendingTemplateRetarget) return;

    if (pendingTemplateRetarget.side === 'back') {
      setActiveCardSetBackingTemplateId(pendingTemplateRetarget.toTemplateId);
      if (pendingTemplateRetarget.fromTemplateId) {
        retargetGeneratedCardsBackingTemplate(
          pendingTemplateRetarget.fromTemplateId,
          pendingTemplateRetarget.toTemplateId,
        );
      }
    } else if (pendingTemplateRetarget.fromTemplateId) {
      retargetGeneratedCardsTemplate(
        pendingTemplateRetarget.fromTemplateId,
        pendingTemplateRetarget.toTemplateId,
      );
    }

    toast({
      title: pendingTemplateRetarget.side === 'back' ? 'Saved back applied' : 'Existing cards updated',
      description: pendingTemplateRetarget.side === 'back'
        ? pendingTemplateRetarget.count > 0
          ? `The current set and ${pendingTemplateRetarget.count} existing card${pendingTemplateRetarget.count === 1 ? '' : 's'} now use the saved back.`
          : 'The current set now uses the saved back.'
        : `${pendingTemplateRetarget.count} card${pendingTemplateRetarget.count === 1 ? '' : 's'} now use the saved design.`,
    });
    setPendingTemplateRetarget(null);
  }, [pendingTemplateRetarget, retargetGeneratedCardsBackingTemplate, retargetGeneratedCardsTemplate, setActiveCardSetBackingTemplateId, toast]);

  const dismissPendingTemplateRetarget = useCallback(() => setPendingTemplateRetarget(null), []);
  const clearMatchingBackRequest = useCallback(() => setMatchingBackRequest(null), []);
  const handleEditCardBack = useCallback((templateId: string) => {
    setPendingGeneratorBackSave(null);
    setGeneratorBackWorkflow('edit');
    setTemplateEditorSelectedTemplateId(templateId);
    setActiveTab('template-maker');
    focusStudioRegion('[data-testid="layout-studio-panel"]');
  }, [focusStudioRegion, setActiveTab, setTemplateEditorSelectedTemplateId]);
  const handleManageCardBacks = useCallback(() => {
    setPendingGeneratorBackSave(null);
    setGeneratorBackWorkflow('manage');
    setActiveTab('template-maker');
    focusStudioRegion('[data-card-back-library]');
  }, [focusStudioRegion, setActiveTab]);
  const handleCreateMatchingBack = useCallback((formatSource: TemplateCardFormatSource) => {
    setGeneratorBackWorkflow('create');
    setPendingGeneratorBackSave({ previousBackingTemplateId: activeBackingTemplateId });
    matchingBackSequenceRef.current += 1;
    setMatchingBackRequest({ key: matchingBackSequenceRef.current, formatSource });
    setActiveTab('template-maker');
  }, [activeBackingTemplateId, setActiveTab]);
  const handleReturnToGenerator = useCallback(() => {
    setGeneratorBackWorkflow(null);
    setPendingGeneratorBackSave(null);
    setActiveTab('generator');
    focusStudioRegion('[data-workflow-step="setup"]');
  }, [focusStudioRegion, setActiveTab]);
  const handleStudioTabChange = useCallback((tab: string) => {
    if (tab === 'generator') {
      setGeneratorBackWorkflow(null);
      setPendingGeneratorBackSave(null);
    }
    setActiveTab(tab);
  }, [setActiveTab]);

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
    handleStudioTabChange,
    matchingBackRequest,
    pendingTemplateRetarget,
  };
}
