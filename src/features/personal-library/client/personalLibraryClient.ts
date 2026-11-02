"use client";
import { PERSONAL_LIBRARY_REMOVAL_NOTICE, personalLibraryItemRead, personalLibraryRemovalReceipt, uncertainPersonalLibraryRemoval } from '../itemContract';

import { readApiError } from '@/infrastructure/http/clientResponses';
import { observeProviderBoundaryResponse, trackProviderBoundaryOutcome } from '@/features/analytics/client/tracking';
import { pickGoogleDriveItems } from '@/features/project/client/provider-google-drive';
import {
  MAX_PERSONAL_LIBRARY_REGISTER_BATCH,
  PERSONAL_LIBRARY_FONT_MIME_TYPES,
  PERSONAL_LIBRARY_IMAGE_MIME_TYPES,
  type PersonalLibraryDriveSelection,
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
  const response = await observeProviderBoundaryResponse('google_drive', 'personal_list', () => (
    fetch('/api/personal-library', { cache: 'no-store' })
  ));
  if (!response.ok) throw await readApiError(response, 'Unable to load your personal library.');
  return await response.json() as PersonalLibraryListResult;
};

export const registerGoogleDrivePersonalLibraryItems = async ({
  role,
  files,
}: {
  role: PersonalLibraryRole;
  files: PersonalLibraryDriveSelection[];
}): Promise<PersonalLibraryRegisterResult> => {
  const response = await observeProviderBoundaryResponse('google_drive', 'personal_register', () => fetch('/api/personal-library', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'google-drive', role, files }),
  }));
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
    files: selected.map((item) => ({ fileId: item.id, resourceKey: item.resourceKey ?? null })),
  });
};

export const getPersonalLibraryItem = async (itemId: string) => {
  const response = await fetch(`/api/personal-library/${encodeURIComponent(itemId)}`, { cache: 'no-store' });
  if (!response.ok) throw await readApiError(response, 'Exact index readback is unavailable.');
  const result = personalLibraryItemRead.parse(await response.json());
  if (result.itemId !== itemId || (result.item && result.item.itemId !== itemId)) throw new Error('Exact index readback returned a different identity.');
  return result;
};

export const removePersonalLibraryItem = async (itemId: string) => {
  try {
    const response = await fetch(`/api/personal-library/${encodeURIComponent(itemId)}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmation: { itemId, notice: PERSONAL_LIBRARY_REMOVAL_NOTICE } }) });
    // Optional analytics must not erase the authoritative HTTP acknowledgement.
    try { trackProviderBoundaryOutcome('google_drive', 'personal_remove', response); } catch { /* fail open */ }
    if (response.status === 204) return { itemId, outcome: 'removed' as const, committed: true, retryable: false as const, message: 'The exact index entry was removed; its Drive original is untouched.' };
    const body = await response.json();
    const receipt = personalLibraryRemovalReceipt.safeParse(body?.receipt);
    if (receipt.success && receipt.data.itemId === itemId) return receipt.data;
    return uncertainPersonalLibraryRemoval(itemId);
  } catch { return uncertainPersonalLibraryRemoval(itemId); }
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
  const response = await observeProviderBoundaryResponse('google_drive', 'personal_content', () => (
    fetch(`/api/personal-library/${encodeURIComponent(item.id)}/content`, { cache: 'no-store' })
  ));
  if (!response.ok) throw await readApiError(response, 'Unable to load that personal-library asset.');
  return {
    itemId: item.id,
    contentHash: response.headers.get('X-CardForge-Content-Hash') || null,
    mimeType: response.headers.get('Content-Type') || item.mimeType,
    blob: await response.blob(),
  };
};
