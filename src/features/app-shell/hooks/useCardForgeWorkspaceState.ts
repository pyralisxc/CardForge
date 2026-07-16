"use client";

import { useMemo } from 'react';

import { useProjectStore } from '@/features/project/client';
import { selectAllTemplates, selectEditingCard, selectGeneratedDisplayCards } from '@/features/project/client';
import {
  getGeneratorSelectedTemplateId,
  splitTemplatesForWorkspace,
} from '@/features/app-shell/lib/workspaceState';

export function useCardForgeWorkspaceState() {
  const defaultTemplatesFromStore = useProjectStore((state) => state.defaultTemplates);
  const userTemplatesFromStore = useProjectStore((state) => state.userTemplates);
  const templatesFromStore = useProjectStore(selectAllTemplates);
  const appearanceStyles = useProjectStore((state) => state.appearanceStyles);
  const richTextHighlightColor = useProjectStore((state) => state.richTextHighlightColor);
  const storedCards = useProjectStore((state) => state.storedCards);
  const generatedDisplayCards = useProjectStore(selectGeneratedDisplayCards);

  const selectedPaperSize = useProjectStore((state) => state.selectedPaperSize);
  const activeTab = useProjectStore((state) => state.activeTab);
  const activeCardSet = useProjectStore((state) => state.activeCardSet);
  const singleCardGeneratorSelectedTemplateId = useProjectStore((state) => state.singleCardGeneratorSelectedTemplateId);
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
  const clearGeneratedCardsAction = useProjectStore((state) => state.clearGeneratedCards);
  const removeGeneratedCardAction = useProjectStore((state) => state.removeGeneratedCard);
  const updateGeneratedCardAction = useProjectStore((state) => state.updateGeneratedCard);
  const retargetGeneratedCardsTemplateAction = useProjectStore((state) => state.retargetGeneratedCardsTemplate);
  const setStoredCardsFromFileAction = useProjectStore((state) => state.setStoredCardsFromFile);
  const mergeStoredCardsFromFileAction = useProjectStore((state) => state.mergeStoredCardsFromFile);
  const setSelectedPaperSizeAction = useProjectStore((state) => state.setSelectedPaperSize);
  const setActiveTabAction = useProjectStore((state) => state.setActiveTab);
  const setActiveCardSetNameAction = useProjectStore((state) => state.setActiveCardSetName);
  const setActiveCardSetFrontTemplateIdAction = useProjectStore((state) => state.setActiveCardSetFrontTemplateId);
  const setActiveCardSetBackingTemplateIdAction = useProjectStore((state) => state.setActiveCardSetBackingTemplateId);
  const setSingleCardGeneratorSelectedTemplateIdAction = useProjectStore((state) => state.setSingleCardGeneratorSelectedTemplateId);
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

  const generatorSelectedTemplateId = useMemo(() => getGeneratorSelectedTemplateId(
    freeformTemplatesForGenerator,
    singleCardGeneratorSelectedTemplateId,
  ), [freeformTemplatesForGenerator, singleCardGeneratorSelectedTemplateId]);

  return {
    actions: {
      addGeneratedCardsAction,
      addOrUpdateAppearanceStyleAction,
      addOrUpdateTemplateAction,
      clearGeneratedCardsAction,
      cloneTemplateAction,
      closeEditDialogAction,
      deleteAppearanceStyleAction,
      deleteTemplateAction,
      openEditDialogAction,
      removeGeneratedCardAction,
      retargetGeneratedCardsTemplateAction,
      setActiveTabAction,
      setActiveCardSetBackingTemplateIdAction,
      setActiveCardSetFrontTemplateIdAction,
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
      setSingleCardGeneratorSelectedTemplateIdAction,
      setStoredCardsFromFileAction,
      setUserTemplatesFromFilesAction,
      updateGeneratedCardAction,
    },
    state: {
      activeTab,
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
      singleCardGeneratorSelectedTemplateId,
      standardDefaultTemplates,
      storedCards,
      templatesFromStore,
      userTemplatesFromStore,
    },
  };
}
