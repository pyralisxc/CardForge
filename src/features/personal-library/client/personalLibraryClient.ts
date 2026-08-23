"use client";

import { readApiError } from '@/infrastructure/http/clientResponses';
import { pickGoogleDriveItems } from '@/features/project/client';
import {
  MAX_PERSONAL_LIBRARY_REGISTER_BATCH,
  PERSONAL_LIBRARY_FONT_MIME_TYPES,
  PERSONAL_LIBRARY_IMAGE_MIME_TYPES,
  type PersonalLibraryItem,
  type PersonalLibraryListResult,
  type PersonalLibraryRegisterResult,
  type PersonalLibraryRole,
} from '../model';

const roleMimeTypes = (role: PersonalLibraryRole): readonly string[] => {
  if (role === 'font') return PERSONAL_LIBRARY_FONT_MIME_TYPES;
  if (role === 'reference') return [...PERSONAL_LIBRARY_IMAGE_MIME_TYPES, ...PERSONAL_LIBRARY_FONT_MIME_TYPES];
  return PERSONAL_LIBRARY_IMAGE_MIME_TYPES;
};

export const loadPersonalLibrary = async (): Promise<PersonalLibraryListResult> => {
  const response = await fetch('/api/personal-library', { cache: 'no-store' });
  if (!response.ok) throw await readApiError(response, 'Unable to load your personal library.');
  return await response.json() as PersonalLibraryListResult;
};

export const registerGoogleDrivePersonalLibraryItems = async ({
  role,
  fileIds,
}: {
  role: PersonalLibraryRole;
  fileIds: string[];
}): Promise<PersonalLibraryRegisterResult> => {
  const response = await fetch('/api/personal-library', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'google-drive', role, fileIds }),
  });
  if (!response.ok) throw await readApiError(response, 'Unable to add the selected Google Drive files to your CardForge library.');
  return await response.json() as PersonalLibraryRegisterResult;
};

export const chooseGoogleDrivePersonalLibraryItems = async (
  role: PersonalLibraryRole,
): Promise<PersonalLibraryRegisterResult | null> => {
  const selected = await pickGoogleDriveItems({
    title: `Choose CardForge ${role} files`,
    mimeTypes: roleMimeTypes(role),
    includeFolders: true,
    selectFolders: false,
    multiselect: true,
    initialFolderId: null,
  });
  if (!selected) return null;
  if (selected.length > MAX_PERSONAL_LIBRARY_REGISTER_BATCH) {
    throw new Error(`Choose at most ${MAX_PERSONAL_LIBRARY_REGISTER_BATCH} files at a time.`);
  }
  return await registerGoogleDrivePersonalLibraryItems({
    role,
    fileIds: selected.map((item) => item.id),
  });
};

export const removePersonalLibraryItem = async (itemId: string): Promise<void> => {
  const response = await fetch(`/api/personal-library/${encodeURIComponent(itemId)}`, { method: 'DELETE' });
  if (!response.ok) throw await readApiError(response, 'Unable to remove that item from your CardForge library.');
};

export interface PersonalLibraryContent {
  itemId: string;
  contentHash: string | null;
  mimeType: string;
  blob: Blob;
}

export const materializePersonalLibraryItemContent = async (
  item: Pick<PersonalLibraryItem, 'id' | 'mimeType'>,
): Promise<PersonalLibraryContent> => {
  const response = await fetch(`/api/personal-library/${encodeURIComponent(item.id)}/content`, { cache: 'no-store' });
  if (!response.ok) throw await readApiError(response, 'Unable to load that personal-library asset.');
  return {
    itemId: item.id,
    contentHash: response.headers.get('X-CardForge-Content-Hash') || null,
    mimeType: response.headers.get('Content-Type') || item.mimeType,
    blob: await response.blob(),
  };
};
