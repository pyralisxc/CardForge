"use client";

import { useRouter } from 'next/navigation';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';

import { useToast } from '@/components/ui/use-toast';
import { createDeskReturnHref, createLibraryReturnHref, createStudioHref } from '@/features/app-shell/client/navigation';
import type { CardAssetOption } from '@/domain/templates';
import { loadCardForgeStudioBootstrap } from '@/features/pipeline/client';
import { createCardSetTransfer } from '@/features/project/client/package-transfer';
import { CUSTOM_DIVIDER_ASSETS_STORAGE_KEY, CUSTOM_ICON_ASSETS_STORAGE_KEY, CUSTOM_IMAGE_ASSETS_STORAGE_KEY, CUSTOM_TEXTURE_ASSETS_STORAGE_KEY, type ProjectDocumentCustomAssets } from '@/features/project/client/package-document';
import { getGoogleDriveProjectBinding, loadGoogleDriveProjectLibrary, openGoogleDriveProject, type GoogleDriveProjectListResult } from '@/features/project/client/provider-google-drive';
import { getLocalProjectFolderStatus, listLocalProjectWorkBindings, type LocalProjectFolderStatus, type LocalProjectWorkBindingStatus } from '@/features/project/client/provider-local-folder';
import { getProjectAssetStorage, readTypedProjectAssetListFromStorage } from '@/features/project/client/assets';
import { hydrateProjectWorkspaceForScope, selectAllTemplates, useProjectStore } from '@/features/project/client/workspace';
import { type ProjectPersistenceScope } from '@/features/project/client/persistence-workspace';
import {
  getPersonalLibraryRoleLabel,
  loadPersonalLibrary,
  type PersonalLibraryListResult,
} from '@/features/personal-library/client';
import { ApiClientError, readApiError } from '@/infrastructure/http/clientResponses';
import type { BoundaryFailureKind } from '@/shared/boundaryFailure';

import {
  buildAccountLibraryItems,
  resolveAccountHomeLibraryProjection,
  type AccountLibraryItem,
  type AccountLibraryKind,
  type AccountLibrarySource,
} from '../model/accountLibrary';

interface StudioDocumentSummary {
  id: string;
  title: string;
  creationSource: string;
  revision: number;
  updatedAt: string;
  expiresAt: string;
}

export type AccountLibrarySourceId =
  | 'workspace'
  | 'published-library'
  | 'device-assets'
  | 'local-folder'
  | 'google-drive'
  | 'personal-library'
  | 'assistant-drafts';

export interface AccountLibrarySourceFailure {
  id: AccountLibrarySourceId;
  kind: BoundaryFailureKind;
  code: string;
  message: string;
  retryable: boolean;
  nextAction?: string;
  correlationId: string | null;
}

export const retainLastKnownLibrarySource = <Value,>(
  current: Value | null,
  refreshed: Value | null | undefined,
): Value | null => refreshed === undefined ? current : refreshed;

interface ScopedLibrarySource<Value> {
  scope: ProjectPersistenceScope;
  value: Value | null;
}

export const retainScopedLastKnownLibrarySource = <Value,>(
  current: ScopedLibrarySource<Value> | null,
  scope: ProjectPersistenceScope,
  refreshed: Value | null | undefined,
): ScopedLibrarySource<Value> => ({
  scope,
  value: retainLastKnownLibrarySource(current?.scope === scope ? current.value : null, refreshed),
});

interface UseAccountLibraryProjectionOptions {
  persistenceScope: ProjectPersistenceScope;
  isSignedIn: boolean;
}

const emptyCustomAssets = (): ProjectDocumentCustomAssets => ({
  [CUSTOM_TEXTURE_ASSETS_STORAGE_KEY]: [],
  [CUSTOM_DIVIDER_ASSETS_STORAGE_KEY]: [],
  [CUSTOM_ICON_ASSETS_STORAGE_KEY]: [],
  [CUSTOM_IMAGE_ASSETS_STORAGE_KEY]: [],
});

const sourceFailure = (
  id: AccountLibrarySourceId,
  error: unknown,
  fallback: string,
): AccountLibrarySourceFailure => {
  if (error instanceof ApiClientError) {
    return {
      id,
      kind: error.kind,
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      ...(error.nextAction ? { nextAction: error.nextAction } : {}),
      correlationId: error.correlationId,
    };
  }
  return {
    id,
    kind: 'unavailable',
    code: `${id.replaceAll('-', '_')}_unavailable`,
    message: error instanceof Error ? error.message : fallback,
    retryable: true,
    nextAction: 'Retry this source.',
    correlationId: null,
  };
};

const compareRecent = (left: AccountLibraryItem, right: AccountLibraryItem) => {
  const leftTime = Date.parse(left.updatedAt ?? '');
  const rightTime = Date.parse(right.updatedAt ?? '');
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) return rightTime - leftTime;
  if (Number.isFinite(leftTime)) return -1;
  if (Number.isFinite(rightTime)) return 1;
  return left.name.localeCompare(right.name);
};

export function useAccountLibraryProjection({
  persistenceScope,
  isSignedIn,
}: UseAccountLibraryProjectionOptions) {
  const router = useRouter();
  const { toast } = useToast();
  const [hydrated, setHydrated] = useState(false);
  const [hydrationFailure, setHydrationFailure] = useState<AccountLibrarySourceFailure | null>(null);
  const [customAssets, setCustomAssets] = useState<ProjectDocumentCustomAssets>(emptyCustomAssets);
  const [portableSetBytes, setPortableSetBytes] = useState<Record<string, number>>({});
  const [driveLibrarySource, setDriveLibrarySource] = useState<ScopedLibrarySource<GoogleDriveProjectListResult> | null>(null);
  const [driveBindingSource, setDriveBindingSource] = useState<ScopedLibrarySource<string> | null>(null);
  const [localFolder, setLocalFolder] = useState<LocalProjectFolderStatus | null>(null);
  const [localWorkFolders, setLocalWorkFolders] = useState<LocalProjectWorkBindingStatus[]>([]);
  const [personalLibrary, setPersonalLibrary] = useState<PersonalLibraryListResult | null>(null);
  const [workingDrafts, setWorkingDrafts] = useState<StudioDocumentSummary[]>([]);
  const [sourceFailures, setSourceFailures] = useState<AccountLibrarySourceFailure[]>([]);
  // Restoring local work does not complete the first source bootstrap.
  const [loadingSources, setLoadingSources] = useState(true);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<AccountLibraryKind | 'all'>('all');
  const [source, setSource] = useState<AccountLibrarySource | 'all'>('all');
  const [sort, setSort] = useState<'recent' | 'name' | 'kind'>('recent');
  const deferredQuery = useDeferredValue(query);
  const refreshGeneration = useRef(0);
  const driveLibrary = driveLibrarySource?.scope === persistenceScope ? driveLibrarySource.value : null;
  const driveBindingFileId = driveBindingSource?.scope === persistenceScope ? driveBindingSource.value : null;

  const cardSets = useProjectStore((state) => state.cardSets);
  const activeSetId = useProjectStore((state) => state.activeCardSet?.id ?? null);
  const storedCards = useProjectStore((state) => state.storedCards);
  const userTemplates = useProjectStore((state) => state.userTemplates);
  const setDefaultTemplatesFromFiles = useProjectStore((state) => state.setDefaultTemplatesFromFiles);
  useEffect(() => {
    let cancelled = false;
    setHydrated(false);
    setLoadingSources(true);
    setHydrationFailure(null);
    void hydrateProjectWorkspaceForScope(persistenceScope)
      .then(() => { if (!cancelled) setHydrated(true); })
      .catch((error) => {
        if (cancelled) return;
        setHydrationFailure(sourceFailure('workspace', error, 'This device workspace is unavailable.'));
        setHydrated(true);
      });
    return () => { cancelled = true; };
  }, [persistenceScope]);

  const refreshLibrarySources = useCallback(async () => {
    const generation = refreshGeneration.current + 1;
    refreshGeneration.current = generation;
    setLoadingSources(true);
    const failures: AccountLibrarySourceFailure[] = [];
    const assetStorage = getProjectAssetStorage();
    const deviceAssetsPromise = Promise.all([
      readTypedProjectAssetListFromStorage<CardAssetOption>(assetStorage, CUSTOM_TEXTURE_ASSETS_STORAGE_KEY),
      readTypedProjectAssetListFromStorage<CardAssetOption>(assetStorage, CUSTOM_DIVIDER_ASSETS_STORAGE_KEY),
      readTypedProjectAssetListFromStorage<CardAssetOption>(assetStorage, CUSTOM_ICON_ASSETS_STORAGE_KEY),
      readTypedProjectAssetListFromStorage<CardAssetOption>(assetStorage, CUSTOM_IMAGE_ASSETS_STORAGE_KEY),
    ]).catch((error) => {
      failures.push(sourceFailure('device-assets', error, 'Device assets are unavailable.'));
      return [[], [], [], []] as CardAssetOption[][];
    });
    const localFolderPromise = getLocalProjectFolderStatus().catch((error) => {
      failures.push(sourceFailure('local-folder', error, 'Local-folder status is unavailable.'));
      return null;
    });
    const localWorkFoldersPromise = listLocalProjectWorkBindings().catch((error) => {
      failures.push(sourceFailure('local-folder', error, 'Saved local-folder locations are unavailable.'));
      return [] as LocalProjectWorkBindingStatus[];
    });
    const studioBootstrapPromise = loadCardForgeStudioBootstrap().catch((error) => {
      failures.push(sourceFailure('published-library', error, 'CardForge previews are unavailable.'));
      return null;
    });
    const signedInSourcesPromise = isSignedIn
      ? Promise.all([
          loadGoogleDriveProjectLibrary().catch((error) => {
            failures.push(sourceFailure('google-drive', error, 'Google Drive projects are unavailable.'));
            return undefined;
          }),
          getGoogleDriveProjectBinding().catch((error) => {
            failures.push(sourceFailure('google-drive', error, 'Google Drive project attachment is unavailable.'));
            return undefined;
          }),
          loadPersonalLibrary().catch((error) => {
            failures.push(sourceFailure('personal-library', error, 'Connected assets are unavailable.'));
            return null;
          }),
          fetch('/api/studio-documents', { cache: 'no-store' })
            .then(async (response) => {
              if (!response.ok) throw await readApiError(response, 'Private working drafts are unavailable.');
              return await response.json() as { documents?: StudioDocumentSummary[] };
            })
            .catch((error) => {
              failures.push(sourceFailure('assistant-drafts', error, 'Private working drafts are unavailable.'));
              return null;
            }),
        ] as const)
      : Promise.resolve([null, null, null, null] as const);

    const [[textures, dividers, icons, images], folderResult, workFolderResults, bootstrapResult, [driveResult, bindingResult, assetsResult, draftsResult]] = await Promise.all([
      deviceAssetsPromise,
      localFolderPromise,
      localWorkFoldersPromise,
      studioBootstrapPromise,
      signedInSourcesPromise,
    ]);
    if (generation !== refreshGeneration.current) return;
    setCustomAssets({
      [CUSTOM_TEXTURE_ASSETS_STORAGE_KEY]: textures,
      [CUSTOM_DIVIDER_ASSETS_STORAGE_KEY]: dividers,
      [CUSTOM_ICON_ASSETS_STORAGE_KEY]: icons,
      [CUSTOM_IMAGE_ASSETS_STORAGE_KEY]: images,
    });
    setLocalFolder(folderResult);
    setLocalWorkFolders(workFolderResults);
    if (bootstrapResult) {
      setDefaultTemplatesFromFiles(
        bootstrapResult.templates.defaults,
        bootstrapResult.studioDefaults.defaultTemplateId,
      );
    }
    setDriveLibrarySource((current) => retainScopedLastKnownLibrarySource(current, persistenceScope, driveResult));
    setDriveBindingSource((current) => retainScopedLastKnownLibrarySource(
      current,
      persistenceScope,
      bindingResult === undefined ? undefined : bindingResult?.fileId ?? null,
    ));
    setPersonalLibrary(assetsResult);
    setWorkingDrafts(Array.isArray(draftsResult?.documents) ? draftsResult.documents : []);
    setSourceFailures(failures);
    setLoadingSources(false);
  }, [isSignedIn, persistenceScope, setDefaultTemplatesFromFiles]);

  useEffect(() => {
    if (!hydrated) return;
    void refreshLibrarySources();
  }, [hydrated, refreshLibrarySources]);

  useEffect(() => {
    if (!hydrated) return;
    const templates = selectAllTemplates(useProjectStore.getState());
    const next: Record<string, number> = {};
    cardSets.forEach((set) => {
      const transfer = createCardSetTransfer({ set, storedCards, templates, customAssets });
      next[set.id] = new Blob([JSON.stringify(transfer)]).size;
    });
    setPortableSetBytes(next);
  }, [cardSets, customAssets, hydrated, storedCards, userTemplates]);

  const cardCounts = useMemo(() => {
    const counts = new Map<string, number>();
    storedCards.forEach((card) => {
      if (card.setId) counts.set(card.setId, (counts.get(card.setId) ?? 0) + 1);
    });
    return counts;
  }, [storedCards]);

  const items = useMemo(() => buildAccountLibraryItems({
    localSets: cardSets.map((set) => ({
      id: set.id,
      name: set.name,
      cardCount: cardCounts.get(set.id) ?? 0,
      sizeBytes: portableSetBytes[set.id] ?? null,
      })),
    localTemplates: userTemplates.flatMap((template) => template.id ? [{ id: template.id, name: template.name }] : []),
    driveProjects: driveLibrary?.projects ?? [],
    driveBindingFileId,
    localWorkFolders: localWorkFolders.map((binding) => ({
      workId: binding.workId,
      folderName: binding.folderName,
      sourceRevision: binding.sourceRevision,
      lastSavedAt: binding.lastSavedAt,
      permission: binding.permission,
    })),
    personalAssets: (personalLibrary?.items ?? []).map((item) => ({
      id: item.id,
      displayName: item.displayName,
      roleLabel: getPersonalLibraryRoleLabel(item.role),
      byteSize: item.byteSize,
      providerRevision: item.providerRevision,
      providerModifiedAt: item.providerModifiedAt,
      providerWebViewLink: item.providerWebViewLink,
    })),
    workingDrafts,
  }), [cardCounts, cardSets, driveBindingFileId, driveLibrary?.projects, localWorkFolders, personalLibrary?.items, portableSetBytes, userTemplates, workingDrafts]);

  const visibleItems = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLocaleLowerCase();
    const filtered = items.filter((item) => {
      if (kind !== 'all' && item.kind !== kind) return false;
      if (source !== 'all' && !item.locations.some((location) => location.source === source)) return false;
      if (!normalizedQuery) return true;
      return [item.name, ...item.details, ...item.locations.map((location) => location.label)]
        .join(' ')
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    });
    return filtered.toSorted((left, right) => {
      if (sort === 'name') return left.name.localeCompare(right.name);
      if (sort === 'kind') return left.kind.localeCompare(right.kind) || left.name.localeCompare(right.name);
      return compareRecent(left, right);
    });
  }, [deferredQuery, items, kind, sort, source]);

  const sourceCounts = useMemo(() => {
    const counts = new Map<AccountLibrarySource, number>();
    items.forEach((item) => item.locations.forEach((location) => counts.set(location.source, (counts.get(location.source) ?? 0) + 1)));
    return counts;
  }, [items]);

  const home = useMemo(() => resolveAccountHomeLibraryProjection(items, activeSetId), [activeSetId, items]);

  const openItem = useCallback(async (item: AccountLibraryItem, returnTo: string = createLibraryReturnHref()) => {
    setBusyItemId(item.id);
    try {
      if (item.references.workingDraftId) {
        router.push(createStudioHref({ documentId: item.references.workingDraftId, revision: item.revision, returnTo }));
        return;
      }
      if (item.references.localSetId) {
        useProjectStore.getState().setActiveCardSetId(item.references.localSetId);
        router.push(createDeskReturnHref(`set:${item.references.localSetId}`));
        return;
      }
      if (item.references.localTemplateId) {
        const store = useProjectStore.getState();
        store.setTemplateEditorSelectedTemplateId(item.references.localTemplateId);
        store.setStudioView('template');
        const params = new URLSearchParams({ section: 'library', scope: 'personal', tool: 'design', artifact: item.references.localTemplateId });
        router.push(`/account?${params.toString()}`);
        return;
      }
      if (item.references.driveFileId) {
        const binding = await openGoogleDriveProject({ fileId: item.references.driveFileId, name: item.name });
        router.push(binding.workId ? createDeskReturnHref(`set:${binding.workId}`) : '/account');
      }
    } catch (error) {
      toast({
        title: 'Library item could not be opened',
        description: error instanceof Error ? error.message : 'CardForge could not open that library item.',
        variant: 'destructive',
      });
    } finally {
      setBusyItemId(null);
    }
  }, [router, toast]);

  return {
    items,
    visibleItems,
    featuredItem: home.featuredItem,
    recentItems: home.moreItems,
    sourceCounts,
    failures: [hydrationFailure, ...sourceFailures].filter((failure): failure is AccountLibrarySourceFailure => Boolean(failure)),
    isLoading: !hydrated || loadingSources,
    loadingSources,
    busyItemId,
    query,
    kind,
    source,
    sort,
    setQuery,
    setKind,
    setSource,
    setSort,
    openItem,
    refresh: () => { void refreshLibrarySources(); },
    driveConnection: driveLibrary?.connection ?? null,
    localFolderSupported: localFolder?.supported ?? false,
    router,
  };
}
