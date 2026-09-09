"use client";

import type { CardAssetOption } from '@/domain/templates';

import {
  CUSTOM_FONT_ASSETS_STORAGE_KEY,
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
  readTypedProjectAssetListFromStorage,
} from '../persistence/projectAssets';
import { readProjectFonts } from '../persistence/projectFonts';
import { normalizeProjectFontAssets, MAX_PROJECT_FONTS, PROJECT_FONT_LIBRARY_CHANGE_EVENT } from '../model/projectFont';
import { createBrowserKeyValueStorage } from '../persistence/indexedDbStorage';
import { getProjectPersistenceScope, getScopedProjectStorageNamespace } from '../persistence/projectPersistenceScope';
import { externalizeBrowserProjectAssetJson } from '../persistence/contentAddressedBrowserAssets';
import { selectAllTemplates } from '../store/selectors';
import { createProjectWorkspaceDraft, useProjectStore, type ProjectState } from '../store/workspaceStore';

export type ProjectWorkspaceApplyMode = 'replace' | 'merge' | 'copy';

export interface ProjectWorkspaceApplySummary {
  activeSetId: string | null;
  importedTemplateCount: number;
  successCount: number;
  skippedCount: number;
}

export const captureCurrentProjectDocument = async (): Promise<ProjectDocumentV1> => {
  const scope = getProjectPersistenceScope();
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
  if (getProjectPersistenceScope() !== scope || useProjectStore.getState() !== state) {
    throw new Error('The workspace or account changed while the editable snapshot was being prepared. Retry from the current workspace.');
  }

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
  options: { expectedState?: ProjectState; replaceSetIds?: readonly string[] } = {},
): Promise<ProjectWorkspaceApplySummary> => {
  const draft = createProjectWorkspaceDraft(options.expectedState);
  const sourceDocument = mode === 'copy'
    ? instantiateProjectDocumentCopy(document, (kind) => `${kind}-${globalThis.crypto.randomUUID()}`)
    : document;
  const writeMode = mode === 'copy' ? 'merge' : mode;
  const patch = applyProjectDocumentToState(sourceDocument);
  const scope = getProjectPersistenceScope();
  const assetNamespace = getScopedProjectStorageNamespace('project-assets', scope);
  const storage = createBrowserKeyValueStorage(assetNamespace);
  const incomingCatalogs: Record<string, unknown[]> = { ...patch.customAssets, [CUSTOM_FONT_ASSETS_STORAGE_KEY]: patch.customFonts };
  const relatedWrites = await Promise.all(Object.entries(incomingCatalogs).map(async ([key, incoming]) => {
    const expectedValue = await storage.getItem(key);
    // Explicit whole-workspace recovery can replace an unreadable catalog; the
    // native transaction preserves its exact original bytes in the recovery map.
    const current: unknown = writeMode === 'replace' || expectedValue === null ? [] : JSON.parse(expectedValue);
    if (!Array.isArray(current)) throw new Error('The local artwork catalog is unreadable. It was left unchanged.');
    const entries = writeMode === 'merge' ? [...current, ...incoming] : incoming;
    const byId = new Map<string, unknown>();
    entries.forEach((entry, index) => {
      const id = entry && typeof entry === 'object' && 'id' in entry && typeof entry.id === 'string' ? entry.id : `__asset_${index}`;
      byId.set(id, entry);
    });
    let values = [...byId.values()];
    if (key === CUSTOM_FONT_ASSETS_STORAGE_KEY) {
      values = normalizeProjectFontAssets(values);
      if (values.length > MAX_PROJECT_FONTS) throw new Error(`A CardForge project can use at most ${MAX_PROJECT_FONTS} personal fonts.`);
    }
    const externalized = await externalizeBrowserProjectAssetJson(JSON.stringify(values), scope);
    return { key: `${assetNamespace}:${key}`, value: externalized.storedValue, expectedValue };
  }));
  if (options.replaceSetIds?.length) {
    const replacing = new Set(options.replaceSetIds);
    draft.setState((current) => ({
      cardSets: current.cardSets.filter((set) => !replacing.has(set.id)),
      storedCards: current.storedCards.filter((card) => !card.setId || !replacing.has(card.setId)),
      activeCardSet: current.activeCardSet && replacing.has(current.activeCardSet.id) ? null : current.activeCardSet,
    }));
  }

  const state = draft.getState();
  const importedTemplateCount = writeMode === 'merge'
    ? state.mergeUserTemplatesFromFiles(patch.userTemplates)
    : state.setUserTemplatesFromFiles(patch.userTemplates);

  const afterTemplates = draft.getState();
  if (writeMode === 'merge') {
    afterTemplates.mergeCardSetsFromFiles(patch.cardSets, patch.activeCardSetId);
    afterTemplates.setAppearanceStylesFromFiles(patch.appearanceStyles);
  } else {
    afterTemplates.setCardSetsFromFiles(patch.cardSets, patch.activeCardSetId);
    afterTemplates.replaceAppearanceStylesFromFiles(patch.appearanceStyles);
  }

  const afterSets = draft.getState();
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
    ? draft.getState().mergeStoredCardsFromFile(patch.storedCards)
    : draft.getState().setStoredCardsFromFile(patch.storedCards);
  const activeSet = draft.getState().activeCardSet;
  const activeTemplateId = patch.storedCards.find((card) => !activeSet || card.setId === activeSet.id)?.templateId ?? null;
  if (activeTemplateId) {
    draft.getState().setGeneratorSelectedTemplateId(activeTemplateId);
    draft.getState().setTemplateEditorSelectedTemplateId(activeTemplateId);
  }

  await draft.commit(relatedWrites);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PROJECT_FONT_LIBRARY_CHANGE_EVENT));
  return {
    activeSetId: activeSet?.id ?? null,
    importedTemplateCount,
    successCount: cardResult.successCount,
    skippedCount: cardResult.skippedCount,
  };
};
