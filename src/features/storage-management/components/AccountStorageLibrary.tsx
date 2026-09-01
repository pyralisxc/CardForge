"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createDeskReturnHref } from '@/features/app-shell/client/navigation';
import { Database, HardDrive, Loader2, RefreshCw, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import type { CardAssetOption } from '@/domain/templates';
import {
  createCardSetTransfer,
  CUSTOM_DIVIDER_ASSETS_STORAGE_KEY,
  CUSTOM_ICON_ASSETS_STORAGE_KEY,
  CUSTOM_IMAGE_ASSETS_STORAGE_KEY,
  CUSTOM_TEXTURE_ASSETS_STORAGE_KEY,
  getBrowserStorageHealth,
  getProjectAssetStorage,
  hydrateProjectWorkspaceForScope,
  readTypedProjectAssetListFromStorage,
  selectAllTemplates,
  useProjectStore,
  type BrowserStorageHealth,
  type ProjectDocumentCustomAssets,
  type ProjectPersistenceScope,
} from '@/features/project/client';
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
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [hydrationError, setHydrationError] = useState<string | null>(null);
  const [deviceHealth, setDeviceHealth] = useState<BrowserStorageHealth | null>(null);
  const [customAssets, setCustomAssets] = useState<ProjectDocumentCustomAssets>(emptyCustomAssets);
  const [draftRefreshVersion, setDraftRefreshVersion] = useState(0);

  const cardSets = useProjectStore((state) => state.cardSets);
  const storedCards = useProjectStore((state) => state.storedCards);
  const defaultTemplates = useProjectStore((state) => state.defaultTemplates);
  const userTemplates = useProjectStore((state) => state.userTemplates);

  useEffect(() => {
    let cancelled = false;
    setHydrated(false);
    setHydrationError(null);
    void hydrateProjectWorkspaceForScope(persistenceScope)
      .then(() => { if (!cancelled) setHydrated(true); })
      .catch((error) => {
        if (cancelled) return;
        setHydrationError(error instanceof Error ? error.message : 'Unable to load this device workspace.');
        setHydrated(true);
      });
    return () => { cancelled = true; };
  }, [persistenceScope]);

  const refreshDeviceDetails = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    if (hydrated) void refreshDeviceDetails();
  }, [hydrated, refreshDeviceDetails]);

  const portableSetBytes = useMemo(() => {
    if (!hydrated) return {};
    const templates = selectAllTemplates({ defaultTemplates, userTemplates });
    const next: Record<string, number> = {};
    cardSets.forEach((set) => {
      const transfer = createCardSetTransfer({ set, storedCards, templates, customAssets });
      next[set.id] = new Blob([JSON.stringify(transfer)]).size;
    });
    return next;
  }, [cardSets, customAssets, defaultTemplates, hydrated, storedCards, userTemplates]);

  const cardCounts = useMemo(() => {
    const counts = new Map<string, number>();
    storedCards.forEach((card) => {
      if (card.setId) counts.set(card.setId, (counts.get(card.setId) ?? 0) + 1);
    });
    return counts;
  }, [storedCards]);
  const customAssetCount = useMemo(() => Object.values(customAssets).reduce(
    (total, assets) => total + assets.length,
    0,
  ), [customAssets]);
  const customAssetBytes = useMemo(() => new Blob([JSON.stringify(customAssets)]).size, [customAssets]);
  const showDevice = focus === 'overview' || focus === 'device';
  const showDrafts = focus === 'overview' || focus === 'drafts';

  const removeLocalSet = useCallback((setId: string) => {
    const state = useProjectStore.getState();
    const target = state.cardSets.find((set) => set.id === setId);
    if (!target) return;
    if (!state.deleteCardSet(setId)) return;
    toast({
      title: 'Set removed from this device',
      description: `“${target.name}” and its local cards were removed here. Shared Templates and assets were left alone.`,
    });
    void refreshDeviceDetails();
  }, [refreshDeviceDetails, toast]);

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
            detail={`${cardSets.length} set${cardSets.length === 1 ? '' : 's'} · ${storedCards.length} cards · ${userTemplates.length} personal Templates · ${customAssetCount} custom assets (${formatBytes(customAssetBytes)} serialized)`}
          />
          {hydrationError ? <p className="mt-4 border border-[#8b4c35] bg-[#2a130e] p-3 text-sm text-[#efb6a4]">{hydrationError}</p> : null}
          <div className="mt-6">
            <h3 className="font-serif text-xl text-[var(--cf-text-strong)]">On this device</h3>
            <p className="mt-1 text-xs leading-5 text-[var(--cf-text-subtle)]">Portable-size estimates can overlap because Templates and artwork may be shared by multiple Sets.</p>
            {!hydrated ? (
              <p className="mt-3 flex items-center gap-2 text-sm text-[var(--cf-text-muted)]"><Loader2 className="h-4 w-4 animate-spin" /> Loading this device workspace…</p>
            ) : (
              <div className="mt-3 divide-y divide-[var(--cf-border-subtle)] border-y border-[var(--cf-border-subtle)]">
                {cardSets.map((set) => (
                  <div key={set.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--cf-text-strong)]">{set.name}</p>
                      <p className="mt-1 text-xs text-[#bba57c]">{cardCounts.get(set.id) ?? 0} cards · {formatBytes(portableSetBytes[set.id])} portable estimate · device only</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => { useProjectStore.getState().setActiveCardSetId(set.id); router.push(createDeskReturnHref(`set:${set.id}`)); }}>Open</Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (window.confirm(`Remove “${set.name}” from this device? Its local cards will also be removed.`)) removeLocalSet(set.id);
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Remove from device
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div> : null}

        {showDrafts ? <AssistantDraftLibrary isSignedIn={isSignedIn} refreshVersion={draftRefreshVersion} /> : null}
      </div>
    </section>
  );
}
