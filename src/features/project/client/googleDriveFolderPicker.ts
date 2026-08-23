"use client";

import { readApiError } from '@/infrastructure/http/clientResponses';
import {
  GOOGLE_DRIVE_FOLDER_MIME_TYPE,
  type GoogleDriveFolderSelection,
  type GoogleDrivePickerConfiguration,
} from '../model/googleDriveProject';
import { disconnectGoogleDriveProjectBinding } from './googleDriveProjectTransfer';

const GOOGLE_PICKER_SCRIPT_SRC = 'https://apis.google.com/js/api.js';

type PickerDocument = {
  id?: string;
  name?: string;
  mimeType?: string;
};

type PickerResponse = {
  action?: string;
  docs?: PickerDocument[];
};

type DocsViewInstance = {
  setIncludeFolders: (included: boolean) => DocsViewInstance;
  setSelectFolderEnabled: (enabled: boolean) => DocsViewInstance;
  setMimeTypes: (mimeTypes: string) => DocsViewInstance;
  setMode: (mode: string) => DocsViewInstance;
  setParent: (parentId: string) => DocsViewInstance;
};

type PickerInstance = {
  setVisible: (visible: boolean) => void;
};

type PickerBuilderInstance = {
  addView: (view: DocsViewInstance) => PickerBuilderInstance;
  setOAuthToken: (token: string) => PickerBuilderInstance;
  setDeveloperKey: (key: string) => PickerBuilderInstance;
  setAppId: (appId: string) => PickerBuilderInstance;
  setCallback: (callback: (response: PickerResponse) => void) => PickerBuilderInstance;
  setTitle: (title: string) => PickerBuilderInstance;
  build: () => PickerInstance;
};

type PickerNamespace = {
  DocsView: new () => DocsViewInstance;
  PickerBuilder: new () => PickerBuilderInstance;
  DocsViewMode: { LIST: string };
  Action: { PICKED: string; CANCEL: string; ERROR: string };
};

type GooglePickerWindow = Window & {
  gapi?: {
    load: (
      library: string,
      options: { callback: () => void; onerror: () => void },
    ) => void;
  };
  google?: { picker?: PickerNamespace };
};

let pickerLoadPromise: Promise<PickerNamespace> | null = null;

const loadPickerLibrary = async (): Promise<PickerNamespace> => {
  if (typeof window === 'undefined') throw new Error('Google Drive folder picking is available only in the browser.');
  const pickerWindow = window as GooglePickerWindow;
  if (pickerWindow.google?.picker) return pickerWindow.google.picker;
  if (pickerLoadPromise) return pickerLoadPromise;

  pickerLoadPromise = new Promise<PickerNamespace>((resolve, reject) => {
    const loadPicker = () => {
      if (!pickerWindow.gapi) {
        reject(new Error('Google Picker could not initialize. Reload the page and try again.'));
        return;
      }
      pickerWindow.gapi.load('picker', {
        callback: () => {
          if (pickerWindow.google?.picker) resolve(pickerWindow.google.picker);
          else reject(new Error('Google Picker loaded without its browser API.'));
        },
        onerror: () => reject(new Error('Google Picker could not be loaded.')),
      });
    };

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_PICKER_SCRIPT_SRC}"]`);
    if (existing) {
      if (pickerWindow.gapi) loadPicker();
      else {
        existing.addEventListener('load', loadPicker, { once: true });
        existing.addEventListener('error', () => reject(new Error('Google Picker script failed to load.')), { once: true });
      }
      return;
    }

    const script = document.createElement('script');
    script.src = GOOGLE_PICKER_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', loadPicker, { once: true });
    script.addEventListener('error', () => reject(new Error('Google Picker script failed to load.')), { once: true });
    document.head.appendChild(script);
  }).catch((error) => {
    pickerLoadPromise = null;
    throw error;
  });

  return pickerLoadPromise;
};

const loadPickerConfiguration = async (): Promise<GoogleDrivePickerConfiguration> => {
  const response = await fetch('/api/project-sources/google-drive/picker-config', { cache: 'no-store' });
  if (!response.ok) throw await readApiError(response, 'Unable to prepare Google Drive folder selection.');
  return await response.json() as GoogleDrivePickerConfiguration;
};

const showFolderPicker = async (
  picker: PickerNamespace,
  config: GoogleDrivePickerConfiguration,
): Promise<GoogleDriveFolderSelection | null> => new Promise((resolve, reject) => {
  let view = new picker.DocsView()
    .setIncludeFolders(true)
    .setSelectFolderEnabled(true)
    .setMimeTypes(GOOGLE_DRIVE_FOLDER_MIME_TYPE)
    .setMode(picker.DocsViewMode.LIST);
  if (config.initialFolderId) view = view.setParent(config.initialFolderId);

  const instance = new picker.PickerBuilder()
    .addView(view)
    .setOAuthToken(config.accessToken)
    .setDeveloperKey(config.developerKey)
    .setAppId(config.appId)
    .setTitle('Choose where CardForge projects live')
    .setCallback((response) => {
      if (response.action === picker.Action.CANCEL) {
        resolve(null);
        return;
      }
      if (response.action === picker.Action.ERROR) {
        reject(new Error('Google Drive could not complete folder selection.'));
        return;
      }
      if (response.action !== picker.Action.PICKED) return;
      const selected = response.docs?.[0];
      const id = selected?.id?.trim() ?? '';
      const name = selected?.name?.trim() ?? '';
      if (!id || !name || (selected?.mimeType && selected.mimeType !== GOOGLE_DRIVE_FOLDER_MIME_TYPE)) {
        reject(new Error('Choose a Google Drive folder rather than an individual file.'));
        return;
      }
      resolve({ id, name });
    })
    .build();
  instance.setVisible(true);
});

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
  const [picker, config] = await Promise.all([
    loadPickerLibrary(),
    loadPickerConfiguration(),
  ]);
  const selected = await showFolderPicker(picker, config);
  if (!selected) return null;
  const persisted = await persistSelectedFolder(selected);
  await disconnectGoogleDriveProjectBinding();
  return persisted;
};
