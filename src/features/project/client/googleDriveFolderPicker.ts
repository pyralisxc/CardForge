"use client";

import { readApiError } from '@/infrastructure/http/clientResponses';
import {
  GOOGLE_DRIVE_FOLDER_MIME_TYPE,
  type GoogleDriveFolderSelection,
} from '../model/googleDriveProject';
import { disconnectGoogleDriveProjectBinding } from './googleDriveProjectTransfer';
import { pickGoogleDriveItems } from './googleDrivePicker';

const persistSelectedFolder = async (
  selected: GoogleDriveFolderSelection,
): Promise<GoogleDriveFolderSelection> => {
  const response = await fetch('/api/project-sources/google-drive', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folderId: selected.id }),
  });
  if (!response.ok) throw await readApiError(response, 'Unable to use that Google Drive folder for CardForge projects.');
  return await response.json() as GoogleDriveFolderSelection;
};

export const chooseGoogleDriveProjectFolder = async (): Promise<GoogleDriveFolderSelection | null> => {
  const selectedItems = await pickGoogleDriveItems({
    title: 'Choose where CardForge projects live',
    mimeTypes: [GOOGLE_DRIVE_FOLDER_MIME_TYPE],
    includeFolders: true,
    selectFolders: true,
    initialFolderId: null,
  });
  if (!selectedItems) return null;
  const selected = selectedItems[0];
  if (!selected || (selected.mimeType && selected.mimeType !== GOOGLE_DRIVE_FOLDER_MIME_TYPE)) {
    throw new Error('Choose a Google Drive folder rather than an individual file.');
  }
  const persisted = await persistSelectedFolder({ id: selected.id, name: selected.name });
  await disconnectGoogleDriveProjectBinding();
  return persisted;
};
