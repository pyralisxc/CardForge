"use client";

import { readApiError } from '@/infrastructure/http/clientResponses';
import { observeProviderBoundaryResponse } from '@/features/analytics/client/tracking';
import {
  GOOGLE_DRIVE_FOLDER_MIME_TYPE,
  GOOGLE_DRIVE_PROJECT_MIME_TYPE,
  isGoogleDriveFileId,
  type GoogleDriveFolderSelection,
} from '../model/googleDriveProject';
import { PROJECT_LIBRARY_CHANGE_EVENT } from './assets';
import { disconnectGoogleDriveProjectBinding } from './googleDriveProjectTransfer';
import { pickGoogleDriveItems } from './googleDrivePicker';

const notifyProjectLibraryChanged = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PROJECT_LIBRARY_CHANGE_EVENT));
};

const finishDestinationChange = async () => {
  await disconnectGoogleDriveProjectBinding();
  notifyProjectLibraryChanged();
};

const persistSelectedFolder = async (
  selected: GoogleDriveFolderSelection,
): Promise<GoogleDriveFolderSelection> => {
  const response = await observeProviderBoundaryResponse('google_drive', 'folder_select', () => fetch('/api/project-sources/google-drive', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folderId: selected.id, resourceKey: selected.resourceKey ?? null }),
  }));
  if (!response.ok) throw await readApiError(response, 'Unable to use that Google Drive folder for CardForge projects.');
  return await response.json() as GoogleDriveFolderSelection;
};

/**
 * `drive.file` intentionally does not turn folder ACL access into blanket app access
 * for every pre-existing child. Open a Picker rooted at the chosen project folder so
 * the creator can explicitly authorize the existing CardForge projects they want the
 * app to discover. Newly created CardForge files do not need this extra handoff.
 */
export const authorizeExistingGoogleDriveProjects = async (folderId: string): Promise<number | null> => {
  if (!isGoogleDriveFileId(folderId)) throw new Error('The selected Google Drive folder is invalid.');
  const selectedItems = await pickGoogleDriveItems({
    title: 'Add existing CardForge projects from this folder',
    mimeTypes: [GOOGLE_DRIVE_PROJECT_MIME_TYPE],
    includeFolders: false,
    selectFolders: false,
    multiselect: true,
    initialFolderId: folderId,
  });
  if (!selectedItems) return null;
  notifyProjectLibraryChanged();
  return selectedItems.length;
};

export const chooseGoogleDriveProjectFolder = async (): Promise<GoogleDriveFolderSelection | null> => {
  const selectedItems = await pickGoogleDriveItems({
    title: 'Choose where CardForge projects live',
    mimeTypes: [GOOGLE_DRIVE_FOLDER_MIME_TYPE],
    includeFolders: true,
    selectFolders: true,
    // Folder selection is a destination change, so start from My Drive rather than
    // trapping the user inside the current CardForge destination (which may be empty,
    // moved, revoked, or read-only).
    initialFolderId: null,
  });
  if (!selectedItems) return null;
  const selected = selectedItems[0];
  if (!selected || (selected.mimeType && selected.mimeType !== GOOGLE_DRIVE_FOLDER_MIME_TYPE)) {
    throw new Error('Choose a Google Drive folder rather than an individual file.');
  }
  const persisted = await persistSelectedFolder({
    id: selected.id,
    name: selected.name,
    resourceKey: selected.resourceKey,
  });
  await finishDestinationChange();
  return persisted;
};

export const createGoogleDriveProjectFolder = async (name: string): Promise<GoogleDriveFolderSelection> => {
  const response = await observeProviderBoundaryResponse('google_drive', 'folder_create', () => fetch('/api/project-sources/google-drive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folderName: name }),
  }));
  if (!response.ok) throw await readApiError(response, 'Unable to create a Google Drive folder for CardForge projects.');
  const created = await response.json() as GoogleDriveFolderSelection;
  await finishDestinationChange();
  return created;
};
