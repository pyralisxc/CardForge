"use client";

import type { CardAssetOption } from '@/domain/templates';

import {
  CUSTOM_DIVIDER_ASSETS_STORAGE_KEY,
  CUSTOM_ICON_ASSETS_STORAGE_KEY,
  CUSTOM_IMAGE_ASSETS_STORAGE_KEY,
  CUSTOM_TEXTURE_ASSETS_STORAGE_KEY,
  applyProjectDocumentToState,
  createProjectDocumentFromState,
  isolateProjectDocumentToSet,
  isolateProjectDocumentToCard,
  instantiateProjectDocumentCopy,
  type ProjectDocumentV1,
} from '../model/projectDocument';
import {
  getProjectAssetStorage,
  mergeProjectAssetListToStorage,
  readTypedProjectAssetListFromStorage,
  writeProjectAssetListToStorage,
} from '../persistence/projectAssets';
import { readProjectFonts, writeProjectFonts } from '../persistence/projectFonts';
import { selectAllTemplates } from '../store/selectors';
import { persistProjectWorkspaceNow, useProjectStore } from '../store/workspaceStore';

export type ProjectWorkspaceApplyMode = 'replace' | 'merge' | 'copy';

export interface ProjectWorkspaceApplySummary {
  activeSetId: string | null;
  importedTemplateCount: number;
  successCount: number;
  skippedCount: number;
}

export const captureCurrentProjectDocument = async (): Promise<ProjectDocumentV1> => {
  const state = useProjectStore.getState();
  const referencedTemplateIds = new Set([
    ...state.storedCards.flatMap((card) => [card.templateId, card.backingTemplateId]),
  ].filter((value): value is string => Boolean(value)));
  const portableTemplates = selectAllTemplates(state).filter((template) => (
    template.templateSource === 'user' || Boolean(template.id && referencedTemplateIds.has(template.id))
  ));
  const assetStorage = getProjectAssetStorage();
  const [customTextureAssets, customDividerAssets, customIconAssets, customImageAssets, customFonts] = await Promise.all([
    readTypedProjectAssetListFromStorage<CardAssetOption>(assetStorage, CUSTOM_TEXTURE_ASSETS_STORAGE_KEY),
    readTypedProjectAssetListFromStorage<CardAssetOption>(assetStorage, CUSTOM_DIVIDER_ASSETS_STORAGE_KEY),
    readTypedProjectAssetListFromStorage<CardAssetOption>(assetStorage, CUSTOM_ICON_ASSETS_STORAGE_KEY),
    readTypedProjectAssetListFromStorage<CardAssetOption>(assetStorage, CUSTOM_IMAGE_ASSETS_STORAGE_KEY),
    readProjectFonts(),
  ]);

  return createProjectDocumentFromState({
    userTemplates: portableTemplates,
    cardSets: state.cardSets,
    activeCardSetId: state.activeCardSet?.id ?? null,
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

export const captureCardSetProjectDocument = async (setId: string): Promise<ProjectDocumentV1> => (
  isolateProjectDocumentToSet(await captureCurrentProjectDocument(), setId)
);

export const captureCardProjectDocument = async (cardId: string): Promise<ProjectDocumentV1> => (
  isolateProjectDocumentToCard(await captureCurrentProjectDocument(), cardId)
);

export const applyProjectDocumentToWorkspace = async (
  document: ProjectDocumentV1,
  mode: ProjectWorkspaceApplyMode,
): Promise<ProjectWorkspaceApplySummary> => {
  const sourceDocument = mode === 'copy'
    ? instantiateProjectDocumentCopy(document, (kind) => `${kind}-${globalThis.crypto.randomUUID()}`)
    : document;
  const writeMode = mode === 'copy' ? 'merge' : mode;
  const patch = applyProjectDocumentToState(sourceDocument);
  const assetStorage = getProjectAssetStorage();
  const writeAssets = writeMode === 'merge' ? mergeProjectAssetListToStorage : writeProjectAssetListToStorage;
  const nextFonts = writeMode === 'merge'
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
  const importedTemplateCount = writeMode === 'merge'
    ? state.mergeUserTemplatesFromFiles(patch.userTemplates)
    : state.setUserTemplatesFromFiles(patch.userTemplates);

  const afterTemplates = useProjectStore.getState();
  if (writeMode === 'merge') {
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

  const cardResult = writeMode === 'merge'
    ? useProjectStore.getState().mergeStoredCardsFromFile(patch.storedCards)
    : useProjectStore.getState().setStoredCardsFromFile(patch.storedCards);
  const activeSet = useProjectStore.getState().activeCardSet;
  const activeTemplateId = patch.storedCards.find((card) => !activeSet || card.setId === activeSet.id)?.templateId ?? null;
  if (activeTemplateId) {
    useProjectStore.getState().setGeneratorSelectedTemplateId(activeTemplateId);
    useProjectStore.getState().setTemplateEditorSelectedTemplateId(activeTemplateId);
  }

  await persistProjectWorkspaceNow();
  return {
    activeSetId: activeSet?.id ?? null,
    importedTemplateCount,
    successCount: cardResult.successCount,
    skippedCount: cardResult.skippedCount,
  };
};
