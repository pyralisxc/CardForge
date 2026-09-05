"use client";

import {
  decodeProjectFile,
  ProjectPackageError,
  writeCardForgeProjectPackage,
} from '../lib/projectPackageCodec';
import { buildBrowserCardForgeProjectSnapshot, decodeBrowserProjectFile } from './browserProjectPackage';
import { CARDFORGE_PROJECT_FILE_EXTENSION, type ProjectSourceDescriptor } from '../model/projectPackage';
import { getProjectSourceConflict } from '../model/projectSourceConflict';
import { getScopedProjectStorageNamespace } from '../persistence/projectPersistenceScope';
import {
  readStructuredBrowserValue,
  removeStructuredBrowserValue,
  writeStructuredBrowserValue,
} from '../persistence/structuredBrowserStorage';
import { applyProjectDocumentToWorkspace, captureCardSetProjectDocument, captureCurrentProjectDocument } from './projectWorkspaceDocument';

const LOCAL_PROJECT_FILE_NAME = `project${CARDFORGE_PROJECT_FILE_EXTENSION}`;
const LOCAL_FOLDER_BINDING_KEY = 'local-project-folder-binding';
const LOCAL_WORK_FOLDER_BINDING_KEY = 'local-work-folder-binding';
const LOCAL_WORK_FOLDER_INDEX_KEY = 'local-work-folder-binding-index';

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
  workId?: string | null;
}

export interface LocalProjectFolderStatus {
  supported: boolean;
  binding: LocalProjectFolderBinding | null;
  permission: FileSystemPermissionState | 'unavailable';
  source: ProjectSourceDescriptor;
}

export interface LocalProjectWorkBindingStatus extends LocalProjectFolderBinding {
  workId: string;
  permission: FileSystemPermissionState | 'unavailable';
}

const getBindingStorageKey = () => (
  `${getScopedProjectStorageNamespace('project-assets')}:${LOCAL_FOLDER_BINDING_KEY}`
);

const getWorkBindingStorageKey = (workId: string) => (
  `${getScopedProjectStorageNamespace('project-assets')}:${LOCAL_WORK_FOLDER_BINDING_KEY}:${workId}`
);

const getWorkBindingIndexStorageKey = () => (
  `${getScopedProjectStorageNamespace('project-assets')}:${LOCAL_WORK_FOLDER_INDEX_KEY}`
);

const readWorkBindingIndex = async (): Promise<string[]> => {
  const current = await readStructuredBrowserValue<unknown>(getWorkBindingIndexStorageKey());
  if (current === null) return [];
  if (!Array.isArray(current) || !current.every((value) => typeof value === 'string')) {
    throw new ProjectPackageError('The saved folder index is unreadable. Existing folder links were left unchanged.');
  }
  return current;
};

const indexWorkBinding = async (workId: string): Promise<void> => {
  const ids = await readWorkBindingIndex();
  if (!ids.includes(workId)) await writeStructuredBrowserValue(getWorkBindingIndexStorageKey(), [...ids, workId]);
};

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
  await writeStructuredBrowserValue(getBindingStorageKey(), binding.workId ? { workId: binding.workId } : binding);
};

const readAttachedBinding = async (): Promise<LocalProjectFolderBinding | null> => {
  const attached = await readStructuredBrowserValue<LocalProjectFolderBinding | { workId: string }>(getBindingStorageKey());
  if (!attached?.workId) return attached as LocalProjectFolderBinding | null;
  const binding = await getLocalProjectWorkBinding(attached.workId);
  if (!binding) throw new ProjectPackageError('The attached Set folder is unavailable. Reopen the folder before saving; existing files were left unchanged.');
  return binding;
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
  workId?: string,
): Promise<LocalProjectFolderBinding> => {
  if (workId) await readWorkBindingIndex();
  await requireWritePermission(directory);
  const document = workId ? await captureCardSetProjectDocument(workId) : await captureCurrentProjectDocument();
  const snapshot = await buildBrowserCardForgeProjectSnapshot({ document, name: directory.name });
  if (existingBinding) {
    await assertLocalProjectFolderRevisionCurrent(directory, existingBinding);
  }
  const fileHandle = await directory.getFileHandle(LOCAL_PROJECT_FILE_NAME, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await writeCardForgeProjectPackage(snapshot, new WritableStream<Uint8Array>({
      write: async (chunk) => {
        const copy = new Uint8Array(chunk.byteLength);
        copy.set(chunk);
        await writable.write(copy);
      },
      close: () => writable.close(),
      abort: () => writable.abort(),
    }));
  } catch (error) {
    try { await writable.abort(); } catch { /* best effort */ }
    throw error;
  }
  const written = await fileHandle.getFile();
  const verified = await decodeProjectFile(written);
  if (verified.format !== 'cardforge-package' || verified.sourceRevision !== snapshot.manifest.projectRevision) {
    throw new ProjectPackageError('The local folder write could not be verified. The browser copy was left unchanged.');
  }
  const binding: LocalProjectFolderBinding = {
    ...(existingBinding ?? {}),
    handle: directory,
    folderName: directory.name,
    sourceRevision: snapshot.manifest.projectRevision,
    lastSavedAt: snapshot.manifest.savedAt,
    workId: workId ?? null,
  };
  if (workId) {
    await writeStructuredBrowserValue(getWorkBindingStorageKey(workId), binding);
    await indexWorkBinding(workId);
  }
  await persistBinding(binding);
  return binding;
};

export const assertLocalProjectFolderRevisionCurrent = async (
  directory: FileSystemDirectoryHandle,
  binding: LocalProjectFolderBinding,
): Promise<void> => {
  if (!binding.sourceRevision) {
    throw new ProjectPackageError('Reload this local-folder project before saving so CardForge can protect its exact revision. Existing folder work was left unchanged.');
  }

  let file: File;
  try {
    const fileHandle = await directory.getFileHandle(LOCAL_PROJECT_FILE_NAME);
    file = await fileHandle.getFile();
  } catch {
    throw new ProjectPackageError(`“${directory.name}” no longer contains the attached CardForge project. Existing folder contents were left unchanged.`);
  }

  let currentRevision: string | null = null;
  try {
    const decoded = await decodeProjectFile(file);
    currentRevision = decoded.format === 'cardforge-package' ? decoded.sourceRevision : null;
  } catch {
    throw new ProjectPackageError(`The CardForge project in “${directory.name}” is no longer readable. Existing folder work was left unchanged; open the folder copy to recover or compare it.`);
  }

  const conflict = getProjectSourceConflict({
    expected: { projectRevision: binding.sourceRevision },
    current: { projectRevision: currentRevision },
  });
  if (conflict) {
    throw new ProjectPackageError(`The CardForge project in “${directory.name}” changed after revision ${binding.sourceRevision.slice(0, 12)}. Open the folder copy before saving so newer authored work is not overwritten.`);
  }
};

export const isLocalProjectFolderSupported = (): boolean => (
  typeof window !== 'undefined' && typeof (window as DirectoryPickerWindow).showDirectoryPicker === 'function'
);

export const getLocalProjectFolderStatus = async (): Promise<LocalProjectFolderStatus> => {
  const supported = isLocalProjectFolderSupported();
  const binding = supported
    ? await readAttachedBinding()
    : null;
  const permission = binding ? await getPermission(binding.handle, false) : supported ? 'prompt' : 'unavailable';
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

export const saveCardSetToNewFolder = async ({ setId }: { setId: string }): Promise<LocalProjectFolderBinding> => {
  const directory = await chooseDirectory();
  await requireWritePermission(directory);
  if (await fileExists(directory, LOCAL_PROJECT_FILE_NAME)) {
    throw new ProjectPackageError(`“${directory.name}” already contains a CardForge project. Choose an empty folder so existing authored work is not overwritten.`);
  }
  return await writeSnapshotToDirectory(directory, null, setId);
};

export const getLocalProjectWorkBinding = async (workId: string): Promise<LocalProjectFolderBinding | null> => {
  const binding = await readStructuredBrowserValue<LocalProjectFolderBinding>(getWorkBindingStorageKey(workId));
  if (binding && (!binding.handle || typeof binding.handle.getFileHandle !== 'function')) {
    throw new ProjectPackageError('The saved Set folder is unreadable. Reopen the folder before saving.');
  }
  return binding;
};

export const listLocalProjectWorkBindings = async (): Promise<LocalProjectWorkBindingStatus[]> => {
  if (!isLocalProjectFolderSupported()) return [];
  const ids = await readWorkBindingIndex();
  const bindings = await Promise.all(ids.map(async (workId) => {
    const binding = await getLocalProjectWorkBinding(workId);
    if (!binding?.handle) return null;
    const permission = await getPermission(binding.handle, false);
    return { ...binding, workId, permission } satisfies LocalProjectWorkBindingStatus;
  }));
  return bindings.flatMap((binding) => binding ? [binding] : []);
};

export const saveCardSetToAttachedFolder = async (setId: string): Promise<LocalProjectFolderBinding> => {
  const binding = await getLocalProjectWorkBinding(setId);
  if (!binding?.handle) return await saveCardSetToNewFolder({ setId });
  return await writeSnapshotToDirectory(binding.handle, binding, setId);
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
  const decoded = await decodeBrowserProjectFile(file);
  if (decoded.format !== 'cardforge-package' || !decoded.sourceRevision) {
    throw new ProjectPackageError('The selected folder does not contain a current .cardforge project package.');
  }
  const imported = await applyProjectDocumentToWorkspace(decoded.document, 'copy');
  const binding: LocalProjectFolderBinding = {
    handle: directory,
    folderName: directory.name,
    sourceRevision: decoded.sourceRevision,
    lastSavedAt: file.lastModified ? new Date(file.lastModified).toISOString() : null,
    workId: decoded.document.cardSets.length === 1 ? imported.activeSetId : null,
  };
  if (binding.workId && decoded.document.cardSets.length === 1) {
    await writeStructuredBrowserValue(getWorkBindingStorageKey(binding.workId), binding);
    await indexWorkBinding(binding.workId);
  }
  await persistBinding(binding);
  return binding;
};

export const saveProjectToAttachedFolder = async (): Promise<LocalProjectFolderBinding> => {
  const binding = await readAttachedBinding();
  if (!binding?.handle) throw new ProjectPackageError('No local project folder is attached. Choose a folder first.');
  return await writeSnapshotToDirectory(binding.handle, binding, binding.workId ?? undefined);
};

export const reconnectAttachedProjectFolder = async (): Promise<LocalProjectFolderBinding> => {
  const binding = await readAttachedBinding();
  if (!binding?.handle) throw new ProjectPackageError('No local project folder is attached.');
  await requireWritePermission(binding.handle);
  await persistBinding(binding);
  return binding;
};

export const disconnectLocalProjectFolder = async (): Promise<void> => {
  const attached = await readAttachedBinding();
  if (!attached) return;
  const bindings = await listLocalProjectWorkBindings();
  const matching = await Promise.all(bindings.map(async (binding) => ({
    workId: binding.workId,
    matches: await attached.handle.isSameEntry(binding.handle),
  })));
  for (const binding of matching) {
    if (binding.matches) await removeStructuredBrowserValue(getWorkBindingStorageKey(binding.workId));
  }
  await writeStructuredBrowserValue(getWorkBindingIndexStorageKey(), matching.filter((binding) => !binding.matches).map((binding) => binding.workId));
  await removeStructuredBrowserValue(getBindingStorageKey());
};

export const getLocalProjectFileName = () => LOCAL_PROJECT_FILE_NAME;
