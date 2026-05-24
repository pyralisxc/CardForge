"use client";

import { useMemo } from 'react';

import { useAppStore } from '@/store/appStore';
import { selectAllTemplates, selectEditingCard, selectGeneratedDisplayCards } from '@/store/selectors';
import {
  getGeneratorSelectedTemplateId,
  splitTemplatesForWorkspace,
} from '@/features/app-shell/lib/workspaceState';

export function useCardForgeWorkspaceState() {
  const defaultTemplatesFromStore = useAppStore((state) => state.defaultTemplates);
  const userTemplatesFromStore = useAppStore((state) => state.userTemplates);
  const templatesFromStore = useAppStore(selectAllTemplates);
  const appearanceStyles = useAppStore((state) => state.appearanceStyles);
  const storedCards = useAppStore((state) => state.storedCards);
  const generatedDisplayCards = useAppStore(selectGeneratedDisplayCards);

  const selectedPaperSize = useAppStore((state) => state.selectedPaperSize);
  const activeTab = useAppStore((state) => state.activeTab);
  const singleCardGeneratorSelectedTemplateId = useAppStore((state) => state.singleCardGeneratorSelectedTemplateId);
  const pdfMarginMm = useAppStore((state) => state.pdfMarginMm);
  const pdfCardSpacingMm = useAppStore((state) => state.pdfCardSpacingMm);
  const pdfIncludeCutLines = useAppStore((state) => state.pdfIncludeCutLines);
  const pdfDuplexLayout = useAppStore((state) => state.pdfDuplexLayout);
  const exportMode = useAppStore((state) => state.exportMode);
  const exportDpi = useAppStore((state) => state.exportDpi);
  const editingCardFromStore = useAppStore(selectEditingCard);
  const isEditDialogOpen = useAppStore((state) => state.isEditDialogOpen);

  const addOrUpdateTemplateAction = useAppStore((state) => state.addOrUpdateTemplate);
  const setDefaultTemplatesFromFilesAction = useAppStore((state) => state.setDefaultTemplatesFromFiles);
  const setUserTemplatesFromFilesAction = useAppStore((state) => state.setUserTemplatesFromFiles);
  const deleteTemplateAction = useAppStore((state) => state.deleteTemplate);
  const cloneTemplateAction = useAppStore((state) => state.cloneTemplate);
  const setAppearanceStylesFromFilesAction = useAppStore((state) => state.setAppearanceStylesFromFiles);
  const addOrUpdateAppearanceStyleAction = useAppStore((state) => state.addOrUpdateAppearanceStyle);
  const deleteAppearanceStyleAction = useAppStore((state) => state.deleteAppearanceStyle);
  const addGeneratedCardsAction = useAppStore((state) => state.addGeneratedCards);
  const clearGeneratedCardsAction = useAppStore((state) => state.clearGeneratedCards);
  const updateGeneratedCardAction = useAppStore((state) => state.updateGeneratedCard);
  const retargetGeneratedCardsTemplateAction = useAppStore((state) => state.retargetGeneratedCardsTemplate);
  const setStoredCardsFromFileAction = useAppStore((state) => state.setStoredCardsFromFile);
  const setSelectedPaperSizeAction = useAppStore((state) => state.setSelectedPaperSize);
  const setActiveTabAction = useAppStore((state) => state.setActiveTab);
  const setSingleCardGeneratorSelectedTemplateIdAction = useAppStore((state) => state.setSingleCardGeneratorSelectedTemplateId);
  const setPdfOptionsAction = useAppStore((state) => state.setPdfOptions);
  const setExportModeAction = useAppStore((state) => state.setExportMode);
  const setExportDpiAction = useAppStore((state) => state.setExportDpi);
  const openEditDialogAction = useAppStore((state) => state.openEditDialog);
  const closeEditDialogAction = useAppStore((state) => state.closeEditDialog);

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
      retargetGeneratedCardsTemplateAction,
      setActiveTabAction,
      setAppearanceStylesFromFilesAction,
      setDefaultTemplatesFromFilesAction,
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
      selectedPaperSize,
      singleCardGeneratorSelectedTemplateId,
      standardDefaultTemplates,
      storedCards,
      templatesFromStore,
      userTemplatesFromStore,
    },
  };
}
