"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Database, HardDrive, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import type { CardAssetOption } from '@/domain/templates';
import { CUSTOM_DIVIDER_ASSETS_STORAGE_KEY, CUSTOM_ICON_ASSETS_STORAGE_KEY, CUSTOM_IMAGE_ASSETS_STORAGE_KEY, CUSTOM_TEXTURE_ASSETS_STORAGE_KEY, type ProjectDocumentCustomAssets } from '@/features/project/client/package-document';
import { getBrowserStorageHealth, type BrowserStorageHealth } from '@/features/project/client/persistence-storage';
import { type ProjectPersistenceScope } from '@/features/project/client/persistence-workspace';
import { getProjectAssetStorage, readTypedProjectAssetListFromStorage } from '@/features/project/client/assets';
import { hydrateProjectLibraryWorkspaceForScope, useProjectLibraryWorkspace } from '@/features/project/client/libraryWorkspace';
import { AssistantDraftLibrary } from './AssistantDraftLibrary';

interface AccountStorageLibraryProps {
  persistenceScope: ProjectPersistenceScope;
  isSignedIn: boolean;
  embedded?: boolean;
  focus?: 'overview' | 'device' | 'drafts';
}

const emptyCustomAssets = (): ProjectDocumentCustomAssets => ({
  [CUSTOM_TEXTURE_ASSETS_STORAGE_KEY]: [],
  [CUSTOM_DIVIDER_ASSETS_STORAGE_KEY]: [],
  [CUSTOM_ICON_ASSETS_STORAGE_KEY]: [],
  [CUSTOM_IMAGE_ASSETS_STORAGE_KEY]: [],
});

const formatBytes = (bytes: number | null | undefined) => {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return 'Unavailable';
  if (bytes < 1024) return `${Math.max(0, Math.round(bytes))} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
};

function StorageMetric({ health, detail }: { health: BrowserStorageHealth | null; detail: string }) {
  const ratio = health?.usageRatio ?? null;
  const percent = ratio === null ? 0 : Math.max(0, Math.min(100, ratio * 100));
  return (
    <div className="border-y border-[var(--cf-border-subtle)] py-4">
      <div className="flex items-center gap-2 text-[var(--cf-accent-strong)]">
        <HardDrive className="h-4 w-4" />
        <span className="text-xs font-semibold uppercase tracking-[0.16em]">This device</span>
      </div>
      <p className="mt-2 font-serif text-xl text-[var(--cf-text-strong)]">
        {health?.usageBytes !== null && health?.usageBytes !== undefined ? `${formatBytes(health.usageBytes)} used` : 'Browser storage'}
      </p>
      <p className="mt-1 text-sm text-[var(--cf-text-muted)]">
        {health?.quotaBytes ? `of ${formatBytes(health.quotaBytes)} available to this site` : 'Your local workspace remains browser-owned.'}
      </p>
      <div className="mt-4 h-1 overflow-hidden bg-[#332719]" aria-hidden="true">
        <div className="h-full bg-[#dca747] transition-[width]" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-xs text-[var(--cf-text-subtle)]">{detail}</p>
    </div>
  );
}

export function AccountStorageLibrary({
  persistenceScope,
  isSignedIn,
  embedded = false,
  focus = 'overview',
}: AccountStorageLibraryProps) {
  const { toast } = useToast();
  const [hydrated, setHydrated] = useState(false);
  const [hydrationError, setHydrationError] = useState<string | null>(null);
  const [deviceHealth, setDeviceHealth] = useState<BrowserStorageHealth | null>(null);
  const [customAssets, setCustomAssets] = useState<ProjectDocumentCustomAssets>(emptyCustomAssets);
  const [draftRefreshVersion, setDraftRefreshVersion] = useState(0);

  const projectWorkspace = useProjectLibraryWorkspace();
  const { cardSets, storedCards, userTemplates } = projectWorkspace;

  useEffect(() => {
    let cancelled = false;
    setHydrated(false);
    setHydrationError(null);
    void hydrateProjectLibraryWorkspaceForScope(persistenceScope)
      .then(() => { if (!cancelled) setHydrated(true); })
      .catch((error) => {
        if (cancelled) return;
        setHydrationError(error instanceof Error ? error.message : 'Unable to load this device workspace.');
        setHydrated(true);
      });
    return () => { cancelled = true; };
  }, [persistenceScope]);

  const refreshDeviceDetails = useCallback(async () => {
    try {
      const storage = getProjectAssetStorage();
      const [health, textures, dividers, icons, images] = await Promise.all([
        getBrowserStorageHealth(),
        readTypedProjectAssetListFromStorage<CardAssetOption>(storage, CUSTOM_TEXTURE_ASSETS_STORAGE_KEY),
        readTypedProjectAssetListFromStorage<CardAssetOption>(storage, CUSTOM_DIVIDER_ASSETS_STORAGE_KEY),
        readTypedProjectAssetListFromStorage<CardAssetOption>(storage, CUSTOM_ICON_ASSETS_STORAGE_KEY),
        readTypedProjectAssetListFromStorage<CardAssetOption>(storage, CUSTOM_IMAGE_ASSETS_STORAGE_KEY),
      ]);
      setDeviceHealth(health);
      setCustomAssets({
        [CUSTOM_TEXTURE_ASSETS_STORAGE_KEY]: textures,
        [CUSTOM_DIVIDER_ASSETS_STORAGE_KEY]: dividers,
        [CUSTOM_ICON_ASSETS_STORAGE_KEY]: icons,
        [CUSTOM_IMAGE_ASSETS_STORAGE_KEY]: images,
      });
    } catch (error) {
      toast({ title: 'Local library unavailable', description: error instanceof Error ? error.message : 'Your saved artwork could not be read. Try Refresh again.', variant: 'destructive' });
    }
  }, [toast]);

  useEffect(() => {
    if (hydrated) void refreshDeviceDetails();
  }, [hydrated, refreshDeviceDetails]);

  const customAssetCount = useMemo(() => Object.values(customAssets).reduce(
    (total, assets) => total + assets.length,
    0,
  ), [customAssets]);
  const customAssetBytes = useMemo(() => new Blob([JSON.stringify(customAssets)]).size, [customAssets]);
  const showDevice = focus === 'overview' || focus === 'device';
  const showDrafts = focus === 'overview' || focus === 'drafts';

  return (
    <section className={embedded ? undefined : 'mx-auto max-w-4xl px-4 pb-8 md:px-6'} aria-labelledby={embedded ? undefined : 'storage-library-title'}>
      <div className={embedded ? 'py-1' : 'border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-4 md:p-5'}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          {!embedded ? (
            <div>
              <div className="flex items-center gap-2 text-[var(--cf-accent-strong)]">
                <Database className="h-5 w-5" />
                <span className="text-xs font-semibold uppercase tracking-[0.18em]">CardForge workspace storage</span>
              </div>
              <h2 id="storage-library-title" className="mt-2 font-serif text-2xl text-[var(--cf-text-strong)]">This device and temporary working drafts</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--cf-text-muted)]">Inspect the local workspace or manage temporary AI work. Durable provider projects remain with their named provider.</p>
            </div>
          ) : <span className="text-xs leading-5 text-[var(--cf-text-muted)]">Refresh this location before managing a local copy.</span>}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-[#70532e] bg-transparent text-[var(--cf-accent-text)] hover:bg-[var(--cf-surface-hover)]"
            onClick={() => { void refreshDeviceDetails(); setDraftRefreshVersion((version) => version + 1); }}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>

        {showDevice ? <div className={embedded ? 'mt-3' : 'mt-5'}>
          <StorageMetric
            health={deviceHealth}
            detail={`${cardSets.length} set${cardSets.length === 1 ? '' : 's'} · ${storedCards.length} card${storedCards.length === 1 ? '' : 's'} · ${userTemplates.length} personal Template${userTemplates.length === 1 ? '' : 's'} · ${customAssetCount} custom asset${customAssetCount === 1 ? '' : 's'} (${formatBytes(customAssetBytes)} serialized)`}
          />
          {hydrationError ? <p className="mt-4 border border-[#8b4c35] bg-[#2a130e] p-3 text-sm text-[#efb6a4]">{hydrationError}</p> : null}
          <p className="mt-4 text-sm text-[var(--cf-text-muted)]">Open or remove individual Sets from Desk or Library.</p>
        </div> : null}

        {showDrafts ? <AssistantDraftLibrary isSignedIn={isSignedIn} refreshVersion={draftRefreshVersion} /> : null}
      </div>
    </section>
  );
}
