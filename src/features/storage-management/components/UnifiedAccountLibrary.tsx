"use client";

import { useRouter } from 'next/navigation';
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { LibraryBig, Loader2, RefreshCw, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import type { CardAssetOption } from '@/domain/templates';
import {
  createCardSetTransfer,
  CUSTOM_DIVIDER_ASSETS_STORAGE_KEY,
  CUSTOM_ICON_ASSETS_STORAGE_KEY,
  CUSTOM_IMAGE_ASSETS_STORAGE_KEY,
  CUSTOM_TEXTURE_ASSETS_STORAGE_KEY,
  getGoogleDriveProjectBinding,
  getLocalProjectFolderStatus,
  getProjectAssetStorage,
  hydrateProjectWorkspaceForScope,
  loadGoogleDriveProjectLibrary,
  openGoogleDriveProject,
  readTypedProjectAssetListFromStorage,
  selectAllTemplates,
  useCloudSetActions,
  useProjectStore,
  type GoogleDriveProjectListResult,
  type LocalProjectFolderStatus,
  type ProjectDocumentCustomAssets,
  type ProjectPersistenceScope,
} from '@/features/project/client';
import {
  getPersonalLibraryRoleLabel,
  loadPersonalLibrary,
  type PersonalLibraryListResult,
} from '@/features/personal-library/client';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';
import {
  ACCOUNT_LIBRARY_KINDS,
  buildAccountLibraryItems,
  getAccountLibrarySourceLabel,
  type AccountLibraryItem,
  type AccountLibraryKind,
  type AccountLibrarySource,
} from '../model/accountLibrary';
import {
  AccountLibraryItemRow,
  AccountLibrarySourceBadge,
  accountLibraryKindLabels,
} from './AccountLibraryItemRow';

interface StudioDocumentSummary {
  id: string;
  title: string;
  creationSource: string;
  revision: number;
  updatedAt: string;
  expiresAt: string;
}

interface UnifiedAccountLibraryProps {
  persistenceScope: ProjectPersistenceScope;
  isSignedIn: boolean;
  cloudSetLimit: number;
}

const emptyCustomAssets = (): ProjectDocumentCustomAssets => ({
  [CUSTOM_TEXTURE_ASSETS_STORAGE_KEY]: [],
  [CUSTOM_DIVIDER_ASSETS_STORAGE_KEY]: [],
  [CUSTOM_ICON_ASSETS_STORAGE_KEY]: [],
  [CUSTOM_IMAGE_ASSETS_STORAGE_KEY]: [],
});

export function UnifiedAccountLibrary({
  persistenceScope,
  isSignedIn,
  cloudSetLimit,
}: UnifiedAccountLibraryProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [hydrated, setHydrated] = useState(false);
  const [hydrationProblem, setHydrationProblem] = useState<string | null>(null);
  const [customAssets, setCustomAssets] = useState<ProjectDocumentCustomAssets>(emptyCustomAssets);
  const [portableSetBytes, setPortableSetBytes] = useState<Record<string, number>>({});
  const [driveLibrary, setDriveLibrary] = useState<GoogleDriveProjectListResult | null>(null);
  const [driveBindingFileId, setDriveBindingFileId] = useState<string | null>(null);
  const [localFolder, setLocalFolder] = useState<LocalProjectFolderStatus | null>(null);
  const [personalLibrary, setPersonalLibrary] = useState<PersonalLibraryListResult | null>(null);
  const [workingDrafts, setWorkingDrafts] = useState<StudioDocumentSummary[]>([]);
  const [sourceProblems, setSourceProblems] = useState<string[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<AccountLibraryKind | 'all'>('all');
  const deferredQuery = useDeferredValue(query);

  const cardSets = useProjectStore((state) => state.cardSets);
  const storedCards = useProjectStore((state) => state.storedCards);
  const userTemplates = useProjectStore((state) => state.userTemplates);
  const {
    cloud,
    isLoadingCloudSets,
    loadSetFromCloud,
    refreshCloudSets,
  } = useCloudSetActions({ toast, enabled: isSignedIn });

  useEffect(() => {
    let cancelled = false;
    setHydrated(false);
    setHydrationProblem(null);
    void hydrateProjectWorkspaceForScope(persistenceScope)
      .then(() => { if (!cancelled) setHydrated(true); })
      .catch((error) => {
        if (cancelled) return;
        setHydrationProblem(error instanceof Error ? error.message : 'This device workspace is unavailable.');
        setHydrated(true);
      });
    return () => { cancelled = true; };
  }, [persistenceScope]);

  const refreshLibrarySources = useCallback(async () => {
    setLoadingSources(true);
    const problems: string[] = [];
    const assetStorage = getProjectAssetStorage();
    const deviceAssetsPromise = Promise.all([
      readTypedProjectAssetListFromStorage<CardAssetOption>(assetStorage, CUSTOM_TEXTURE_ASSETS_STORAGE_KEY),
      readTypedProjectAssetListFromStorage<CardAssetOption>(assetStorage, CUSTOM_DIVIDER_ASSETS_STORAGE_KEY),
      readTypedProjectAssetListFromStorage<CardAssetOption>(assetStorage, CUSTOM_ICON_ASSETS_STORAGE_KEY),
      readTypedProjectAssetListFromStorage<CardAssetOption>(assetStorage, CUSTOM_IMAGE_ASSETS_STORAGE_KEY),
    ]).catch((error) => {
      problems.push(error instanceof Error ? error.message : 'Device assets are unavailable.');
      return [[], [], [], []] as CardAssetOption[][];
    });
    const localFolderPromise = getLocalProjectFolderStatus().catch((error) => {
      problems.push(error instanceof Error ? error.message : 'Local-folder status is unavailable.');
      return null;
    });

    const signedInSourcesPromise = isSignedIn
      ? Promise.all([
          loadGoogleDriveProjectLibrary().catch((error) => {
            problems.push(error instanceof Error ? error.message : 'Google Drive projects are unavailable.');
            return null;
          }),
          getGoogleDriveProjectBinding().catch(() => null),
          loadPersonalLibrary().catch((error) => {
            problems.push(error instanceof Error ? error.message : 'Connected assets are unavailable.');
            return null;
          }),
          fetch('/api/studio-documents', { cache: 'no-store' })
            .then(async (response) => {
              if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Private working drafts are unavailable.'));
              return await response.json() as { documents?: StudioDocumentSummary[] };
            })
            .catch((error) => {
              problems.push(error instanceof Error ? error.message : 'Private working drafts are unavailable.');
              return null;
            }),
        ] as const)
      : Promise.resolve([null, null, null, null] as const);

    const [[textures, dividers, icons, images], folderResult, [driveResult, bindingResult, assetsResult, draftsResult]] = await Promise.all([
      deviceAssetsPromise,
      localFolderPromise,
      signedInSourcesPromise,
    ]);
    setCustomAssets({
      [CUSTOM_TEXTURE_ASSETS_STORAGE_KEY]: textures,
      [CUSTOM_DIVIDER_ASSETS_STORAGE_KEY]: dividers,
      [CUSTOM_ICON_ASSETS_STORAGE_KEY]: icons,
      [CUSTOM_IMAGE_ASSETS_STORAGE_KEY]: images,
    });
    setLocalFolder(folderResult);
    setDriveLibrary(driveResult);
    setDriveBindingFileId(bindingResult?.fileId ?? null);
    setPersonalLibrary(assetsResult);
    setWorkingDrafts(Array.isArray(draftsResult?.documents) ? draftsResult.documents : []);
    setSourceProblems(problems);
    setLoadingSources(false);
  }, [isSignedIn]);

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
    cloudSets: (cloud?.sets ?? []).map((set) => ({
      setId: set.setId,
      name: set.name,
      cardCount: set.cardCount,
      revision: set.revision,
      storageBytes: set.storageBytes,
      updatedAt: set.updatedAt,
    })),
    driveProjects: driveLibrary?.projects ?? [],
    driveBindingFileId,
    localFolder: localFolder?.binding ? {
      folderName: localFolder.binding.folderName,
      sourceRevision: localFolder.binding.sourceRevision,
      lastSavedAt: localFolder.binding.lastSavedAt,
      permission: localFolder.permission,
    } : null,
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
  }), [cardCounts, cardSets, cloud?.sets, driveBindingFileId, driveLibrary?.projects, localFolder, personalLibrary?.items, portableSetBytes, workingDrafts]);

  const visibleItems = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLocaleLowerCase();
    return items.filter((item) => {
      if (kind !== 'all' && item.kind !== kind) return false;
      if (!normalizedQuery) return true;
      return [item.name, ...item.details, ...item.locations.map((location) => location.label)]
        .join(' ')
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    });
  }, [deferredQuery, items, kind]);

  const sourceCounts = useMemo(() => {
    const counts = new Map<AccountLibrarySource, number>();
    items.forEach((item) => item.locations.forEach((location) => counts.set(location.source, (counts.get(location.source) ?? 0) + 1)));
    return counts;
  }, [items]);

  const openItem = useCallback(async (item: AccountLibraryItem) => {
    setBusyItemId(item.id);
    try {
      if (item.references.localSetId) {
        useProjectStore.getState().setActiveCardSetId(item.references.localSetId);
        router.push('/studio');
        return;
      }
      if (item.references.cloudSetId) {
        await loadSetFromCloud(item.references.cloudSetId);
        router.push('/studio');
        return;
      }
      if (item.references.driveFileId) {
        await openGoogleDriveProject({ fileId: item.references.driveFileId, name: item.name });
        router.push('/studio');
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
  }, [loadSetFromCloud, router, toast]);

  const isLoading = !hydrated || loadingSources || isLoadingCloudSets;
  const cloudLimit = cloud?.limit ?? cloudSetLimit;

  return (
    <div className="border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[var(--cf-accent-strong)]">
            <LibraryBig className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em]">Library</span>
          </div>
          <h2 className="mt-2 font-serif text-2xl text-[var(--cf-text-strong)]">Everything you can continue, reuse, or recover</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--cf-text-muted)]">
            One inventory across this device, CardForge Cloud, Google Drive, local project folders, and private working drafts. Storage remains with the source named on each item.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isLoading}
          onClick={() => { void refreshLibrarySources(); void refreshCloudSets(); }}
        >
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2" aria-label="Library sources">
        {(['device', 'cardforge-cloud', 'google-drive', 'local-folder', 'assistant-draft'] as const).map((source) => (
          <AccountLibrarySourceBadge key={source} source={source}>
            {getAccountLibrarySourceLabel(source)} · {sourceCounts.get(source) ?? 0}
          </AccountLibrarySourceBadge>
        ))}
        <span className="border border-[var(--cf-border-subtle)] px-2.5 py-1 text-xs text-[var(--cf-text-muted)]">
          Cloud slots {cloud?.used ?? 0} / {cloudLimit}
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <label className="relative block">
          <span className="sr-only">Search your CardForge library</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cf-text-subtle)]" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search names, sources, and details" className="pl-9" />
        </label>
        <div className="flex flex-wrap gap-1" aria-label="Filter library by type">
          <Button type="button" size="sm" variant={kind === 'all' ? 'default' : 'outline'} onClick={() => setKind('all')}>All</Button>
          {ACCOUNT_LIBRARY_KINDS.map((option) => (
            <Button key={option} type="button" size="sm" variant={kind === option ? 'default' : 'outline'} onClick={() => setKind(option)}>
              {accountLibraryKindLabels[option]}
            </Button>
          ))}
        </div>
      </div>

      {hydrationProblem || sourceProblems.length > 0 ? (
        <div className="mt-4 border border-[#8b4c35] bg-[#2a130e] p-3 text-sm text-[#efb6a4]" role="status">
          <p className="font-semibold">Some library sources are unavailable</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">{[hydrationProblem, ...sourceProblems].filter((problem): problem is string => Boolean(problem)).map((problem) => <li key={problem}>{problem}</li>)}</ul>
        </div>
      ) : null}

      {isLoading && items.length === 0 ? (
        <p className="mt-5 flex items-center gap-2 text-sm text-[var(--cf-text-muted)]"><Loader2 className="h-4 w-4 animate-spin" /> Loading your library…</p>
      ) : visibleItems.length === 0 ? (
        <p className="mt-5 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface)] p-4 text-sm text-[var(--cf-text-muted)]">
          {items.length === 0 ? 'Your library is ready for its first set, project, asset, or working draft.' : 'No library items match this filter.'}
        </p>
      ) : (
        <div className="mt-5 space-y-2">
          {visibleItems.map((item) => (
            <AccountLibraryItemRow
              key={item.id}
              item={item}
              busy={busyItemId === item.id}
              anyItemBusy={busyItemId !== null}
              onOpen={openItem}
            />
          ))}
        </div>
      )}
    </div>
  );
}
