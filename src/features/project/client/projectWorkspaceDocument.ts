"use client";

import type { CardAssetOption } from '@/domain/templates';

import {
  CUSTOM_DIVIDER_ASSETS_STORAGE_KEY,
  CUSTOM_ICON_ASSETS_STORAGE_KEY,
  CUSTOM_IMAGE_ASSETS_STORAGE_KEY,
  CUSTOM_TEXTURE_ASSETS_STORAGE_KEY,
  applyProjectDocumentToState,
  createProjectDocumentFromState,
  type ProjectDocumentV1,
} from '../model/projectDocument';
import {
  getProjectAssetStorage,
  mergeProjectAssetListToStorage,
  readRequiredTypedProjectAssetListFromStorage,
  writeProjectAssetListToStorage,
} from '../persistence/projectAssets';
import { readProjectFonts, writeProjectFonts } from '../persistence/projectFonts';
import { useProjectStore } from '../store/workspaceStore';

export type ProjectWorkspaceApplyMode = 'replace' | 'merge';

export interface ProjectWorkspaceApplySummary {
  importedTemplateCount: number;
  successCount: number;
  skippedCount: number;
}

export const captureCurrentProjectDocument = async (): Promise<ProjectDocumentV1> => {
  const state = useProjectStore.getState();
  const assetStorage = getProjectAssetStorage();
  const [customTextureAssets, customDividerAssets, customIconAssets, customImageAssets, customFonts] = await Promise.all([
    readRequiredTypedProjectAssetListFromStorage<CardAssetOption>(assetStorage, CUSTOM_TEXTURE_ASSETS_STORAGE_KEY),
    readRequiredTypedProjectAssetListFromStorage<CardAssetOption>(assetStorage, CUSTOM_DIVIDER_ASSETS_STORAGE_KEY),
    readRequiredTypedProjectAssetListFromStorage<CardAssetOption>(assetStorage, CUSTOM_ICON_ASSETS_STORAGE_KEY),
    readRequiredTypedProjectAssetListFromStorage<CardAssetOption>(assetStorage, CUSTOM_IMAGE_ASSETS_STORAGE_KEY),
    readProjectFonts(),
  ]);

  return createProjectDocumentFromState({
    userTemplates: state.userTemplates,
    cardSets: state.cardSets,
    activeCardSetId: state.activeCardSet.id,
    storedCards: state.storedCards,
    appearanceStyles: state.appearanceStyles,
    selectedPaperSize: state.selectedPaperSize,
    pdfMarginMm: state.pdfMarginMm,
    pdfCardSpacingMm: state.pdfCardSpacingMm,
    pdfIncludeCutLines: state.pdfIncludeCutLines,
    pdfDuplexLayout: state.pdfDuplexLayout,
    exportMode: state.exportMode,
    exportDpi: state.exportDpi,
    customTextureAssets,
    customDividerAssets,
    customIconAssets,
    customImageAssets,
    customFonts,
  });
};

export const applyProjectDocumentToWorkspace = async (
  document: ProjectDocumentV1,
  mode: ProjectWorkspaceApplyMode,
): Promise<ProjectWorkspaceApplySummary> => {
  const patch = applyProjectDocumentToState(document);
  const assetStorage = getProjectAssetStorage();
  const writeAssets = mode === 'merge' ? mergeProjectAssetListToStorage : writeProjectAssetListToStorage;
  const nextFonts = mode === 'merge'
    ? [
        ...await readProjectFonts(),
        ...patch.customFonts,
      ].filter((font, index, fonts) => fonts.findIndex((candidate) => candidate.id === font.id) === index)
    : patch.customFonts;
  await Promise.all([
    writeAssets(assetStorage, CUSTOM_TEXTURE_ASSETS_STORAGE_KEY, patch.customAssets[CUSTOM_TEXTURE_ASSETS_STORAGE_KEY]),
    writeAssets(assetStorage, CUSTOM_DIVIDER_ASSETS_STORAGE_KEY, patch.customAssets[CUSTOM_DIVIDER_ASSETS_STORAGE_KEY]),
    writeAssets(assetStorage, CUSTOM_ICON_ASSETS_STORAGE_KEY, patch.customAssets[CUSTOM_ICON_ASSETS_STORAGE_KEY]),
    writeAssets(assetStorage, CUSTOM_IMAGE_ASSETS_STORAGE_KEY, patch.customAssets[CUSTOM_IMAGE_ASSETS_STORAGE_KEY]),
    writeProjectFonts(nextFonts),
  ]);

  const state = useProjectStore.getState();
  const importedTemplateCount = mode === 'merge'
    ? state.mergeUserTemplatesFromFiles(patch.userTemplates)
    : state.setUserTemplatesFromFiles(patch.userTemplates);

  const afterTemplates = useProjectStore.getState();
  if (mode === 'merge') {
    afterTemplates.mergeCardSetsFromFiles(patch.cardSets, patch.activeCardSetId);
    afterTemplates.setAppearanceStylesFromFiles(patch.appearanceStyles);
  } else {
    afterTemplates.setCardSetsFromFiles(patch.cardSets, patch.activeCardSetId);
    afterTemplates.replaceAppearanceStylesFromFiles(patch.appearanceStyles);
  }

  const afterSets = useProjectStore.getState();
  if (patch.selectedPaperSize) afterSets.setSelectedPaperSize(patch.selectedPaperSize);
  afterSets.setPdfOptions({
    margin: patch.pdfMarginMm,
    spacing: patch.pdfCardSpacingMm,
    cutLines: patch.pdfIncludeCutLines,
    duplexLayout: patch.pdfDuplexLayout,
  });
  if (patch.exportMode) afterSets.setExportMode(patch.exportMode);
  if (patch.exportDpi) afterSets.setExportDpi(patch.exportDpi);

  const cardResult = mode === 'merge'
    ? useProjectStore.getState().mergeStoredCardsFromFile(patch.storedCards)
    : useProjectStore.getState().setStoredCardsFromFile(patch.storedCards);
  const activeSet = useProjectStore.getState().activeCardSet;
  useProjectStore.getState().setSingleCardGeneratorSelectedTemplateId(activeSet.frontTemplateId);
  useProjectStore.getState().setTemplateEditorSelectedTemplateId(activeSet.frontTemplateId);

  return {
    importedTemplateCount,
    successCount: cardResult.successCount,
    skippedCount: cardResult.skippedCount,
  };
};
