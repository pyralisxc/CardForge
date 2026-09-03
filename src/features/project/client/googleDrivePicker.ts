"use client";

import { readApiError } from '@/infrastructure/http/clientResponses';
import {
  observeProviderBoundaryResponse,
  trackProviderBoundaryFailure,
} from '@/features/analytics/client/tracking';
import type { GoogleDrivePickerConfiguration } from '../model/googleDriveProject';

const GOOGLE_PICKER_SCRIPT_SRC = 'https://apis.google.com/js/api.js';

export interface GoogleDrivePickerItem {
  id: string;
  name: string;
  mimeType: string | null;
}

export interface GoogleDrivePickerRequest {
  title: string;
  mimeTypes?: readonly string[];
  includeFolders?: boolean;
  selectFolders?: boolean;
  multiselect?: boolean;
  initialFolderId?: string | null;
}

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
  enableFeature: (feature: string) => PickerBuilderInstance;
  setOAuthToken: (token: string) => PickerBuilderInstance;
  setContributorKey: (key: string) => PickerBuilderInstance;
  setAppId: (appId: string) => PickerBuilderInstance;
  setCallback: (callback: (response: PickerResponse) => void) => PickerBuilderInstance;
  setTitle: (title: string) => PickerBuilderInstance;
  build: () => PickerInstance;
};

type PickerNamespace = {
  DocsView: new () => DocsViewInstance;
  PickerBuilder: new () => PickerBuilderInstance;
  DocsViewMode: { LIST: string };
  Feature: { MULTISELECT_ENABLED: string };
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
  if (typeof window === 'undefined') throw new Error('Google Drive picking is available only in the browser.');
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

export const loadGoogleDrivePickerConfiguration = async (): Promise<GoogleDrivePickerConfiguration> => {
  const response = await observeProviderBoundaryResponse('google_drive', 'picker_config', () => (
    fetch('/api/project-sources/google-drive/picker-config', { cache: 'no-store' })
  ));
  if (!response.ok) throw await readApiError(response, 'Unable to prepare Google Drive selection.');
  return await response.json() as GoogleDrivePickerConfiguration;
};

export const pickGoogleDriveItems = async ({
  title,
  mimeTypes = [],
  includeFolders = false,
  selectFolders = false,
  multiselect = false,
  initialFolderId,
}: GoogleDrivePickerRequest): Promise<GoogleDrivePickerItem[] | null> => {
  const [picker, config] = await Promise.all([
    loadPickerLibrary().catch((error) => {
      trackProviderBoundaryFailure('google_drive', 'picker_load');
      throw error;
    }),
    loadGoogleDrivePickerConfiguration(),
  ]);

  return await new Promise<GoogleDrivePickerItem[] | null>((resolve, reject) => {
    let view = new picker.DocsView()
      .setIncludeFolders(includeFolders)
      .setSelectFolderEnabled(selectFolders)
      .setMode(picker.DocsViewMode.LIST);
    if (mimeTypes.length > 0) view = view.setMimeTypes(mimeTypes.join(','));
    const parentId = initialFolderId === undefined ? config.initialFolderId : initialFolderId;
    if (parentId) view = view.setParent(parentId);

    let builder = new picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(config.accessToken)
      .setContributorKey(config.contributorKey)
      .setAppId(config.appId)
      .setTitle(title)
      .setCallback((response) => {
        if (response.action === picker.Action.CANCEL) {
          resolve(null);
          return;
        }
        if (response.action === picker.Action.ERROR) {
          reject(new Error('Google Drive could not complete selection.'));
          return;
        }
        if (response.action !== picker.Action.PICKED) return;
        const selected = (response.docs ?? []).flatMap((document) => {
          const id = document.id?.trim() ?? '';
          const name = document.name?.trim() ?? '';
          if (!id || !name) return [];
          return [{ id, name, mimeType: document.mimeType?.trim() || null }];
        });
        if (selected.length === 0) {
          reject(new Error('Google Drive returned no usable selection.'));
          return;
        }
        resolve(selected);
      });
    if (multiselect) builder = builder.enableFeature(picker.Feature.MULTISELECT_ENABLED);
    builder.build().setVisible(true);
  });
};
