"use client";

import { withIndependentTemplateIdentity, type CardAssetOption, type TCGCardTemplate } from '@/domain/templates';
import { authoredPlanValuesEqual, normalizeSetPlan, type SetPlan } from '@/domain/cards';

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
  materializeProjectTemplateOwnership,
  materializeSetPlanOwnership,
  type ProjectDocumentV1,
} from '../model/projectDocument';
import { getTemplateOwnerSetId, SetTemplateOwnershipError } from '../model/setTemplateOwnership';
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
import { projectAssetArrayScope, projectAssetChildScope, type ProjectAssetScope } from '../model/projectAssetTraversal';

import { prepareCompletedDeletionCleanup, notifyCompletedDeletionCleanup } from './completedDeletionCleanup';

export type ProjectWorkspaceApplyMode = 'replace' | 'merge' | 'copy' | 'adopt';

export interface ProjectWorkspaceApplySummary {
  activeSetId: string | null;
  activeTemplateId: string | null;
  installedTemplateIds: string[];
  installedCardIds: string[];
  importedTemplateCount: number;
  successCount: number;
  skippedCount: number;
}

/**
 * Workspace UI state shares the same Zustand object as portable project data.
 * Snapshot preparation may span IndexedDB reads, so compare only the fields
 * that the project document actually serializes. Selection, tool, and camera
 * changes must not turn a coherent document into a false concurrency failure.
 */
export const hasProjectDocumentStateChanged = (
  expected: ProjectState,
  current: ProjectState,
): boolean => (
  expected.defaultTemplates !== current.defaultTemplates
  || expected.userTemplates !== current.userTemplates
  || expected.cardSets !== current.cardSets
  || expected.activeCardSet !== current.activeCardSet
  || expected.storedCards !== current.storedCards
  || expected.appearanceStyles !== current.appearanceStyles
  || expected.selectedPaperSize !== current.selectedPaperSize
  || expected.pdfMarginMm !== current.pdfMarginMm
  || expected.pdfCardSpacingMm !== current.pdfCardSpacingMm
  || expected.pdfIncludeCutLines !== current.pdfIncludeCutLines
  || expected.pdfDuplexLayout !== current.pdfDuplexLayout
  || expected.exportMode !== current.exportMode
  || expected.exportDpi !== current.exportDpi
);

/**
 * Merging always forks colliding identities, even when their snapshots match.
 * Only same-destination adoption may retain an exact owned identity.
 */
export const rekeyConflictingTemplateSnapshots = (
  document: ProjectDocumentV1,
  currentTemplates: readonly TCGCardTemplate[],
  createId: () => string = () => `template-${globalThis.crypto.randomUUID()}`,
): ProjectDocumentV1 => {
  const currentById = new Map(currentTemplates.flatMap((template) => template.id ? [[template.id, template] as const] : []));
  const incomingSnapshotIds = new Set(document.userTemplates.flatMap((template) => template.id ? [template.id] : []));
  const incomingReferenceIds = new Set([
    ...document.cardSets.flatMap((set) => set.templateIds ?? []),
    ...document.storedCards.flatMap((card) => [card.templateId, card.backingTemplateId]),
  ].filter((id): id is string => Boolean(id)));
  for (const id of incomingReferenceIds) {
    if (!incomingSnapshotIds.has(id) && currentById.has(id)) {
      throw new SetTemplateOwnershipError(
        'conflict',
        `Incoming Set work references Template ${id} without its snapshot, but that identity already exists in this workspace. Reload a complete snapshot or import an independent copy; existing work was left unchanged.`,
      );
    }
  }
  const usedIds = new Set([
    ...currentById.keys(),
    ...document.userTemplates.flatMap((template) => template.id ? [template.id] : []),
  ]);
  const remap = new Map<string, string>();
  const nextTemplates = document.userTemplates.map((template) => {
    const id = template.id;
    if (!id) return template;
    const existing = currentById.get(id);
    if (!existing) return template;
    let nextId = createId();
    while (!nextId || usedIds.has(nextId)) nextId = createId();
    usedIds.add(nextId);
    remap.set(id, nextId);
    return withIndependentTemplateIdentity({ ...template, id: nextId }, template, createId);
  });
  if (!remap.size) return document;
  const mapTemplateId = (id: string | null | undefined) => id ? remap.get(id) ?? id : id;
  return {
    ...document,
    userTemplates: nextTemplates,
    cardSets: document.cardSets.map((set) => ({
      ...set,
      ...(set.templateIds ? { templateIds: set.templateIds.map((id) => mapTemplateId(id)!) } : {}),
      ...(set.updateReviews ? { updateReviews: set.updateReviews.map((review) => ({
        ...structuredClone(review),
        templateId: mapTemplateId(review.templateId)!,
      })) } : {}),
    })),
    storedCards: document.storedCards.map((card) => ({
      ...card,
      templateId: mapTemplateId(card.templateId)!,
      backingTemplateId: mapTemplateId(card.backingTemplateId),
    })),
  };
};


export const captureCurrentProjectDocument = async (): Promise<ProjectDocumentV1> => {
  const scope = getProjectPersistenceScope();
  const state = useProjectStore.getState();
  const referencedTemplateIds = new Set([
    ...state.cardSets.flatMap((set) => set.templateIds ?? []),
    ...state.storedCards.flatMap((card) => [card.templateId, card.backingTemplateId]),
  ].filter((value): value is string => Boolean(value)));
  const portableTemplates = state.userTemplates.filter((template) => (
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
  if (getProjectPersistenceScope() !== scope || hasProjectDocumentStateChanged(state, useProjectStore.getState())) {
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

const collectPortableStringReferences = (value: unknown, output = new Set<string>(), scope: ProjectAssetScope = 'root'): Set<string> => {
  if (scope === 'opaque') return output;
  if (typeof value === 'string') {
    output.add(value);
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectPortableStringReferences(entry, output, projectAssetArrayScope(scope)));
    return output;
  }
  if (!value || typeof value !== 'object') return output;
  const record = value as Record<string, unknown>;
  if (scope === 'requirement' && ['custom-generated', 'user-provided'].includes(String(record.source)) && typeof record.assetId === 'string') output.add(record.assetId);
  Object.entries(record).forEach(([key, entry]) => collectPortableStringReferences(entry, output, projectAssetChildScope(scope, key)));
  return output;
};

const keepReferencedPortableResources = (document: ProjectDocumentV1): ProjectDocumentV1 => {
  // Resource catalogs are available to the whole browser account, but one Set
  // revision should only carry resources its authored graph actually references.
  // An explicit future "prepared resources" membership can extend this closure
  // without returning to whole-personal-library snapshots.
  const referenceSeed: ProjectDocumentV1 = {
    ...document,
    appearanceStyles: [],
    customAssets: {
      [CUSTOM_TEXTURE_ASSETS_STORAGE_KEY]: [],
      [CUSTOM_DIVIDER_ASSETS_STORAGE_KEY]: [],
      [CUSTOM_ICON_ASSETS_STORAGE_KEY]: [],
      [CUSTOM_IMAGE_ASSETS_STORAGE_KEY]: [],
    },
    customFonts: [],
  };
  const references = collectPortableStringReferences(referenceSeed);
  const appearanceStyles = document.appearanceStyles.filter((style) => references.has(style.id));
  collectPortableStringReferences(appearanceStyles, references);
  const referencedAssets = (assets: CardAssetOption[]) => assets.filter((asset) => (
    references.has(asset.id)
    || references.has(asset.url)
    || Boolean(asset.previewUrl && references.has(asset.previewUrl))
  ));
  const customFonts = document.customFonts?.filter((font) => (
    references.has(font.id) || references.has(font.value) || references.has(font.dataUrl)
  ));
  return {
    ...document,
    appearanceStyles,
    customAssets: {
      [CUSTOM_TEXTURE_ASSETS_STORAGE_KEY]: referencedAssets(document.customAssets[CUSTOM_TEXTURE_ASSETS_STORAGE_KEY]),
      [CUSTOM_DIVIDER_ASSETS_STORAGE_KEY]: referencedAssets(document.customAssets[CUSTOM_DIVIDER_ASSETS_STORAGE_KEY]),
      [CUSTOM_ICON_ASSETS_STORAGE_KEY]: referencedAssets(document.customAssets[CUSTOM_ICON_ASSETS_STORAGE_KEY]),
      [CUSTOM_IMAGE_ASSETS_STORAGE_KEY]: referencedAssets(document.customAssets[CUSTOM_IMAGE_ASSETS_STORAGE_KEY]),
    },
    ...(customFonts?.length ? { customFonts } : { customFonts: undefined }),
  };
};

export const captureCardSetProjectDocument = async (setId: string): Promise<ProjectDocumentV1> => {
  const document = await captureCurrentProjectDocument();
  const isolated = isolateProjectDocumentToSet(document, setId);
  const set = document.cardSets.find((candidate) => candidate.id === setId);
  const templateIds = new Set([
    ...(set?.templateIds ?? []),
    ...isolated.storedCards.flatMap((card) => [card.templateId, card.backingTemplateId]),
  ].filter((value): value is string => Boolean(value)));
  return keepReferencedPortableResources({
    ...isolated,
    userTemplates: document.userTemplates.filter((template) => Boolean(template.id && templateIds.has(template.id))),
  });
};

export const captureCardProjectDocument = async (cardId: string): Promise<ProjectDocumentV1> => (
  isolateProjectDocumentToCard(await captureCurrentProjectDocument(), cardId)
);

export const applyProjectDocumentToWorkspace = async (
  document: ProjectDocumentV1,
  mode: ProjectWorkspaceApplyMode,
  options: { expectedState?: ProjectState; replaceSetIds?: readonly string[]; signal?: AbortSignal; validatePreparedDocument?: (prepared: ProjectDocumentV1) => void } = {},
): Promise<ProjectWorkspaceApplySummary> => {
  options.signal?.throwIfAborted();
  const draft = createProjectWorkspaceDraft(options.expectedState);
  const legacyOwner = document.productionPlan && document.cardSets.length === 1 ? document.cardSets[0] : undefined;
  const cardSets = mode === 'adopt' ? document.cardSets.map((set) => {
    const existingSet = draft.getState().cardSets.find((current) => current.id === set.id);
    if (!existingSet) return set;
    const existingPlan = existingSet.plan;
    if (existingSet.updateReviews !== undefined
      && !authoredPlanValuesEqual(existingSet.updateReviews, set.updateReviews ?? [])) {
      throw new Error('This agent revision has different Set Update Review records. Both were kept; open an independent copy or review the ledger before updating this Set.');
    }
    if (existingPlan && legacyOwner?.id === set.id && !authoredPlanValuesEqual(existingPlan.brief, document.productionPlan)) {
      throw new Error('This legacy draft has a different creation brief from the current Set context. Both were kept; open an independent copy or review the brief before updating this Set.');
    }
    if (existingPlan && set.plan && !authoredPlanValuesEqual(set.plan, existingPlan)) {
      throw new Error('This agent revision has different Set context. Both were kept; open an independent copy or review the context before updating this Set.');
    }
    return {
      ...set,
      ...(existingPlan ? { plan: existingPlan } : {}),
      ...(existingSet.updateReviews !== undefined ? { updateReviews: structuredClone(existingSet.updateReviews) } : {}),
    };
  }) : document.cardSets;
  const compatibleDocument: ProjectDocumentV1 = {
    ...document,
    version: document.version >= 3 ? document.version : cardSets.some((set) => set.plan) ? 2 : document.version,
    cardSets,
  };
  const ownedDocument = materializeProjectTemplateOwnership(materializeSetPlanOwnership(compatibleDocument)).document;
  const cleanup = await prepareCompletedDeletionCleanup(ownedDocument, options.signal);
  options.validatePreparedDocument?.(cleanup.document);
  return applyPreparedProjectDocument(draft, cleanup, mode, options);
};

export const applyCardSetPlan = async ({
  setId, expectedScope, expectedPlan, plan, signal,
}: {
  setId: string;
  expectedScope: ReturnType<typeof getProjectPersistenceScope>;
  expectedPlan: SetPlan | undefined;
  plan: SetPlan;
  signal?: AbortSignal;
}): Promise<void> => {
  signal?.throwIfAborted();
  if (getProjectPersistenceScope() !== expectedScope) throw new Error('The workspace account changed. Your context was not applied; keep this draft and reopen the intended Set.');
  const state = useProjectStore.getState();
  const owner = state.cardSets.find((set) => set.id === setId);
  if (!owner) throw new Error('This Set is no longer in the workspace. Your context draft was not applied.');
  if (owner.plan !== undefined) normalizeSetPlan(owner.plan);
  if (!authoredPlanValuesEqual(owner.plan, expectedPlan)) throw new Error('The Set context changed while you were editing. Your draft was kept; review the current context before replacing it.');
  const nextPlan = normalizeSetPlan(plan);
  const draft = createProjectWorkspaceDraft(state);
  draft.setState({
    cardSets: state.cardSets.map((set) => set.id === setId ? { ...set, plan: nextPlan } : set),
    activeCardSet: state.activeCardSet?.id === setId ? { ...state.activeCardSet, plan: nextPlan } : state.activeCardSet,
  });
  await draft.commit([], signal);
};

/** Once per opening of a saved local workspace; concurrent edits cancel the commit. */
export const cleanCurrentWorkspaceCompletedDeletions = async (signal?: AbortSignal) => {
  const draft = createProjectWorkspaceDraft();
  const storage = createBrowserKeyValueStorage(getScopedProjectStorageNamespace('project-assets', getProjectPersistenceScope()));
  const catalogKeys = [CUSTOM_TEXTURE_ASSETS_STORAGE_KEY, CUSTOM_DIVIDER_ASSETS_STORAGE_KEY,
    CUSTOM_ICON_ASSETS_STORAGE_KEY, CUSTOM_IMAGE_ASSETS_STORAGE_KEY, CUSTOM_FONT_ASSETS_STORAGE_KEY];
  // Snapshot CAS expectations before any asynchronous evidence lookup. Catalog
  // edits need not change Zustand and must not be overwritten by older content.
  const expectedCatalogValues = Object.fromEntries(await Promise.all(catalogKeys.map(async (key) => [key, await storage.getItem(key)] as const)));
  const document = await captureCurrentProjectDocument();
  const cleanup = await prepareCompletedDeletionCleanup(document, signal);
  if (cleanup.changed) await applyPreparedProjectDocument(draft, cleanup, 'replace', { signal, expectedCatalogValues });
};

const applyPreparedProjectDocument = async (
  draft: ReturnType<typeof createProjectWorkspaceDraft>,
  cleanup: Awaited<ReturnType<typeof prepareCompletedDeletionCleanup>>,
  mode: ProjectWorkspaceApplyMode,
  options: { replaceSetIds?: readonly string[]; signal?: AbortSignal; expectedCatalogValues?: Record<string, string | null> },
): Promise<ProjectWorkspaceApplySummary> => {
  const document = cleanup.document;
  const independent = mode === 'copy'
    ? instantiateProjectDocumentCopy(document, (kind) => `${kind}-${globalThis.crypto.randomUUID()}`)
    : document;
  const sourceDocument = mode === 'merge'
    ? rekeyConflictingTemplateSnapshots(independent, selectAllTemplates(draft.getState()))
    : independent;
  // Agent revision adoption is a lineage-aware merge: stable CardForge ids are
  // intentional and must update in place rather than being treated as import collisions.
  const writeMode = mode === 'copy' || mode === 'adopt' ? 'merge' : mode;
  const patch = applyProjectDocumentToState(sourceDocument);
  const scope = getProjectPersistenceScope();
  const assetNamespace = getScopedProjectStorageNamespace('project-assets', scope);
  const storage = createBrowserKeyValueStorage(assetNamespace);
  const incomingCatalogs: Record<string, unknown[]> = { ...patch.customAssets, [CUSTOM_FONT_ASSETS_STORAGE_KEY]: patch.customFonts };
  const relatedWrites = await Promise.all(Object.entries(incomingCatalogs).map(async ([key, incoming]) => {
    const expectedValue = options.expectedCatalogValues && Object.hasOwn(options.expectedCatalogValues, key)
      ? options.expectedCatalogValues[key] : await storage.getItem(key);
    // Explicit whole-workspace recovery can replace an unreadable catalog; the
    // native transaction preserves its exact original bytes in the recovery map.
    const current: unknown = writeMode === 'replace' || expectedValue === null ? [] : JSON.parse(expectedValue);
    if (!Array.isArray(current)) throw new Error('The local artwork catalog is unreadable. It was left unchanged.');
    const [normalizedCurrent, normalizedIncoming] = await Promise.all([
      externalizeBrowserProjectAssetJson(JSON.stringify(current), scope),
      externalizeBrowserProjectAssetJson(JSON.stringify(incoming), scope),
    ]);
    const currentRows = JSON.parse(normalizedCurrent.storedValue) as unknown[];
    const incomingRows = JSON.parse(normalizedIncoming.storedValue) as unknown[];
    const byId = new Map<string, unknown>();
    currentRows.forEach((entry, index) => {
      const id = entry && typeof entry === 'object' && 'id' in entry && typeof entry.id === 'string' ? entry.id : `__current_asset_${index}`;
      byId.set(id, entry);
    });
    if (writeMode === 'merge') {
      incomingRows.forEach((entry, index) => {
        const id = entry && typeof entry === 'object' && 'id' in entry && typeof entry.id === 'string' ? entry.id : `__incoming_asset_${index}`;
        const existing = byId.get(id);
        if (existing !== undefined && !authoredPlanValuesEqual(existing, entry)) {
          throw new Error(`Artwork resource ${id} already exists with different content or metadata. Import it as an independent copy; the current catalog was left unchanged.`);
        }
        if (existing === undefined) byId.set(id, entry);
      });
    } else {
      incomingRows.forEach((entry, index) => {
        const id = entry && typeof entry === 'object' && 'id' in entry && typeof entry.id === 'string' ? entry.id : `__incoming_asset_${index}`;
        byId.set(id, entry);
      });
    }
    let values = [...byId.values()];
    if (key === CUSTOM_FONT_ASSETS_STORAGE_KEY) {
      values = normalizeProjectFontAssets(values);
      if (values.length > MAX_PROJECT_FONTS) throw new Error(`A CardForge project can use at most ${MAX_PROJECT_FONTS} personal fonts.`);
    }
    const externalized = await externalizeBrowserProjectAssetJson(JSON.stringify(values), scope);
    return { key: `${assetNamespace}:${key}`, value: externalized.storedValue, expectedValue };
  }));
  const replaceSetIds = options.replaceSetIds
    ?? (mode === 'adopt' ? sourceDocument.cardSets.map((set) => set.id) : []);
  const replacing = new Set(replaceSetIds);
  const incomingTemplateReferences = new Set([
    ...patch.cardSets.flatMap((set) => set.templateIds ?? []),
    ...patch.storedCards.flatMap((card) => [card.templateId, card.backingTemplateId]),
  ]);
  const retiredTemplateIds = new Set(draft.getState().userTemplates.flatMap((template) => (
    template.id
    && replacing.has(getTemplateOwnerSetId(draft.getState(), template.id) ?? '')
    && !incomingTemplateReferences.has(template.id)
      ? [template.id]
      : []
  )));
  const importedTemplates = patch.userTemplates.filter((template) => !template.id || !retiredTemplateIds.has(template.id));
  if (replaceSetIds.length) {
    draft.setState((current) => {
      const removedTemplateIds = new Set(current.userTemplates.flatMap((template) => (
        template.id && replacing.has(getTemplateOwnerSetId(current, template.id) ?? '')
          ? [template.id]
          : []
      )));
      return {
        cardSets: current.cardSets.filter((set) => !replacing.has(set.id)),
        cardRemovalRecoveries: current.cardRemovalRecoveries.filter((entry) => !replacing.has(entry.setId)),
        storedCards: current.storedCards.filter((card) => {
          const setId = card.setId || current.cardSets[0]?.id;
          return !setId || !replacing.has(setId);
        }),
        userTemplates: current.userTemplates.filter((template) => !template.id || !removedTemplateIds.has(template.id)),
        activeCardSet: current.activeCardSet && replacing.has(current.activeCardSet.id) ? null : current.activeCardSet,
      };
    });
  }
  if (writeMode === 'replace') {
    draft.setState({
      cardSets: [],
      storedCards: [],
      cardRemovalRecoveries: [],
      activeCardSet: null,
    });
  }

  const state = draft.getState();
  const importedTemplateCount = state.installProjectDocumentTemplates(importedTemplates, writeMode);

  const afterTemplates = draft.getState();
  if (writeMode === 'merge') {
    afterTemplates.mergeCardSetsFromFiles(patch.cardSets, patch.activeCardSetId);
    afterTemplates.setAppearanceStylesFromFiles(patch.appearanceStyles);
  } else {
    afterTemplates.setCardSetsFromFiles(patch.cardSets, patch.activeCardSetId);
    afterTemplates.replaceAppearanceStylesFromFiles(patch.appearanceStyles);
  }

  const afterSets = draft.getState();
  // A copy or agent revision must not replace workspace-level output preferences.
  if (mode !== 'adopt' && mode !== 'copy') {
    if (patch.selectedPaperSize) afterSets.setSelectedPaperSize(patch.selectedPaperSize);
    afterSets.setPdfOptions({
      margin: patch.pdfMarginMm,
      spacing: patch.pdfCardSpacingMm,
      cutLines: patch.pdfIncludeCutLines,
      duplexLayout: patch.pdfDuplexLayout,
    });
    if (patch.exportMode) afterSets.setExportMode(patch.exportMode);
    if (patch.exportDpi) afterSets.setExportDpi(patch.exportDpi);
  }

  if (writeMode === 'merge') {
    const existingById = new Map(draft.getState().storedCards.map((card) => [card.uniqueId, card]));
    for (const card of patch.storedCards) {
      const existing = existingById.get(card.uniqueId);
      const existingSetId = existing?.setId ?? draft.getState().cardSets[0]?.id;
      const incomingSetId = card.setId ?? patch.cardSets[0]?.id;
      if (existing && existingSetId !== incomingSetId) {
        throw new Error(`Card ${card.uniqueId} already belongs to a different Set. Import it as an independent copy; the current workspace was left unchanged.`);
      }
      existingById.set(card.uniqueId, card);
    }
    const importedSetIds = new Set(patch.storedCards.map((card) => card.setId ?? patch.cardSets[0]?.id).filter((id): id is string => Boolean(id)));
    draft.setState({
      storedCards: [...existingById.values()],
      cardRemovalRecoveries: draft.getState().cardRemovalRecoveries.filter((entry) => !importedSetIds.has(entry.setId)),
    });
  } else {
    draft.setState({ storedCards: patch.storedCards, cardRemovalRecoveries: [] });
  }
  const activeSetId = patch.activeCardSetId;
  const activeTemplateId = activeSetId
    ? patch.storedCards.find((card) => (card.setId ?? patch.cardSets[0]?.id) === activeSetId)?.templateId
      ?? patch.cardSets.find((set) => set.id === activeSetId)?.templateIds?.[0]
      ?? null
    : null;
  if (activeTemplateId) {
    draft.getState().setGeneratorSelectedTemplateId(activeTemplateId);
    draft.getState().setTemplateEditorSelectedTemplateId(activeTemplateId);
  }

  options.signal?.throwIfAborted();
  await draft.commit(relatedWrites, options.signal, {
    replaceWholeWorkspace: writeMode === 'replace',
  });
  if (cleanup.changed) notifyCompletedDeletionCleanup();
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PROJECT_FONT_LIBRARY_CHANGE_EVENT));
  return {
    activeSetId,
    activeTemplateId,
    installedTemplateIds: importedTemplates.flatMap((template) => template.id ? [template.id] : []),
    installedCardIds: patch.storedCards.map((card) => card.uniqueId),
    importedTemplateCount,
    successCount: patch.storedCards.length,
    skippedCount: 0,
  };
};
