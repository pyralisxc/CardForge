"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Cloud,
  CloudDownload,
  CloudUpload,
  Database,
  ExternalLink,
  HardDrive,
  Loader2,
  RefreshCw,
  Sparkles,
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
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';

interface StudioDocumentSummary {
  id: string;
  title: string;
  creationSource: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

interface AccountStorageLibraryProps {
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

const formatBytes = (bytes: number | null | undefined) => {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return 'Unavailable';
  if (bytes < 1024) return `${Math.max(0, Math.round(bytes))} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

function StorageBar({ ratio }: { ratio: number | null }) {
  const percent = ratio === null ? 0 : Math.max(0, Math.min(100, ratio * 100));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[#332719]" aria-hidden="true">
      <div className="h-full rounded-full bg-[#dca747] transition-[width]" style={{ width: `${percent}%` }} />
    </div>
  );
}

function StorageSummaryCard({
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
    <div className="border border-[#5f4526] bg-[#15100a] p-4">
      <div className="flex items-center gap-2 text-[#e2aa4a]">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-[0.16em]">{eyebrow}</span>
      </div>
      <p className="mt-3 font-serif text-2xl text-[#fff1c7]">{title}</p>
      <p className="mt-1 text-sm text-[#cbb58b]">{detail}</p>
      <div className="mt-4"><StorageBar ratio={ratio} /></div>
      <p className="mt-2 text-xs text-[#9f8a66]">{footer}</p>
    </div>
  );
}

export function AccountStorageLibrary({
  persistenceScope,
  isSignedIn,
  cloudSetLimit,
}: AccountStorageLibraryProps) {
  const { toast } = useToast();
  const [hydrated, setHydrated] = useState(false);
  const [hydrationError, setHydrationError] = useState<string | null>(null);
  const [deviceHealth, setDeviceHealth] = useState<BrowserStorageHealth | null>(null);
  const [customAssets, setCustomAssets] = useState<ProjectDocumentCustomAssets>(emptyCustomAssets);
  const [portableSetBytes, setPortableSetBytes] = useState<Record<string, number>>({});
  const [studioDocuments, setStudioDocuments] = useState<StudioDocumentSummary[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);

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

  const refreshDocuments = useCallback(async () => {
    if (!isSignedIn) {
      setStudioDocuments([]);
      return;
    }
    setLoadingDocuments(true);
    try {
      const response = await fetch('/api/studio-documents', { cache: 'no-store' });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to load private working drafts.'));
      const payload = await response.json() as { documents?: StudioDocumentSummary[] };
      setStudioDocuments(Array.isArray(payload.documents) ? payload.documents : []);
    } catch (error) {
      toast({
        title: 'Working drafts unavailable',
        description: error instanceof Error ? error.message : 'Unable to load private working drafts.',
        variant: 'destructive',
      });
    } finally {
      setLoadingDocuments(false);
    }
  }, [isSignedIn, toast]);

  useEffect(() => { void refreshDocuments(); }, [refreshDocuments]);

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
    window.location.assign('/studio');
  }, []);

  const deleteWorkingDraft = useCallback(async (document: StudioDocumentSummary) => {
    setDeletingDocumentId(document.id);
    try {
      const response = await fetch(`/api/studio-documents/${encodeURIComponent(document.id)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to delete this working draft.'));
      await refreshDocuments();
      toast({
        title: 'Working draft deleted',
        description: `“${document.title}” was removed from private AI/Studio working storage. Installed local work and cloud sets were not deleted.`,
      });
    } catch (error) {
      toast({
        title: 'Working draft not deleted',
        description: error instanceof Error ? error.message : 'Unable to delete this working draft.',
        variant: 'destructive',
      });
    } finally {
      setDeletingDocumentId(null);
    }
  }, [refreshDocuments, toast]);

  return (
    <section className="mx-auto max-w-4xl px-4 pb-8 md:px-6" aria-labelledby="storage-library-title">
      <div className="border border-[#5f4526] bg-[#100c08] p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[#e2aa4a]">
              <Database className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">Storage &amp; Library</span>
            </div>
            <h2 id="storage-library-title" className="mt-2 font-serif text-2xl text-[#fff1c7]">Your CardForge, in one place</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[#cbb58b]">
              See what lives on this device, what is backed up to your account, and what exists only as a private AI working draft. Delete actions affect only the storage location they name.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-[#70532e] bg-transparent text-[#f6d891] hover:bg-[#24180e]"
            onClick={() => { void refreshDeviceDetails(); void refreshCloudSets(); void refreshDocuments(); }}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <StorageSummaryCard
            icon={<HardDrive className="h-4 w-4" />}
            eyebrow="This device"
            title={deviceHealth?.usageBytes !== null && deviceHealth?.usageBytes !== undefined ? `${formatBytes(deviceHealth.usageBytes)} used` : 'Browser storage'}
            detail={deviceHealth?.quotaBytes ? `of ${formatBytes(deviceHealth.quotaBytes)} available to this site` : 'Your local workspace remains browser-owned.'}
            ratio={deviceHealth?.usageRatio ?? null}
            footer={`${cardSets.length} set${cardSets.length === 1 ? '' : 's'} · ${storedCards.length} cards · ${userTemplates.length} personal Templates · ${customAssetCount} custom assets (${formatBytes(customAssetBytes)} serialized)`}
          />
          <StorageSummaryCard
            icon={<Cloud className="h-4 w-4" />}
            eyebrow="CardForge cloud"
            title={isSignedIn ? `${cloudUsed} / ${cloudLimit} set slots` : 'Sign in to back up sets'}
            detail={isSignedIn ? `${formatBytes(cloudBytes)} stored across your cloud sets` : 'Cloud saves are account-owned and available across devices.'}
            ratio={isSignedIn && cloudLimit > 0 ? cloudUsed / cloudLimit : null}
            footer={`Each cloud set can use up to ${Math.round(MAX_CLOUD_SET_BYTES / 1024 / 1024)} MB. Slot limits are separate from byte usage.`}
          />
        </div>

        {hydrationError ? <p className="mt-4 border border-[#8b4c35] bg-[#2a130e] p-3 text-sm text-[#efb6a4]">{hydrationError}</p> : null}

        <div className="mt-6">
          <h3 className="font-serif text-xl text-[#fff1c7]">On this device</h3>
          <p className="mt-1 text-xs leading-5 text-[#a9946c]">Portable-size estimates can overlap because Templates and artwork may be shared by multiple sets.</p>
          {!hydrated ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-[#cbb58b]"><Loader2 className="h-4 w-4 animate-spin" /> Loading this device workspace…</p>
          ) : (
            <div className="mt-3 space-y-2">
              {cardSets.map((set) => {
                const cloudSet = cloudBySetId.get(set.id);
                const canBackUp = Boolean(cloudSet) || cloudUsed < cloudLimit;
                return (
                  <div key={set.id} className="flex flex-wrap items-center justify-between gap-3 border border-[#4a3823] bg-[#15100a] p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#fff1c7]">{set.name}</p>
                      <p className="mt-1 text-xs text-[#bba57c]">
                        {cardCounts.get(set.id) ?? 0} cards · {formatBytes(portableSetBytes[set.id])} portable estimate · {cloudSet ? 'device + cloud' : 'device only'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => openLocalSet(set.id)}>Open</Button>
                      {isSignedIn ? (
                        <Button size="sm" variant="outline" disabled={!canBackUp || Boolean(savingSetId)} onClick={() => void saveSetToCloud(set.id)}>
                          {savingSetId === set.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CloudUpload className="mr-2 h-4 w-4" />}
                          {cloudSet ? 'Update cloud' : canBackUp ? 'Back up' : 'Slots full'}
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
        </div>

        <div className="mt-6 border-t border-[#4a3823] pt-5">
          <h3 className="font-serif text-xl text-[#fff1c7]">Cloud sets</h3>
          <p className="mt-1 text-xs leading-5 text-[#a9946c]">Removing a cloud backup never deletes a copy already stored on a device.</p>
          {!isSignedIn ? (
            <p className="mt-3 text-sm text-[#cbb58b]">Sign in to see and manage account cloud saves.</p>
          ) : isLoadingCloudSets ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-[#cbb58b]"><Loader2 className="h-4 w-4 animate-spin" /> Loading cloud sets…</p>
          ) : cloud?.sets.length ? (
            <div className="mt-3 space-y-2">
              {cloud.sets.map((set) => (
                <div key={set.setId} className="flex flex-wrap items-center justify-between gap-3 border border-[#4a3823] bg-[#15100a] p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#fff1c7]">{set.name}</p>
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
          ) : <p className="mt-3 text-sm text-[#cbb58b]">No cloud-saved sets yet.</p>}
        </div>

        <div className="mt-6 border-t border-[#4a3823] pt-5">
          <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-[#e2aa4a]" /><h3 className="font-serif text-xl text-[#fff1c7]">AI &amp; Studio working drafts</h3></div>
          <p className="mt-1 text-xs leading-5 text-[#a9946c]">These are temporary private collaboration documents. They are separate from your permanent cloud sets and from installed local Templates.</p>
          {!isSignedIn ? (
            <p className="mt-3 text-sm text-[#cbb58b]">Sign in to see private working drafts.</p>
          ) : loadingDocuments ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-[#cbb58b]"><Loader2 className="h-4 w-4 animate-spin" /> Loading working drafts…</p>
          ) : studioDocuments.length ? (
            <div className="mt-3 space-y-2">
              {studioDocuments.map((document) => (
                <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 border border-[#4a3823] bg-[#15100a] p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#fff1c7]">{document.title}</p>
                    <p className="mt-1 text-xs text-[#bba57c]">Revision {document.revision} · {document.creationSource === 'gpt' ? 'ChatGPT working draft' : 'Studio working document'} · updated {formatDate(document.updatedAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline"><Link href={`/studio?document=${encodeURIComponent(document.id)}&revision=${document.revision}`}>Continue <ExternalLink className="ml-2 h-3.5 w-3.5" /></Link></Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={Boolean(deletingDocumentId)}
                      onClick={() => {
                        if (window.confirm(`Delete the private working draft “${document.title}”? Installed local work and cloud sets will not be deleted.`)) void deleteWorkingDraft(document);
                      }}
                    >
                      {deletingDocumentId === document.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                      Delete draft
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="mt-3 text-sm text-[#cbb58b]">No private working drafts are attached to this account.</p>}
        </div>
      </div>
    </section>
  );
}
