"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Cloud,
  CloudDownload,
  CloudUpload,
  Database,
  HardDrive,
  Loader2,
  RefreshCw,
  Trash2,
} from 'lucide-react';

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
  MAX_CLOUD_SET_BYTES,
  readTypedProjectAssetListFromStorage,
  selectAllTemplates,
  useCloudSetActions,
  useProjectStore,
  type BrowserStorageHealth,
  type ProjectDocumentCustomAssets,
  type ProjectPersistenceScope,
} from '@/features/project/client';
import { AssistantDraftLibrary } from './AssistantDraftLibrary';

interface AccountStorageLibraryProps {
  persistenceScope: ProjectPersistenceScope;
  isSignedIn: boolean;
  cloudSetLimit: number;
  embedded?: boolean;
  focus?: 'overview' | 'device' | 'cloud' | 'drafts';
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

function StorageBar({ ratio }: { ratio: number | null }) {
  const percent = ratio === null ? 0 : Math.max(0, Math.min(100, ratio * 100));
  return (
    <div className="h-1 overflow-hidden bg-[#332719]" aria-hidden="true">
      <div className="h-full bg-[#dca747] transition-[width]" style={{ width: `${percent}%` }} />
    </div>
  );
}

function StorageMetric({
  icon,
  eyebrow,
  title,
  detail,
  ratio,
  footer,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  detail: string;
  ratio: number | null;
  footer: string;
}) {
  return (
    <div className="border-y border-[var(--cf-border-subtle)] py-4">
      <div className="flex items-center gap-2 text-[var(--cf-accent-strong)]">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-[0.16em]">{eyebrow}</span>
      </div>
      <p className="mt-2 font-serif text-xl text-[var(--cf-text-strong)]">{title}</p>
      <p className="mt-1 text-sm text-[var(--cf-text-muted)]">{detail}</p>
      <div className="mt-4"><StorageBar ratio={ratio} /></div>
      <p className="mt-2 text-xs text-[var(--cf-text-subtle)]">{footer}</p>
    </div>
  );
}

export function AccountStorageLibrary({
  persistenceScope,
  isSignedIn,
  cloudSetLimit,
  embedded = false,
  focus = 'overview',
}: AccountStorageLibraryProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [hydrationError, setHydrationError] = useState<string | null>(null);
  const [deviceHealth, setDeviceHealth] = useState<BrowserStorageHealth | null>(null);
  const [customAssets, setCustomAssets] = useState<ProjectDocumentCustomAssets>(emptyCustomAssets);
  const [portableSetBytes, setPortableSetBytes] = useState<Record<string, number>>({});
  const [draftRefreshVersion, setDraftRefreshVersion] = useState(0);

  const cardSets = useProjectStore((state) => state.cardSets);
  const storedCards = useProjectStore((state) => state.storedCards);
  const userTemplates = useProjectStore((state) => state.userTemplates);

  const {
    cloud,
    cloudBySetId,
    deletingSetId,
    isLoadingCloudSets,
    loadingSetId,
    loadSetFromCloud,
    refreshCloudSets,
    removeCloudSet,
    saveSetToCloud,
    savingSetId,
  } = useCloudSetActions({ toast, enabled: isSignedIn });

  useEffect(() => {
    let cancelled = false;
    setHydrated(false);
    setHydrationError(null);
    void hydrateProjectWorkspaceForScope(persistenceScope)
      .then(() => { if (!cancelled) setHydrated(true); })
      .catch((error) => {
        if (!cancelled) {
          setHydrationError(error instanceof Error ? error.message : 'Unable to load this device workspace.');
          setHydrated(true);
        }
      });
    return () => { cancelled = true; };
  }, [persistenceScope]);

  const refreshDeviceDetails = useCallback(async () => {
    const [health, textures, dividers, icons, images] = await Promise.all([
      getBrowserStorageHealth(),
      readTypedProjectAssetListFromStorage<CardAssetOption>(getProjectAssetStorage(), CUSTOM_TEXTURE_ASSETS_STORAGE_KEY),
      readTypedProjectAssetListFromStorage<CardAssetOption>(getProjectAssetStorage(), CUSTOM_DIVIDER_ASSETS_STORAGE_KEY),
      readTypedProjectAssetListFromStorage<CardAssetOption>(getProjectAssetStorage(), CUSTOM_ICON_ASSETS_STORAGE_KEY),
      readTypedProjectAssetListFromStorage<CardAssetOption>(getProjectAssetStorage(), CUSTOM_IMAGE_ASSETS_STORAGE_KEY),
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
    if (!hydrated) return;
    void refreshDeviceDetails();
  }, [hydrated, refreshDeviceDetails]);

  useEffect(() => {
    if (!hydrated) return;
    const state = useProjectStore.getState();
    const templates = selectAllTemplates(state);
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

  const customAssetCount = useMemo(() => Object.values(customAssets).reduce(
    (total, assets) => total + assets.length,
    0,
  ), [customAssets]);
  const customAssetBytes = useMemo(() => new Blob([JSON.stringify(customAssets)]).size, [customAssets]);
  const cloudUsed = cloud?.used ?? 0;
  const cloudLimit = cloud?.limit ?? cloudSetLimit;
  const cloudBytes = useMemo(() => (cloud?.sets ?? []).reduce((total, set) => total + set.storageBytes, 0), [cloud?.sets]);
  const localSetIds = useMemo(() => new Set(cardSets.map((set) => set.id)), [cardSets]);
  const showDevice = focus === 'overview' || focus === 'device';
  const showCloud = focus === 'overview' || focus === 'cloud';
  const showDrafts = focus === 'overview' || focus === 'drafts';

  const removeLocalSet = useCallback((setId: string) => {
    const state = useProjectStore.getState();
    const target = state.cardSets.find((set) => set.id === setId);
    if (!target) return;
    const remainingCards = state.storedCards.filter((card) => card.setId !== setId);
    let remainingSets = state.cardSets.filter((set) => set.id !== setId);
    let nextActive = state.activeCardSet;

    if (remainingSets.length === 0) {
      const replacementId = state.createCardSet();
      const afterCreate = useProjectStore.getState();
      const replacement = afterCreate.cardSets.find((set) => set.id === replacementId);
      if (!replacement) return;
      remainingSets = [replacement];
      nextActive = replacement;
    } else if (state.activeCardSet.id === setId) {
      nextActive = remainingSets[0]!;
    }

    const editingStillExists = remainingCards.some((card) => card.uniqueId === state.editingCardUniqueId);
    useProjectStore.setState({
      cardSets: remainingSets,
      activeCardSet: nextActive,
      storedCards: remainingCards,
      singleCardGeneratorSelectedTemplateId: nextActive.frontTemplateId,
      editingCardUniqueId: editingStillExists ? state.editingCardUniqueId : null,
      isEditDialogOpen: editingStillExists ? state.isEditDialogOpen : false,
    });
    toast({
      title: 'Set removed from this device',
      description: `“${target.name}” and its local cards were removed here. Shared Templates/assets and any cloud backup were left alone.`,
    });
    void refreshDeviceDetails();
  }, [refreshDeviceDetails, toast]);

  const openLocalSet = useCallback((setId: string) => {
    useProjectStore.getState().setActiveCardSetId(setId);
    router.push('/studio');
  }, [router]);

  return (
    <section className={embedded ? undefined : 'mx-auto max-w-4xl px-4 pb-8 md:px-6'} aria-labelledby={embedded ? undefined : 'storage-library-title'}>
      <div className={embedded ? 'py-1' : 'border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-4 md:p-5'}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          {!embedded ? (
            <div>
              <div className="flex items-center gap-2 text-[var(--cf-accent-strong)]">
                <Database className="h-5 w-5" />
                <span className="text-xs font-semibold uppercase tracking-[0.18em]">CardForge-managed storage</span>
              </div>
              <h2 id="storage-library-title" className="mt-2 font-serif text-2xl text-[var(--cf-text-strong)]">Device, cloud backups, and private drafts</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--cf-text-muted)]">
                Inspect and manage CardForge-owned storage locations. The Library above is the combined inventory; removal here affects only the location named by the action.
              </p>
            </div>
          ) : <span className="text-xs leading-5 text-[var(--cf-text-muted)]">Refresh the device and cloud inventory before managing a copy.</span>}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-[#70532e] bg-transparent text-[var(--cf-accent-text)] hover:bg-[var(--cf-surface-hover)]"
            onClick={() => { void refreshDeviceDetails(); void refreshCloudSets(); setDraftRefreshVersion((version) => version + 1); }}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>

        {showDevice || showCloud ? <div className={`${embedded ? 'mt-3' : 'mt-5'} grid gap-x-6 ${showDevice && showCloud ? 'md:grid-cols-2' : ''}`}>
          {showDevice ? <StorageMetric
            icon={<HardDrive className="h-4 w-4" />}
            eyebrow="This device"
            title={deviceHealth?.usageBytes !== null && deviceHealth?.usageBytes !== undefined ? `${formatBytes(deviceHealth.usageBytes)} used` : 'Browser storage'}
            detail={deviceHealth?.quotaBytes ? `of ${formatBytes(deviceHealth.quotaBytes)} available to this site` : 'Your local workspace remains browser-owned.'}
            ratio={deviceHealth?.usageRatio ?? null}
            footer={`${cardSets.length} set${cardSets.length === 1 ? '' : 's'} · ${storedCards.length} cards · ${userTemplates.length} personal Templates · ${customAssetCount} custom assets (${formatBytes(customAssetBytes)} serialized)`}
          /> : null}
          {showCloud ? <StorageMetric
            icon={<Cloud className="h-4 w-4" />}
            eyebrow="CardForge cloud"
            title={isSignedIn ? `${cloudUsed} / ${cloudLimit} set slots` : 'Sign in to back up sets'}
            detail={isSignedIn ? `${formatBytes(cloudBytes)} stored across your cloud sets` : 'Cloud saves are account-owned and available across devices.'}
            ratio={isSignedIn && cloudLimit > 0 ? cloudUsed / cloudLimit : null}
            footer={`Each cloud set can use up to ${Math.round(MAX_CLOUD_SET_BYTES / 1024 / 1024)} MB. Slot limits are separate from byte usage.`}
          /> : null}
        </div> : null}

        {hydrationError ? <p className="mt-4 border border-[#8b4c35] bg-[#2a130e] p-3 text-sm text-[#efb6a4]">{hydrationError}</p> : null}

        {showDevice ? <div className="mt-6">
          <h3 className="font-serif text-xl text-[var(--cf-text-strong)]">On this device</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--cf-text-subtle)]">Portable-size estimates can overlap because Templates and artwork may be shared by multiple sets.</p>
          {!hydrated ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-[var(--cf-text-muted)]"><Loader2 className="h-4 w-4 animate-spin" /> Loading this device workspace…</p>
          ) : (
            <div className="mt-3 divide-y divide-[var(--cf-border-subtle)] border-y border-[var(--cf-border-subtle)]">
              {cardSets.map((set) => {
                const cloudSet = cloudBySetId.get(set.id);
                const canBackUp = Boolean(cloudSet) || cloudUsed < cloudLimit;
                return (
                  <div key={set.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--cf-text-strong)]">{set.name}</p>
                      <p className="mt-1 text-xs text-[#bba57c]">
                        {cardCounts.get(set.id) ?? 0} cards · {formatBytes(portableSetBytes[set.id])} portable estimate · {cloudSet ? 'device + cloud' : 'device only'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => openLocalSet(set.id)}>Open</Button>
                      {isSignedIn ? (
                        <Button size="sm" variant="outline" disabled={Boolean(savingSetId)} onClick={() => void saveSetToCloud(set.id)}>
                          {savingSetId === set.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CloudUpload className="mr-2 h-4 w-4" />}
                          {cloudSet ? 'Update cloud' : canBackUp ? 'Back up' : 'Slots full — review'}
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (window.confirm(`Remove “${set.name}” from this device? Its local cards will be removed. Shared Templates/assets and any cloud backup will remain.`)) removeLocalSet(set.id);
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Remove from device
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div> : null}

        {showCloud ? <div className="mt-6 border-t border-[var(--cf-border-subtle)] pt-5">
          <h3 className="font-serif text-xl text-[var(--cf-text-strong)]">Cloud sets</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--cf-text-subtle)]">Removing a cloud backup never deletes a copy already stored on a device.</p>
          {!isSignedIn ? (
            <p className="mt-3 text-sm text-[var(--cf-text-muted)]">Sign in to see and manage account cloud saves.</p>
          ) : isLoadingCloudSets ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-[var(--cf-text-muted)]"><Loader2 className="h-4 w-4 animate-spin" /> Loading cloud sets…</p>
          ) : cloud?.sets.length ? (
            <div className="mt-3 divide-y divide-[var(--cf-border-subtle)] border-y border-[var(--cf-border-subtle)]">
              {cloud.sets.map((set) => (
                <div key={set.setId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--cf-text-strong)]">{set.name}</p>
                    <p className="mt-1 text-xs text-[#bba57c]">{set.cardCount} cards · revision {set.revision} · {formatBytes(set.storageBytes)} · {localSetIds.has(set.setId) ? 'also on this device' : 'cloud only on this device'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" disabled={Boolean(loadingSetId)} onClick={() => void loadSetFromCloud(set.setId)}>
                      {loadingSetId === set.setId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CloudDownload className="mr-2 h-4 w-4" />}
                      {localSetIds.has(set.setId) ? 'Restore / merge' : 'Load to device'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={Boolean(deletingSetId)}
                      onClick={() => {
                        if (window.confirm(`Remove the cloud backup for “${set.name}”? Copies already on your devices will remain.`)) void removeCloudSet(set.setId);
                      }}
                    >
                      {deletingSetId === set.setId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                      Remove cloud
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="mt-3 text-sm text-[var(--cf-text-muted)]">No cloud-saved sets yet.</p>}
        </div> : null}

        {showDrafts ? <AssistantDraftLibrary isSignedIn={isSignedIn} refreshVersion={draftRefreshVersion} /> : null}
      </div>
    </section>
  );
}
