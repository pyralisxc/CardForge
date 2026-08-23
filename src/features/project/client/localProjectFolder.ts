"use client";

import {
  buildCardForgeProjectSnapshot,
  decodeProjectFile,
  encodeCardForgeProjectPackage,
  ProjectPackageError,
} from '../lib/projectPackageCodec';
import { CARDFORGE_PROJECT_FILE_EXTENSION, type ProjectSourceDescriptor } from '../model/projectPackage';
import { getScopedProjectStorageNamespace } from '../persistence/projectPersistenceScope';
import {
  readStructuredBrowserValue,
  removeStructuredBrowserValue,
  writeStructuredBrowserValue,
} from '../persistence/structuredBrowserStorage';
import { applyProjectDocumentToWorkspace, captureCurrentProjectDocument } from './projectWorkspaceDocument';

const LOCAL_PROJECT_FILE_NAME = `project${CARDFORGE_PROJECT_FILE_EXTENSION}`;
const LOCAL_FOLDER_BINDING_KEY = 'local-project-folder-binding';

type FileSystemPermissionMode = 'read' | 'readwrite';
type FileSystemPermissionState = 'granted' | 'denied' | 'prompt';

type PermissionAwareDirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission?: (options?: { mode?: FileSystemPermissionMode }) => Promise<FileSystemPermissionState>;
  requestPermission?: (options?: { mode?: FileSystemPermissionMode }) => Promise<FileSystemPermissionState>;
};

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: {
    id?: string;
    mode?: FileSystemPermissionMode;
    startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
  }) => Promise<FileSystemDirectoryHandle>;
};

export interface LocalProjectFolderBinding {
  handle: FileSystemDirectoryHandle;
  folderName: string;
  sourceRevision: string | null;
  lastSavedAt: string | null;
}

export interface LocalProjectFolderStatus {
  supported: boolean;
  binding: LocalProjectFolderBinding | null;
  permission: FileSystemPermissionState | 'unavailable';
  source: ProjectSourceDescriptor;
}

const getBindingStorageKey = () => (
  `${getScopedProjectStorageNamespace('project-assets')}:${LOCAL_FOLDER_BINDING_KEY}`
);

const getPermission = async (
  handle: FileSystemDirectoryHandle,
  request: boolean,
): Promise<FileSystemPermissionState> => {
  const permissionHandle = handle as PermissionAwareDirectoryHandle;
  if (!permissionHandle.queryPermission) return 'granted';
  const current = await permissionHandle.queryPermission({ mode: 'readwrite' });
  if (current === 'granted' || !request || !permissionHandle.requestPermission) return current;
  return await permissionHandle.requestPermission({ mode: 'readwrite' });
};

const persistBinding = async (binding: LocalProjectFolderBinding): Promise<void> => {
  await writeStructuredBrowserValue(getBindingStorageKey(), binding);
};

const requireWritePermission = async (handle: FileSystemDirectoryHandle): Promise<void> => {
  const permission = await getPermission(handle, true);
  if (permission !== 'granted') {
    throw new ProjectPackageError('CardForge needs read/write permission for this project folder. Choose the folder again and allow access.');
  }
};

const fileExists = async (directory: FileSystemDirectoryHandle, name: string): Promise<boolean> => {
  try {
    await directory.getFileHandle(name);
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') return false;
    throw error;
  }
};

const chooseDirectory = async (): Promise<FileSystemDirectoryHandle> => {
  if (typeof window === 'undefined') throw new ProjectPackageError('Local project folders are available only in the browser.');
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
  if (!picker) throw new ProjectPackageError('This browser does not support direct project-folder access. Use a .cardforge project file instead.');
  return await picker.call(window, { id: 'cardforge-project-folder', mode: 'readwrite', startIn: 'documents' });
};

const writeSnapshotToDirectory = async (
  directory: FileSystemDirectoryHandle,
  existingBinding?: LocalProjectFolderBinding | null,
): Promise<LocalProjectFolderBinding> => {
  await requireWritePermission(directory);
  const document = await captureCurrentProjectDocument();
  const snapshot = await buildCardForgeProjectSnapshot({ document, name: directory.name });
  const bytes = await encodeCardForgeProjectPackage(snapshot);
  const fileHandle = await directory.getFileHandle(LOCAL_PROJECT_FILE_NAME, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(new Blob([bytes], { type: 'application/vnd.cardforge.project+zip' }));
    await writable.close();
  } catch (error) {
    try { await writable.abort(); } catch { /* best effort */ }
    throw error;
  }
  const binding: LocalProjectFolderBinding = {
    handle: directory,
    folderName: directory.name,
    sourceRevision: snapshot.manifest.projectRevision,
    lastSavedAt: snapshot.manifest.savedAt,
    ...existingBinding,
    handle: directory,
    folderName: directory.name,
    sourceRevision: snapshot.manifest.projectRevision,
    lastSavedAt: snapshot.manifest.savedAt,
  };
  await persistBinding(binding);
  return binding;
};

export const isLocalProjectFolderSupported = (): boolean => (
  typeof window !== 'undefined' && typeof (window as DirectoryPickerWindow).showDirectoryPicker === 'function'
);

export const getLocalProjectFolderStatus = async (): Promise<LocalProjectFolderStatus> => {
  const supported = isLocalProjectFolderSupported();
  const binding = supported
    ? await readStructuredBrowserValue<LocalProjectFolderBinding>(getBindingStorageKey()).catch(() => null)
    : null;
  const permission = binding ? await getPermission(binding.handle, false).catch(() => 'denied' as const) : supported ? 'prompt' : 'unavailable';
  return {
    supported,
    binding,
    permission,
    source: {
      provider: binding ? 'local-folder' : 'browser',
      displayName: binding?.folderName ?? 'This browser',
      externalId: null,
      sourceRevision: binding?.sourceRevision ?? null,
      lastSavedAt: binding?.lastSavedAt ?? null,
      serverReachable: false,
    },
  };
};

export const saveCurrentProjectToNewFolder = async (): Promise<LocalProjectFolderBinding> => {
  const directory = await chooseDirectory();
  await requireWritePermission(directory);
  if (await fileExists(directory, LOCAL_PROJECT_FILE_NAME)) {
    throw new ProjectPackageError(`“${directory.name}” already contains a CardForge project. Open that project instead, or choose an empty folder to avoid overwriting it.`);
  }
  return await writeSnapshotToDirectory(directory);
};

export const openProjectFromFolder = async (): Promise<LocalProjectFolderBinding> => {
  const directory = await chooseDirectory();
  await requireWritePermission(directory);
  let fileHandle: FileSystemFileHandle;
  try {
    fileHandle = await directory.getFileHandle(LOCAL_PROJECT_FILE_NAME);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') {
      throw new ProjectPackageError(`“${directory.name}” does not contain ${LOCAL_PROJECT_FILE_NAME}. Choose a CardForge project folder or use “Save current project to folder” to create one.`);
    }
    throw error;
  }
  const file = await fileHandle.getFile();
  const decoded = await decodeProjectFile(file);
  if (decoded.format !== 'cardforge-package' || !decoded.sourceRevision) {
    throw new ProjectPackageError('The selected folder does not contain a current .cardforge project package.');
  }
  await applyProjectDocumentToWorkspace(decoded.document, 'replace');
  const binding: LocalProjectFolderBinding = {
    handle: directory,
    folderName: directory.name,
    sourceRevision: decoded.sourceRevision,
    lastSavedAt: file.lastModified ? new Date(file.lastModified).toISOString() : null,
  };
  await persistBinding(binding);
  return binding;
};

export const saveProjectToAttachedFolder = async (): Promise<LocalProjectFolderBinding> => {
  const binding = await readStructuredBrowserValue<LocalProjectFolderBinding>(getBindingStorageKey());
  if (!binding?.handle) throw new ProjectPackageError('No local project folder is attached. Choose a folder first.');
  return await writeSnapshotToDirectory(binding.handle, binding);
};

export const reconnectAttachedProjectFolder = async (): Promise<LocalProjectFolderBinding> => {
  const binding = await readStructuredBrowserValue<LocalProjectFolderBinding>(getBindingStorageKey());
  if (!binding?.handle) throw new ProjectPackageError('No local project folder is attached.');
  await requireWritePermission(binding.handle);
  await persistBinding(binding);
  return binding;
};

export const disconnectLocalProjectFolder = async (): Promise<void> => {
  await removeStructuredBrowserValue(getBindingStorageKey());
};

export const getLocalProjectFileName = () => LOCAL_PROJECT_FILE_NAME;
