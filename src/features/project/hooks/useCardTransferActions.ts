"use client";

import type { ChangeEvent } from 'react';
import { useCallback } from 'react';

import type { CardAssetOption } from '@/domain/templates';
import type { useToast } from '@/components/ui/use-toast';
import { selectAllTemplates } from '../store/selectors';
import { useProjectStore } from '../store/workspaceStore';
import {
  createCardSetTransfer,
  createCardTransfer,
  parseCardForgeTransferFile,
  type CardForgeTransferV1,
} from '../model/cardTransfer';
import {
  CUSTOM_DIVIDER_ASSETS_STORAGE_KEY,
  CUSTOM_ICON_ASSETS_STORAGE_KEY,
  CUSTOM_IMAGE_ASSETS_STORAGE_KEY,
  CUSTOM_TEXTURE_ASSETS_STORAGE_KEY,
  type ProjectDocumentCustomAssets,
} from '../model/projectDocument';
import {
  getProjectAssetStorage,
  mergeProjectAssetListToStorage,
  readTypedProjectAssetListFromStorage,
} from '../persistence/projectAssets';

type ToastFn = ReturnType<typeof useToast>['toast'];

const safeFilePart = (value: string) => (
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'cardforge'
);

const downloadJson = (fileName: string, value: unknown) => {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

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

const mergeTransferAssets = async (transfer: CardForgeTransferV1) => {
  const storage = getProjectAssetStorage();
  await Promise.all([
    mergeProjectAssetListToStorage(storage, CUSTOM_TEXTURE_ASSETS_STORAGE_KEY, transfer.customAssets[CUSTOM_TEXTURE_ASSETS_STORAGE_KEY]),
    mergeProjectAssetListToStorage(storage, CUSTOM_DIVIDER_ASSETS_STORAGE_KEY, transfer.customAssets[CUSTOM_DIVIDER_ASSETS_STORAGE_KEY]),
    mergeProjectAssetListToStorage(storage, CUSTOM_ICON_ASSETS_STORAGE_KEY, transfer.customAssets[CUSTOM_ICON_ASSETS_STORAGE_KEY]),
    mergeProjectAssetListToStorage(storage, CUSTOM_IMAGE_ASSETS_STORAGE_KEY, transfer.customAssets[CUSTOM_IMAGE_ASSETS_STORAGE_KEY]),
  ]);
};

export function useCardTransferActions({ toast }: { toast: ToastFn }) {
  const exportSet = useCallback(async (setId: string) => {
    const state = useProjectStore.getState();
    const set = state.cardSets.find((candidate) => candidate.id === setId);
    if (!set) {
      toast({ title: 'Set not found', description: 'Choose an existing set before exporting.', variant: 'destructive' });
      return;
    }
    const transfer = createCardSetTransfer({
      set,
      storedCards: state.storedCards,
      templates: selectAllTemplates(state),
      customAssets: await readCustomAssets(),
    });
    downloadJson(`cardforge-set-${safeFilePart(set.name)}.json`, transfer);
    toast({ title: 'Set exported', description: `${transfer.cards.length} card${transfer.cards.length === 1 ? '' : 's'} and their required Templates were saved locally.` });
  }, [toast]);

  const exportCard = useCallback(async (cardUniqueId: string) => {
    const state = useProjectStore.getState();
    const card = state.storedCards.find((candidate) => candidate.uniqueId === cardUniqueId);
    if (!card) {
      toast({ title: 'Card not found', description: 'That card is no longer in the local workspace.', variant: 'destructive' });
      return;
    }
    const set = state.cardSets.find((candidate) => candidate.id === card.setId) ?? state.activeCardSet;
    const transfer = createCardTransfer({
      card,
      set,
      templates: selectAllTemplates(state),
      customAssets: await readCustomAssets(),
    });
    const title = String(card.data.cardName || card.data.name || card.data.title || card.uniqueId);
    downloadJson(`cardforge-card-${safeFilePart(title)}.json`, transfer);
    toast({ title: 'Card exported', description: 'The editable card and its required Template were saved locally.' });
  }, [toast]);

  const importTransfer = useCallback(async (file: File) => {
    const transfer = parseCardForgeTransferFile(await file.text());
    if (!transfer) {
      toast({
        title: 'CardForge transfer not recognized',
        description: 'Choose a CardForge set or card JSON export. Full project files still belong in Project Import.',
        variant: 'destructive',
      });
      return false;
    }
    try {
      await mergeTransferAssets(transfer);
      const state = useProjectStore.getState();
      state.mergeUserTemplatesFromFiles(transfer.templates);
      state.mergeCardSetsFromFiles(transfer.sets, transfer.sets[0]?.id);
      const { successCount, skippedCount } = state.mergeStoredCardsFromFile(transfer.cards);
      if (transfer.sets[0]?.id) useProjectStore.getState().setActiveCardSetId(transfer.sets[0].id);
      toast({
        title: transfer.kind === 'set' ? 'Set imported' : 'Card imported',
        description: `${successCount} card${successCount === 1 ? '' : 's'} added or updated${skippedCount ? `; ${skippedCount} skipped` : ''}.`,
      });
      return true;
    } catch (error) {
      console.error('Unable to import CardForge transfer:', error);
      toast({
        title: 'Transfer could not be saved',
        description: 'Browser storage could not save the imported Templates or artwork. Free local storage and try again.',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  const handleImportTransfer = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void importTransfer(file);
    event.target.value = '';
  }, [importTransfer]);

  return { exportCard, exportSet, handleImportTransfer, importTransfer };
}
