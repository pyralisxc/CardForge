"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { CardAssetOption } from '@/domain/templates';
import type { useToast } from '@/components/ui/use-toast';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';
import {
  hydrateCloudSetTransfer,
  prepareCloudSetTransfer,
  uploadPreparedCloudSetAssets,
} from '../client/cloudSetTransfer';
import { createCardSetTransfer } from '../model/cardTransfer';
import type {
  CloudSetAssetDescriptor,
  CloudSetDownloadResult,
  CloudSetListResult,
  CloudSetPrepareResult,
  CloudSetSummary,
} from '../model/cloudSet';
import {
  CUSTOM_DIVIDER_ASSETS_STORAGE_KEY,
  CUSTOM_ICON_ASSETS_STORAGE_KEY,
  CUSTOM_IMAGE_ASSETS_STORAGE_KEY,
  CUSTOM_TEXTURE_ASSETS_STORAGE_KEY,
  type ProjectDocumentCustomAssets,
} from '../model/projectDocument';
import {
  getProjectAssetStorage,
  readTypedProjectAssetListFromStorage,
} from '../persistence/projectAssets';
import { selectAllTemplates } from '../store/selectors';
import { useProjectStore } from '../store/workspaceStore';
import { useCardTransferActions } from './useCardTransferActions';

type ToastFn = ReturnType<typeof useToast>['toast'];

const readCustomAssets = async (): Promise<ProjectDocumentCustomAssets> => {
  const storage = getProjectAssetStorage();
  const [textures, dividers, icons, images] = await Promise.all([
    readTypedProjectAssetListFromStorage<CardAssetOption>(storage, CUSTOM_TEXTURE_ASSETS_STORAGE_KEY),
    readTypedProjectAssetListFromStorage<CardAssetOption>(storage, CUSTOM_DIVIDER_ASSETS_STORAGE_KEY),
    readTypedProjectAssetListFromStorage<CardAssetOption>(storage, CUSTOM_ICON_ASSETS_STORAGE_KEY),
    readTypedProjectAssetListFromStorage<CardAssetOption>(storage, CUSTOM_IMAGE_ASSETS_STORAGE_KEY),
  ]);
  return {
    [CUSTOM_TEXTURE_ASSETS_STORAGE_KEY]: textures,
    [CUSTOM_DIVIDER_ASSETS_STORAGE_KEY]: dividers,
    [CUSTOM_ICON_ASSETS_STORAGE_KEY]: icons,
    [CUSTOM_IMAGE_ASSETS_STORAGE_KEY]: images,
  };
};

const requireJson = async <T>(response: Response, fallback: string): Promise<T> => {
  if (!response.ok) throw new Error(await readApiErrorMessage(response, fallback));
  return await response.json() as T;
};

export function useCloudSetActions({
  toast,
  enabled,
}: {
  toast: ToastFn;
  enabled: boolean;
}) {
  const [cloud, setCloud] = useState<CloudSetListResult | null>(null);
  const [isLoadingCloudSets, setIsLoadingCloudSets] = useState(false);
  const [savingSetId, setSavingSetId] = useState<string | null>(null);
  const [loadingSetId, setLoadingSetId] = useState<string | null>(null);
  const [deletingSetId, setDeletingSetId] = useState<string | null>(null);
  const { importTransfer } = useCardTransferActions({ toast });

  const refreshCloudSets = useCallback(async () => {
    if (!enabled) {
      setCloud(null);
      return null;
    }
    setIsLoadingCloudSets(true);
    try {
      const response = await fetch('/api/cloud-sets', { cache: 'no-store' });
      const next = await requireJson<CloudSetListResult>(response, 'Unable to load CardForge cloud saves.');
      setCloud(next);
      return next;
    } catch (error) {
      toast({
        title: 'Cloud saves unavailable',
        description: error instanceof Error ? error.message : 'Unable to load CardForge cloud saves.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoadingCloudSets(false);
    }
  }, [enabled, toast]);

  useEffect(() => {
    void refreshCloudSets();
  }, [refreshCloudSets]);

  const cloudBySetId = useMemo(() => new Map(
    (cloud?.sets ?? []).map((summary) => [summary.setId, summary]),
  ), [cloud?.sets]);

  const saveSetToCloud = useCallback(async (setId: string) => {
    if (!enabled || savingSetId) return null;
    const state = useProjectStore.getState();
    const set = state.cardSets.find((candidate) => candidate.id === setId);
    if (!set) {
      toast({ title: 'Set not found', description: 'Choose an existing local set before saving it to the cloud.', variant: 'destructive' });
      return null;
    }
    setSavingSetId(setId);
    try {
      const transfer = createCardSetTransfer({
        set,
        storedCards: state.storedCards,
        templates: selectAllTemplates(state),
        customAssets: await readCustomAssets(),
      });
      const prepared = await prepareCloudSetTransfer(transfer);
      const assets: CloudSetAssetDescriptor[] = prepared.assets.map(({ id, mimeType, size }) => ({ id, mimeType, size }));
      const prepareResponse = await fetch('/api/cloud-sets/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setId: set.id, name: set.name, payload: prepared.payload, assets }),
      });
      const uploadPlan = await requireJson<CloudSetPrepareResult>(prepareResponse, 'Unable to prepare this cloud save.');
      await uploadPreparedCloudSetAssets({
        preparedAssets: prepared.assets,
        uploads: uploadPlan.uploads,
      });
      const expectedRevision = cloudBySetId.get(setId)?.revision ?? null;
      const saveResponse = await fetch('/api/cloud-sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setId: set.id,
          name: set.name,
          payload: prepared.payload,
          assets,
          expectedRevision,
        }),
      });
      const saved = await requireJson<{ summary: CloudSetSummary }>(saveResponse, 'Unable to finish this cloud save.');
      await refreshCloudSets();
      toast({
        title: expectedRevision ? 'Cloud set updated' : 'Set saved to cloud',
        description: `“${set.name}” is backed up as cloud revision ${saved.summary.revision}. Your local copy remains the working copy on this device.`,
      });
      return saved.summary;
    } catch (error) {
      toast({
        title: 'Cloud save failed',
        description: error instanceof Error ? error.message : 'CardForge could not save this set to the cloud. Your local set is unchanged.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setSavingSetId(null);
    }
  }, [cloudBySetId, enabled, refreshCloudSets, savingSetId, toast]);

  const loadSetFromCloud = useCallback(async (setId: string) => {
    if (!enabled || loadingSetId) return false;
    setLoadingSetId(setId);
    try {
      const response = await fetch(`/api/cloud-sets/${encodeURIComponent(setId)}`, { cache: 'no-store' });
      const cloudSet = await requireJson<CloudSetDownloadResult>(response, 'Unable to load this cloud set.');
      const hydrated = await hydrateCloudSetTransfer(cloudSet.payload, cloudSet.assets);
      const file = new File([JSON.stringify(hydrated)], `cardforge-cloud-${setId}.json`, { type: 'application/json' });
      const imported = await importTransfer(file);
      if (imported) {
        toast({
          title: 'Cloud set loaded',
          description: `“${cloudSet.summary.name}” revision ${cloudSet.summary.revision} was merged into this device’s local workspace.`,
        });
      }
      return imported;
    } catch (error) {
      toast({
        title: 'Cloud set not loaded',
        description: error instanceof Error ? error.message : 'CardForge could not load this cloud set.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoadingSetId(null);
    }
  }, [enabled, importTransfer, loadingSetId, toast]);

  const removeCloudSet = useCallback(async (setId: string) => {
    if (!enabled || deletingSetId) return false;
    setDeletingSetId(setId);
    try {
      const response = await fetch(`/api/cloud-sets/${encodeURIComponent(setId)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to remove this cloud save.'));
      const removedName = cloudBySetId.get(setId)?.name ?? setId;
      await refreshCloudSets();
      toast({
        title: 'Cloud save removed',
        description: `“${removedName}” remains on this device; only its cloud backup was removed.`,
      });
      return true;
    } catch (error) {
      toast({
        title: 'Cloud save not removed',
        description: error instanceof Error ? error.message : 'Unable to remove this cloud save.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setDeletingSetId(null);
    }
  }, [cloudBySetId, deletingSetId, enabled, refreshCloudSets, toast]);

  return {
    cloud,
    cloudBySetId,
    deletingSetId,
    isLoadingCloudSets,
    loadingSetId,
    refreshCloudSets,
    removeCloudSet,
    saveSetToCloud,
    savingSetId,
    loadSetFromCloud,
  };
}
