"use client";

import { useMemo } from 'react';

import { resolveGeneratorFrontTemplateId, selectAllTemplates, selectEditingCard, selectGeneratedDisplayCards, useProjectStore } from '@/features/project/client/workspace';
import { splitTemplatesForWorkspace } from '@/features/creator-workbench/lib/workspaceState';

export function useCardForgeWorkspaceState() {
  const defaultTemplatesFromStore = useProjectStore((state) => state.defaultTemplates);
  const userTemplatesFromStore = useProjectStore((state) => state.userTemplates);
  const templatesFromStore = useProjectStore(selectAllTemplates);
  const appearanceStyles = useProjectStore((state) => state.appearanceStyles);
  const richTextHighlightColor = useProjectStore((state) => state.richTextHighlightColor);
  const storedCards = useProjectStore((state) => state.storedCards);
  const generatedDisplayCards = useProjectStore(selectGeneratedDisplayCards);

  const selectedPaperSize = useProjectStore((state) => state.selectedPaperSize);
  const studioView = useProjectStore((state) => state.studioView);
  const activeCardSet = useProjectStore((state) => state.activeCardSet);
  const requestedGeneratorTemplateId = useProjectStore((state) => state.generatorSelectedTemplateId);
  const generatorSelectedBackingTemplateId = useProjectStore((state) => state.generatorSelectedBackingTemplateId);
  const templateEditorSelectedTemplateId = useProjectStore((state) => state.templateEditorSelectedTemplateId);
  const pdfMarginMm = useProjectStore((state) => state.pdfMarginMm);
  const pdfCardSpacingMm = useProjectStore((state) => state.pdfCardSpacingMm);
  const pdfIncludeCutLines = useProjectStore((state) => state.pdfIncludeCutLines);
  const pdfDuplexLayout = useProjectStore((state) => state.pdfDuplexLayout);
  const exportMode = useProjectStore((state) => state.exportMode);
  const exportDpi = useProjectStore((state) => state.exportDpi);
  const editingCardFromStore = useProjectStore(selectEditingCard);
  const isEditDialogOpen = useProjectStore((state) => state.isEditDialogOpen);

  const addOrUpdateTemplateAction = useProjectStore((state) => state.addOrUpdateTemplate);
  const setDefaultTemplatesFromFilesAction = useProjectStore((state) => state.setDefaultTemplatesFromFiles);
  const setUserTemplatesFromFilesAction = useProjectStore((state) => state.setUserTemplatesFromFiles);
  const mergeUserTemplatesFromFilesAction = useProjectStore((state) => state.mergeUserTemplatesFromFiles);
  const deleteTemplateAction = useProjectStore((state) => state.deleteTemplate);
  const cloneTemplateAction = useProjectStore((state) => state.cloneTemplate);
  const setAppearanceStylesFromFilesAction = useProjectStore((state) => state.setAppearanceStylesFromFiles);
  const replaceAppearanceStylesFromFilesAction = useProjectStore((state) => state.replaceAppearanceStylesFromFiles);
  const addOrUpdateAppearanceStyleAction = useProjectStore((state) => state.addOrUpdateAppearanceStyle);
  const deleteAppearanceStyleAction = useProjectStore((state) => state.deleteAppearanceStyle);
  const addGeneratedCardsAction = useProjectStore((state) => state.addGeneratedCards);
  const createCardSetAction = useProjectStore((state) => state.createCardSet);
  const removeGeneratedCardAction = useProjectStore((state) => state.removeGeneratedCard);
  const updateGeneratedCardAction = useProjectStore((state) => state.updateGeneratedCard);
  const reviseGeneratedCardsAction = useProjectStore((state) => state.reviseGeneratedCards);
  const undoLastBulkRevisionAction = useProjectStore((state) => state.undoLastBulkRevision);
  const retargetGeneratedCardsTemplateAction = useProjectStore((state) => state.retargetGeneratedCardsTemplate);
  const retargetGeneratedCardsBackingTemplateAction = useProjectStore((state) => state.retargetGeneratedCardsBackingTemplate);
  const setStoredCardsFromFileAction = useProjectStore((state) => state.setStoredCardsFromFile);
  const mergeStoredCardsFromFileAction = useProjectStore((state) => state.mergeStoredCardsFromFile);
  const setSelectedPaperSizeAction = useProjectStore((state) => state.setSelectedPaperSize);
  const setStudioViewAction = useProjectStore((state) => state.setStudioView);
  const setActiveCardSetNameAction = useProjectStore((state) => state.setActiveCardSetName);
  const setGeneratorSelectedTemplateIdAction = useProjectStore((state) => state.setGeneratorSelectedTemplateId);
  const setGeneratorSelectedBackingTemplateIdAction = useProjectStore((state) => state.setGeneratorSelectedBackingTemplateId);
  const setTemplateEditorSelectedTemplateIdAction = useProjectStore((state) => state.setTemplateEditorSelectedTemplateId);
  const setPdfOptionsAction = useProjectStore((state) => state.setPdfOptions);
  const setExportModeAction = useProjectStore((state) => state.setExportMode);
  const setExportDpiAction = useProjectStore((state) => state.setExportDpi);
  const openEditDialogAction = useProjectStore((state) => state.openEditDialog);
  const closeEditDialogAction = useProjectStore((state) => state.closeEditDialog);

  const {
    backFacePresetTemplates,
    freeformTemplatesForGenerator,
    standardDefaultTemplates,
  } = useMemo(() => splitTemplatesForWorkspace({
    allTemplates: templatesFromStore,
    defaultTemplates: defaultTemplatesFromStore,
  }), [defaultTemplatesFromStore, templatesFromStore]);

  const generatorSelectedTemplateId = useMemo(() => resolveGeneratorFrontTemplateId(
    freeformTemplatesForGenerator,
    requestedGeneratorTemplateId,
  ), [freeformTemplatesForGenerator, requestedGeneratorTemplateId]);

  return {
    actions: {
      addGeneratedCardsAction,
      createCardSetAction,
      addOrUpdateAppearanceStyleAction,
      addOrUpdateTemplateAction,
      cloneTemplateAction,
      closeEditDialogAction,
      deleteAppearanceStyleAction,
      deleteTemplateAction,
      openEditDialogAction,
      removeGeneratedCardAction,
      retargetGeneratedCardsBackingTemplateAction,
      retargetGeneratedCardsTemplateAction,
      setStudioViewAction,
      setActiveCardSetNameAction,
      setAppearanceStylesFromFilesAction,
      replaceAppearanceStylesFromFilesAction,
      setDefaultTemplatesFromFilesAction,
      mergeUserTemplatesFromFilesAction,
      mergeStoredCardsFromFileAction,
      setExportDpiAction,
      setExportModeAction,
      setPdfOptionsAction,
      setSelectedPaperSizeAction,
      setGeneratorSelectedTemplateIdAction,
      setGeneratorSelectedBackingTemplateIdAction,
      setTemplateEditorSelectedTemplateIdAction,
      setStoredCardsFromFileAction,
      setUserTemplatesFromFilesAction,
      updateGeneratedCardAction,
      reviseGeneratedCardsAction,
      undoLastBulkRevisionAction,
    },
    state: {
      studioView,
      activeCardSet,
      appearanceStyles,
      backFacePresetTemplates,
      editingCardFromStore,
      exportDpi,
      exportMode,
      freeformTemplatesForGenerator,
      generatedDisplayCards,
      generatorSelectedTemplateId,
      isEditDialogOpen,
      pdfCardSpacingMm,
      pdfDuplexLayout,
      pdfIncludeCutLines,
      pdfMarginMm,
      richTextHighlightColor,
      selectedPaperSize,
      generatorSelectedBackingTemplateId,
      standardDefaultTemplates,
      storedCards,
      templateEditorSelectedTemplateId,
      templatesFromStore,
      userTemplatesFromStore,
    },
  };
}
