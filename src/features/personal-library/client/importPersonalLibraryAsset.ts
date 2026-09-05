"use client";

import type { CardAssetOption } from '@/features/pipeline/client/assets';
import { normalizeLocalLibraryAsset } from '@/features/pipeline/client/assets';
import { CUSTOM_DIVIDER_ASSETS_STORAGE_KEY, CUSTOM_ICON_ASSETS_STORAGE_KEY, CUSTOM_IMAGE_ASSETS_STORAGE_KEY, CUSTOM_TEXTURE_ASSETS_STORAGE_KEY } from '@/features/project/client/package-document';
import { getProjectAssetStorage, mergeProjectAssetListToStorage } from '@/features/project/client/assets';
import { optimizeLocalAssetFile, validateLocalAssetFile } from '@/features/project/client/persistence-storage';
import type { StudioAssetDestination } from '@/domain/templates';
import { materializePersonalLibraryItemContent } from './personalLibraryClient';
import type { PersonalLibraryItem, PersonalLibraryRole } from '../model';

type LocalAssetKind = 'texture' | 'divider' | 'icon' | 'image';

const roleToKind = (role: PersonalLibraryRole): LocalAssetKind | null => {
  if (role === 'texture') return 'texture';
  if (role === 'divider') return 'divider';
  if (role === 'icon') return 'icon';
  if (role === 'artwork' || role === 'frame' || role === 'reference') return 'image';
  return null;
};

const storageKeyForKind = (kind: LocalAssetKind) => {
  if (kind === 'texture') return CUSTOM_TEXTURE_ASSETS_STORAGE_KEY;
  if (kind === 'divider') return CUSTOM_DIVIDER_ASSETS_STORAGE_KEY;
  if (kind === 'icon') return CUSTOM_ICON_ASSETS_STORAGE_KEY;
  return CUSTOM_IMAGE_ASSETS_STORAGE_KEY;
};

const destinationsForRole = (role: PersonalLibraryRole): StudioAssetDestination[] => {
  if (role === 'texture') return ['appearance.texture'];
  if (role === 'divider') return ['element.divider'];
  if (role === 'icon') return ['element.icon'];
  if (role === 'frame') {
    return ['image.frame.front', 'image.frame.back', 'image.border.front', 'image.border.back', 'image.picture'];
  }
  return ['image.picture'];
};

const dataUrlForFile = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => typeof reader.result === 'string'
    ? resolve(reader.result)
    : reject(new Error('CardForge could not read the connected asset.'));
  reader.onerror = () => reject(new Error('CardForge could not read the connected asset.'));
  reader.readAsDataURL(file);
});

const allowedTargetsForKind = (kind: LocalAssetKind): CardAssetOption['allowedTargets'] => {
  if (kind === 'texture') return ['text', 'shape', 'template'];
  if (kind === 'divider') return ['divider'];
  if (kind === 'icon') return ['icon'];
  return ['image', 'imageFrame', 'template'];
};

export const importPersonalLibraryItemToLocalAsset = async (
  item: PersonalLibraryItem,
): Promise<CardAssetOption> => {
  const kind = roleToKind(item.role);
  if (!kind) {
    throw new Error(item.role === 'font'
      ? 'Connected fonts are indexed, but font activation is being implemented separately so CardForge does not create a fake image asset.'
      : 'This connected library item cannot be imported into the visual asset library.');
  }

  const materialized = await materializePersonalLibraryItemContent(item);
  const sourceFile = new File([materialized.blob], item.displayName, {
    type: materialized.mimeType,
    lastModified: Date.parse(item.providerModifiedAt) || Date.now(),
  });
  const validation = validateLocalAssetFile(sourceFile);
  if (!validation.ok) throw new Error(validation.message);
  const storedFile = await optimizeLocalAssetFile(sourceFile);
  const dataUrl = await dataUrlForFile(storedFile);
  const stableId = `connected-google-drive-${item.id}`;
  const asset = normalizeLocalLibraryAsset({
    id: stableId,
    name: item.displayName.replace(/\.[^.]+$/u, ''),
    url: dataUrl,
    kind,
    fileSizeBytes: storedFile.size,
    tileMode: kind === 'texture' ? 'repeat' : kind === 'divider' ? 'stretch' : 'contain',
    seamless: kind === 'texture',
    allowedTargets: allowedTargetsForKind(kind),
    defaultBlendMode: kind === 'texture' ? 'multiply' : 'normal',
    defaultOpacity: kind === 'texture' ? 45 : 100,
    defaultScale: kind === 'texture' ? 160 : 100,
    defaultWidth: kind === 'icon' ? 64 : kind === 'image' ? 300 : undefined,
    defaultHeight: kind === 'icon' ? 64 : kind === 'image' ? 180 : undefined,
    packId: 'connected-google-drive',
    packName: 'My Library · Google Drive',
    studioDestinations: destinationsForRole(item.role),
    studioRoutingMode: 'owner',
    studioDefaultDestination: destinationsForRole(item.role)[0],
  });

  const storage = getProjectAssetStorage();
  const storageKey = storageKeyForKind(kind);
  await mergeProjectAssetListToStorage(storage, storageKey, [asset]);
  return asset;
};
