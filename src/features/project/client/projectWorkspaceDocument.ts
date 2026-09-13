"use client";

import type { CardAssetOption, TCGCardTemplate } from '@/domain/templates';

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

const templateSnapshotFingerprint = (template: TCGCardTemplate): string => JSON.stringify(template);

/**
 * A portable Set may contain an older snapshot with the same historical
 * runtime Template id as current browser work. Merge must never overwrite a
 * different live design merely because those ids collide. Keep exact matches
 * shared; re-key different snapshots while retaining their lineage metadata.
 */
export const rekeyConflictingTemplateSnapshots = (
  document: ProjectDocumentV1,
  currentTemplates: readonly TCGCardTemplate[],
  createId: () => string = () => `template-${globalThis.crypto.randomUUID()}`,
): ProjectDocumentV1 => {
  const currentById = new Map(currentTemplates.flatMap((template) => template.id ? [[template.id, template] as const] : []));
  const usedIds = new Set([
    ...currentById.keys(),
    ...document.userTemplates.flatMap((template) => template.id ? [template.id] : []),
  ]);
  const remap = new Map<string, string>();
  const nextTemplates = document.userTemplates.map((template) => {
    const id = template.id;
    if (!id) return template;
    const existing = currentById.get(id);
    if (!existing || templateSnapshotFingerprint(existing) === templateSnapshotFingerprint(template)) return template;
    let nextId = createId();
    while (!nextId || usedIds.has(nextId)) nextId = createId();
    usedIds.add(nextId);
    remap.set(id, nextId);
    return { ...template, id: nextId };
  });
  if (!remap.size) return document;
  const mapTemplateId = (id: string | null | undefined) => id ? remap.get(id) ?? id : id;
  return {
    ...document,
    userTemplates: nextTemplates,
    cardSets: document.cardSets.map((set) => ({
      ...set,
      ...(set.templateIds ? { templateIds: set.templateIds.map((id) => mapTemplateId(id)!) } : {}),
    })),
    storedCards: document.storedCards.map((card) => ({
      ...card,
      templateId: mapTemplateId(card.templateId)!,
      backingTemplateId: mapTemplateId(card.backingTemplateId),
    })),
  };
};

const restoreCopiedSetTemplateReferences = (
  source: ProjectDocumentV1,
  copied: ProjectDocumentV1,
): ProjectDocumentV1 => {
  const templateIds = new Map(source.userTemplates.flatMap((template, index) => {
    const copiedId = copied.userTemplates[index]?.id;
    return template.id && copiedId ? [[template.id, copiedId] as const] : [];
  }));
  return {
    ...copied,
    cardSets: copied.cardSets.map((set, index) => {
      const sourceSet = source.cardSets[index];
      if (!sourceSet?.templateIds?.length) return set;
      return {
        ...set,
        templateIds: sourceSet.templateIds.map((id) => templateIds.get(id) ?? id),
      };
    }),
  };
};

export const captureCurrentProjectDocument = async (): Promise<ProjectDocumentV1> => {
  const scope = getProjectPersistenceScope();
  const state = useProjectStore.getState();
  const referencedTemplateIds = new Set([
    ...state.cardSets.flatMap((set) => set.templateIds ?? []),
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

export const captureCardSetProjectDocument = async (setId: string): Promise<ProjectDocumentV1> => {
  const document = await captureCurrentProjectDocument();
  const isolated = isolateProjectDocumentToSet(document, setId);
  const set = document.cardSets.find((candidate) => candidate.id === setId);
  if (!set?.templateIds?.length) return isolated;
  const templateIds = new Set([
    ...set.templateIds,
    ...isolated.storedCards.flatMap((card) => [card.templateId, card.backingTemplateId]),
  ].filter((value): value is string => Boolean(value)));
  return {
    ...isolated,
    userTemplates: document.userTemplates.filter((template) => Boolean(template.id && templateIds.has(template.id))),
  };
};

export const captureCardProjectDocument = async (cardId: string): Promise<ProjectDocumentV1> => (
  isolateProjectDocumentToCard(await captureCurrentProjectDocument(), cardId)
);

export const applyProjectDocumentToWorkspace = async (
  document: ProjectDocumentV1,
  mode: ProjectWorkspaceApplyMode,
  options: { expectedState?: ProjectState; replaceSetIds?: readonly string[] } = {},
): Promise<ProjectWorkspaceApplySummary> => {
  const draft = createProjectWorkspaceDraft(options.expectedState);
  const independent = mode === 'copy'
    ? restoreCopiedSetTemplateReferences(
        document,
        instantiateProjectDocumentCopy(document, (kind) => `${kind}-${globalThis.crypto.randomUUID()}`),
      )
    : document;
  const sourceDocument = mode === 'merge'
    ? rekeyConflictingTemplateSnapshots(independent, selectAllTemplates(draft.getState()))
    : independent;
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
  const activeTemplateId = patch.storedCards.find((card) => !activeSet || card.setId === activeSet.id)?.templateId
    ?? patch.cardSets.find((set) => set.id === activeSet?.id)?.templateIds?.[0]
    ?? null;
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
