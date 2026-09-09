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
import { useProjectStore } from '../store/workspaceStore';
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
  packageScope?: 'set' | 'workspace';
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

const assertFolderScope = (namespace: string) => {
  if (getScopedProjectStorageNamespace('project-assets') !== namespace) throw new ProjectPackageError('The browser account changed during the folder action. Check the selected folder before retrying; account bindings were not transferred.');
};

const getBindingStorageKey = (namespace = getScopedProjectStorageNamespace('project-assets')) => (
  `${namespace}:${LOCAL_FOLDER_BINDING_KEY}`
);

const getWorkBindingStorageKey = (workId: string, namespace = getScopedProjectStorageNamespace('project-assets')) => (
  `${namespace}:${LOCAL_WORK_FOLDER_BINDING_KEY}:${workId}`
);

const getWorkBindingIndexStorageKey = (namespace = getScopedProjectStorageNamespace('project-assets')) => (
  `${namespace}:${LOCAL_WORK_FOLDER_INDEX_KEY}`
);

const readWorkBindingIndex = async (namespace = getScopedProjectStorageNamespace('project-assets')): Promise<string[]> => {
  const current = await readStructuredBrowserValue<unknown>(getWorkBindingIndexStorageKey(namespace));
  if (current === null) return [];
  if (!Array.isArray(current) || !current.every((value) => typeof value === 'string')) {
    throw new ProjectPackageError('The saved folder index is unreadable. Existing folder links were left unchanged.');
  }
  return current;
};

const indexWorkBinding = async (workId: string, namespace: string): Promise<void> => {
  const ids = await readWorkBindingIndex(namespace);
  assertFolderScope(namespace);
  if (!ids.includes(workId)) await writeStructuredBrowserValue(getWorkBindingIndexStorageKey(namespace), [...ids, workId]);
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

const persistBinding = async (binding: LocalProjectFolderBinding, namespace: string): Promise<void> => {
  assertFolderScope(namespace);
  await writeStructuredBrowserValue(getBindingStorageKey(namespace), binding.workId ? { workId: binding.workId } : binding);
};

const readAttachedBinding = async (namespace: string): Promise<LocalProjectFolderBinding | null> => {
  const attached = await readStructuredBrowserValue<LocalProjectFolderBinding | { workId: string }>(getBindingStorageKey(namespace));
  if (!attached?.workId) return attached as LocalProjectFolderBinding | null;
  const binding = await getLocalProjectWorkBinding(attached.workId, namespace);
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
  namespace = getScopedProjectStorageNamespace('project-assets'),
): Promise<LocalProjectFolderBinding> => {
  assertFolderScope(namespace);
  if (workId) await readWorkBindingIndex(namespace);
  await requireWritePermission(directory);
  assertFolderScope(namespace);
  const document = workId ? await captureCardSetProjectDocument(workId) : await captureCurrentProjectDocument();
  const snapshot = await buildBrowserCardForgeProjectSnapshot({ document, name: directory.name });
  if (existingBinding) {
    await assertLocalProjectFolderRevisionCurrent(directory, existingBinding);
  }
  assertFolderScope(namespace);
  const fileHandle = await directory.getFileHandle(LOCAL_PROJECT_FILE_NAME, { create: true });
  assertFolderScope(namespace);
  const writable = await fileHandle.createWritable();
  try {
    await writeCardForgeProjectPackage(snapshot, new WritableStream<Uint8Array>({
      write: async (chunk) => {
        assertFolderScope(namespace);
        const copy = new Uint8Array(chunk.byteLength);
        copy.set(chunk);
        await writable.write(copy);
      },
      close: () => { assertFolderScope(namespace); return writable.close(); },
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
  assertFolderScope(namespace);
  const binding: LocalProjectFolderBinding = {
    ...(existingBinding ?? {}),
    handle: directory,
    folderName: directory.name,
    sourceRevision: snapshot.manifest.projectRevision,
    lastSavedAt: snapshot.manifest.savedAt,
    workId: workId ?? null,
    packageScope: workId ? 'set' : 'workspace',
  };
  if (workId) {
    await writeStructuredBrowserValue(getWorkBindingStorageKey(workId, namespace), binding);
    await indexWorkBinding(workId, namespace);
  }
  await persistBinding(binding, namespace);
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
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'NotFoundError')) {
      throw new ProjectPackageError(`The CardForge project in “${directory.name}” is unavailable. Check folder access before retrying; existing files were left unchanged.`);
    }
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
  const namespace = getScopedProjectStorageNamespace('project-assets');
  const supported = isLocalProjectFolderSupported();
  const binding = supported
    ? await readAttachedBinding(namespace)
    : null;
  const permission = binding ? await getPermission(binding.handle, false) : supported ? 'prompt' : 'unavailable';
  assertFolderScope(namespace);
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
  const namespace = getScopedProjectStorageNamespace('project-assets');
  const directory = await chooseDirectory();
  assertFolderScope(namespace);
  await requireWritePermission(directory);
  assertFolderScope(namespace);
  if (await fileExists(directory, LOCAL_PROJECT_FILE_NAME)) {
    throw new ProjectPackageError(`“${directory.name}” already contains a CardForge project. Open that project instead, or choose an empty folder to avoid overwriting it.`);
  }
  return await writeSnapshotToDirectory(directory, null, undefined, namespace);
};

export const saveCardSetToNewFolder = async ({ setId }: { setId: string }): Promise<LocalProjectFolderBinding> => {
  const namespace = getScopedProjectStorageNamespace('project-assets');
  const directory = await chooseDirectory();
  assertFolderScope(namespace);
  await requireWritePermission(directory);
  assertFolderScope(namespace);
  if (await fileExists(directory, LOCAL_PROJECT_FILE_NAME)) {
    throw new ProjectPackageError(`“${directory.name}” already contains a CardForge project. Choose an empty folder so existing authored work is not overwritten.`);
  }
  return await writeSnapshotToDirectory(directory, null, setId, namespace);
};

export const getLocalProjectWorkBinding = async (workId: string, namespace = getScopedProjectStorageNamespace('project-assets')): Promise<LocalProjectFolderBinding | null> => {
  const binding = await readStructuredBrowserValue<LocalProjectFolderBinding>(getWorkBindingStorageKey(workId, namespace));
  if (binding && (!binding.handle || typeof binding.handle.getFileHandle !== 'function')) {
    throw new ProjectPackageError('The saved Set folder is unreadable. Reopen the folder before saving.');
  }
  return binding;
};

export const listLocalProjectWorkBindings = async (): Promise<LocalProjectWorkBindingStatus[]> => {
  const namespace = getScopedProjectStorageNamespace('project-assets');
  if (!isLocalProjectFolderSupported()) return [];
  const ids = await readWorkBindingIndex(namespace);
  const bindings = await Promise.all(ids.map(async (workId) => {
    const binding = await getLocalProjectWorkBinding(workId, namespace);
    if (!binding?.handle) return null;
    const permission = await getPermission(binding.handle, false);
    return { ...binding, workId, permission } satisfies LocalProjectWorkBindingStatus;
  }));
  assertFolderScope(namespace);
  return bindings.flatMap((binding) => binding ? [binding] : []);
};

export const saveCardSetToAttachedFolder = async (setId: string): Promise<LocalProjectFolderBinding> => {
  const namespace = getScopedProjectStorageNamespace('project-assets');
  const binding = await getLocalProjectWorkBinding(setId, namespace);
  assertFolderScope(namespace);
  if (!binding?.handle) return await saveCardSetToNewFolder({ setId });
  return await writeSnapshotToDirectory(binding.handle, binding, setId, namespace);
};

export const openProjectFromFolder = async (): Promise<LocalProjectFolderBinding> => {
  const expectedState = useProjectStore.getState();
  const namespace = getScopedProjectStorageNamespace('project-assets');
  const directory = await chooseDirectory();
  assertFolderScope(namespace);
  await requireWritePermission(directory);
  assertFolderScope(namespace);
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
  assertFolderScope(namespace);
  const decoded = await decodeBrowserProjectFile(file);
  assertFolderScope(namespace);
  if (decoded.format !== 'cardforge-package' || !decoded.sourceRevision) {
    throw new ProjectPackageError('The selected folder does not contain a current .cardforge project package.');
  }
  const imported = await applyProjectDocumentToWorkspace(decoded.document, 'copy', { expectedState });
  assertFolderScope(namespace);
  const binding: LocalProjectFolderBinding = {
    handle: directory,
    folderName: directory.name,
    sourceRevision: decoded.sourceRevision,
    lastSavedAt: file.lastModified ? new Date(file.lastModified).toISOString() : null,
    workId: decoded.document.cardSets.length === 1 ? imported.activeSetId : null,
    packageScope: decoded.document.cardSets.length === 1 ? 'set' : 'workspace',
  };
  if (binding.workId && decoded.document.cardSets.length === 1) {
    await writeStructuredBrowserValue(getWorkBindingStorageKey(binding.workId, namespace), binding);
    await indexWorkBinding(binding.workId, namespace);
  }
  await persistBinding(binding, namespace);
  return binding;
};

export const saveProjectToAttachedFolder = async (): Promise<LocalProjectFolderBinding> => {
  const namespace = getScopedProjectStorageNamespace('project-assets');
  const binding = await readAttachedBinding(namespace);
  assertFolderScope(namespace);
  if (!binding?.handle) throw new ProjectPackageError('No local project folder is attached. Choose a folder first.');
  if (!binding.workId && binding.packageScope !== 'workspace') {
    throw new ProjectPackageError('Reopen this folder before saving so CardForge can verify whether it contains one Set or a workspace backup. Existing files were left unchanged.');
  }
  return await writeSnapshotToDirectory(binding.handle, binding, binding.workId ?? undefined, namespace);
};

export const reconnectAttachedProjectFolder = async (): Promise<LocalProjectFolderBinding> => {
  const namespace = getScopedProjectStorageNamespace('project-assets');
  const binding = await readAttachedBinding(namespace);
  assertFolderScope(namespace);
  if (!binding?.handle) throw new ProjectPackageError('No local project folder is attached.');
  await requireWritePermission(binding.handle);
  await persistBinding(binding, namespace);
  return binding;
};

export const disconnectLocalProjectFolder = async (): Promise<void> => {
  const namespace = getScopedProjectStorageNamespace('project-assets');
  const attached = await readAttachedBinding(namespace);
  assertFolderScope(namespace);
  if (!attached) return;
  const bindings = await listLocalProjectWorkBindings();
  const matching = await Promise.all(bindings.map(async (binding) => ({
    workId: binding.workId,
    matches: await attached.handle.isSameEntry(binding.handle),
  })));
  assertFolderScope(namespace);
  for (const binding of matching) {
    if (binding.matches) await removeStructuredBrowserValue(getWorkBindingStorageKey(binding.workId, namespace));
  }
  await writeStructuredBrowserValue(getWorkBindingIndexStorageKey(namespace), matching.filter((binding) => !binding.matches).map((binding) => binding.workId));
  await removeStructuredBrowserValue(getBindingStorageKey(namespace));
};

export const getLocalProjectFileName = () => LOCAL_PROJECT_FILE_NAME;
