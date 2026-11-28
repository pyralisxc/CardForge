"use client";

import {
  decodeProjectFile,
  decodeCardForgeProjectPackage,
  ProjectPackageError,
  writeCardForgeProjectPackage,
} from '../lib/projectPackageCodec';
import { buildBrowserCardForgeProjectSnapshot, decodeBrowserProjectFile, materializeBrowserProjectSnapshot } from './browserProjectPackage';
import { referenceCardForgeProjectSnapshotAssets } from '../lib/projectPackageAssetReferences';
import { getBrowserProjectAssetReference } from '../persistence/contentAddressedBrowserAssets';
import { CARDFORGE_PROJECT_FILE_EXTENSION, type ProjectSourceDescriptor } from '../model/projectPackage';
import { getProjectSourceConflict } from '../model/projectSourceConflict';
import { getScopedProjectStorageNamespace } from '../persistence/projectPersistenceScope';
import {
  readStructuredBrowserValue,
  removeStructuredBrowserValue,
  writeStructuredBrowserValue,
} from '../persistence/structuredBrowserStorage';
import { useProjectStore } from '../store/workspaceStore';
import { selectAllTemplates } from '../store/selectors';
import { mapProjectDocumentIdentity, type ProjectDocumentIdentityMap } from '../model/projectDocumentIdentity';
import { applyProjectDocumentToWorkspace, captureCardSetProjectDocument, captureCurrentProjectDocument } from './projectWorkspaceDocument';

const LOCAL_PROJECT_FILE_NAME = `project${CARDFORGE_PROJECT_FILE_EXTENSION}`;
const LOCAL_FOLDER_BINDING_KEY = 'local-project-folder-binding';
const LOCAL_WORK_FOLDER_BINDING_KEY = 'local-work-folder-binding';
const LOCAL_WORK_FOLDER_INDEX_KEY = 'local-work-folder-binding-index';
/** No duplicate state: views reread the owner after a confirmed binding change. */
export const LOCAL_PROJECT_FOLDER_CHANGE_EVENT = 'cardforge:local-folder-changed';
const notifyLocalProjectFolderChange = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(LOCAL_PROJECT_FOLDER_CHANGE_EVENT));
};

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
  workName?: string;
  packageScope?: 'set' | 'workspace';
  /** True only when CardForge wrote this exact file using the Set-only owner. */
  verifiedSetScope?: boolean;
  /** The original Set identity in the portable package, before browser import. */
  portableWorkId?: string;
  identities?: ProjectDocumentIdentityMap;
  /** Legacy folder links always refer to project.cardforge. */
  fileName?: string;
}

const folderFileName = (binding?: LocalProjectFolderBinding | null): string => binding?.fileName ?? LOCAL_PROJECT_FILE_NAME;

export class LocalFolderRevisionConflict extends ProjectPackageError {
  constructor(readonly reason: 'unverified' | 'changed') {
    super(reason === 'changed'
      ? 'This folder file changed and its newer scope cannot be confirmed. Save a new copy to keep it safe.'
      : 'CardForge cannot confirm this older folder file is a Set rather than a workspace backup. Save a new copy to keep it safe.');
  }
}

export class LocalFolderSavedSourceRetainedError extends ProjectPackageError {
  constructor(readonly saved: LocalProjectFolderBinding, cause: unknown) {
    super(`The folder copy was saved, but the device Set was kept. ${cause instanceof Error ? cause.message : 'Review the device work before retrying.'}`);
  }
}

export interface LocalProjectFolderStatus {
  supported: boolean;
  binding: LocalProjectFolderBinding | null;
  permission: FileSystemPermissionState | 'unavailable';
  readPermission: FileSystemPermissionState | 'unavailable';
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
  mode: FileSystemPermissionMode = 'readwrite',
): Promise<FileSystemPermissionState> => {
  const permissionHandle = handle as PermissionAwareDirectoryHandle;
  if (!permissionHandle.queryPermission) return 'granted';
  const current = await permissionHandle.queryPermission({ mode });
  if (current === 'granted' || !request || !permissionHandle.requestPermission) return current;
  return await permissionHandle.requestPermission({ mode });
};

const persistBinding = async (binding: LocalProjectFolderBinding, namespace: string): Promise<void> => {
  assertFolderScope(namespace);
  await writeStructuredBrowserValue(getBindingStorageKey(namespace), binding.workId ? { workId: binding.workId } : binding);
  assertFolderScope(namespace);
  notifyLocalProjectFolderChange();
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

const chooseDirectory = async (mode: FileSystemPermissionMode = 'readwrite'): Promise<FileSystemDirectoryHandle> => {
  if (typeof window === 'undefined') throw new ProjectPackageError('Local project folders are available only in the browser.');
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
  if (!picker) throw new ProjectPackageError('This browser does not support direct project-folder access. Use a .cardforge project file instead.');
  return await picker.call(window, { id: 'cardforge-project-folder', mode, startIn: 'documents' });
};

const writeSnapshotToDirectory = async (
  directory: FileSystemDirectoryHandle,
  existingBinding?: LocalProjectFolderBinding | null,
  workId?: string,
  namespace = getScopedProjectStorageNamespace('project-assets'),
  options: { fileName?: string; portableWorkId?: string; identities?: ProjectDocumentIdentityMap; expectedCurrentRevision?: string; asNew?: boolean; assertCurrent?: () => Promise<void> } = {},
): Promise<LocalProjectFolderBinding> => {
  assertFolderScope(namespace);
  if (workId) await readWorkBindingIndex(namespace);
  await requireWritePermission(directory);
  assertFolderScope(namespace);
  let document = workId ? await captureCardSetProjectDocument(workId) : await captureCurrentProjectDocument();
  if (workId && options.portableWorkId) {
    const identities = options.identities ?? {};
    identities.set = { ...identities.set, [options.portableWorkId]: workId };
    document = mapProjectDocumentIdentity(document, identities, 'save');
  }
  const snapshot = await buildBrowserCardForgeProjectSnapshot({ document, name: directory.name });
  if (existingBinding) {
    await assertLocalProjectFolderRevisionCurrent(directory, existingBinding, options.expectedCurrentRevision);
  }
  await options.assertCurrent?.();
  assertFolderScope(namespace);
  const fileName = options.fileName ?? folderFileName(existingBinding);
  if (options.asNew && await fileExists(directory, fileName)) throw new ProjectPackageError('A file with this name already exists. No folder file was replaced; try saving a new copy again.');
  const fileHandle = await directory.getFileHandle(fileName, { create: true });
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
  const binding: LocalProjectFolderBinding = {
    ...(existingBinding ?? {}),
    handle: directory,
    folderName: directory.name,
    sourceRevision: snapshot.manifest.projectRevision,
    lastSavedAt: snapshot.manifest.savedAt,
    workId: workId ?? null,
    packageScope: workId ? 'set' : 'workspace',
    ...(workId ? { workName: document.cardSets[0]?.name } : { workName: undefined }),
    ...(workId ? { verifiedSetScope: true } : { verifiedSetScope: undefined }),
    ...(workId ? { portableWorkId: options.portableWorkId ?? document.cardSets[0]?.id } : {}),
    ...(workId && options.identities ? { identities: options.identities } : {}),
    ...(fileName !== LOCAL_PROJECT_FILE_NAME ? { fileName } : { fileName: undefined }),
  };
  try {
    assertFolderScope(namespace);
    await options.assertCurrent?.();
    if (workId) {
      await writeStructuredBrowserValue(getWorkBindingStorageKey(workId, namespace), binding);
      await indexWorkBinding(workId, namespace);
    }
    await persistBinding(binding, namespace);
  } catch (error) {
    throw new LocalFolderSavedSourceRetainedError(binding, error);
  }
  return binding;
};

export const assertLocalProjectFolderRevisionCurrent = async (
  directory: FileSystemDirectoryHandle,
  binding: LocalProjectFolderBinding,
  expectedCurrentRevision?: string,
): Promise<void> => {
  if (!binding.sourceRevision) {
    throw new ProjectPackageError('Reload this local-folder project before saving so CardForge can protect its exact revision. Existing folder work was left unchanged.');
  }

  let file: File;
  try {
    const fileHandle = await directory.getFileHandle(folderFileName(binding));
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
    expected: { projectRevision: expectedCurrentRevision ?? binding.sourceRevision },
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
  const [permission, readPermission] = binding
    ? await Promise.all([getPermission(binding.handle, false), getPermission(binding.handle, false, 'read')])
    : [supported ? 'prompt' : 'unavailable', supported ? 'prompt' : 'unavailable'] as const;
  assertFolderScope(namespace);
  return {
    supported,
    binding,
    permission,
    readPermission,
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

/** List the remembered directory without requesting permission or touching its files. */
export const listLocalProjectFolderContents = async (binding: LocalProjectFolderBinding): Promise<Array<{ name: string; kind: 'file' | 'directory' }>> => {
  const namespace = getScopedProjectStorageNamespace('project-assets');
  const attached = await readAttachedBinding(namespace);
  if (!attached || !await attached.handle.isSameEntry(binding.handle)) throw new ProjectPackageError('The selected project folder changed. Refresh before listing its contents.');
  if (await getPermission(attached.handle, false, 'read') !== 'granted') throw new ProjectPackageError('Reconnect this folder to see its contents.');
  const directory = attached.handle as FileSystemDirectoryHandle & { values?: () => AsyncIterable<FileSystemHandle> };
  if (!directory.values) throw new ProjectPackageError('This browser cannot list the selected folder. Open it in your file manager.');
  const entries: Array<{ name: string; kind: 'file' | 'directory' }> = [];
  for await (const entry of directory.values()) entries.push({ name: entry.name, kind: entry.kind });
  assertFolderScope(namespace);
  const latest = await readAttachedBinding(namespace);
  if (!latest || !await latest.handle.isSameEntry(binding.handle)) throw new ProjectPackageError('The selected project folder changed. Refresh before listing its contents.');
  assertFolderScope(namespace);
  return entries.toSorted((a, b) => a.name.localeCompare(b.name));
};

export const saveCurrentProjectToNewFolder = async (): Promise<LocalProjectFolderBinding> => {
  const namespace = getScopedProjectStorageNamespace('project-assets');
  const directory = await chooseDirectory();
  return await serializeFolderSave(namespace, async () => {
  assertFolderScope(namespace);
  await requireWritePermission(directory);
  assertFolderScope(namespace);
  if (await fileExists(directory, LOCAL_PROJECT_FILE_NAME)) {
    throw new ProjectPackageError(`“${directory.name}” already contains a CardForge project. Open that project instead, or choose an empty folder to avoid overwriting it.`);
  }
  return await writeSnapshotToDirectory(directory, null, undefined, namespace);
  });
};

export const saveCardSetToNewFolder = async ({ setId }: { setId: string }, options: {
  requireUnlinked?: boolean;
  afterVerified?: (binding: LocalProjectFolderBinding) => Promise<void>;
} = {}): Promise<LocalProjectFolderBinding> => {
  if (options.afterVerified && (typeof navigator === 'undefined' || !navigator.locks?.request)) {
    throw new ProjectPackageError('This browser cannot safely coordinate a folder move between tabs. Save a folder copy and keep the device Set.');
  }
  const namespace = getScopedProjectStorageNamespace('project-assets');
  const directory = await chooseDirectory();
  return await serializeFolderSave(namespace, async () => {
  assertFolderScope(namespace);
  if (options.requireUnlinked && await getLocalProjectWorkBinding(setId, namespace)) {
    throw new ProjectPackageError('This Set was linked to a folder while choosing a destination. Review its location; no folder file was changed.');
  }
  await requireWritePermission(directory);
  assertFolderScope(namespace);
  if (await fileExists(directory, LOCAL_PROJECT_FILE_NAME)) {
    throw new ProjectPackageError(`“${directory.name}” already contains a CardForge project. Choose an empty folder so existing authored work is not overwritten.`);
  }
  const saved = await writeSnapshotToDirectory(directory, null, setId, namespace);
  if (options.afterVerified) {
    try { await options.afterVerified(saved); }
    catch (error) { throw new LocalFolderSavedSourceRetainedError(saved, error); }
  }
  return saved;
  });
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
    const permission = await getPermission(binding.handle, false, 'read');
    return { ...binding, workId, permission } satisfies LocalProjectWorkBindingStatus;
  }));
  assertFolderScope(namespace);
  return bindings.flatMap((binding) => binding ? [binding] : []);
};

const activeFolderSaves = new Map<string, Promise<unknown>>();
const serializeFolderSave = async <T>(namespace: string, save: () => Promise<T>): Promise<T> => {
  const key = 'cardforge-local-folder';
  const run = async () => {
    const prior = activeFolderSaves.get(key);
    const pending = (async () => { if (prior) await prior.catch(() => {}); assertFolderScope(namespace); return await save(); })();
    activeFolderSaves.set(key, pending);
    try { return await pending; } finally { if (activeFolderSaves.get(key) === pending) activeFolderSaves.delete(key); }
  };
  return typeof navigator !== 'undefined' && navigator.locks?.request
    ? await navigator.locks.request(key, run)
    : await run();
};

export const saveCardSetToAttachedFolder = async (setId: string, expectedBinding?: LocalProjectFolderBinding, options: {
  asNew?: boolean;
  afterVerified?: (binding: LocalProjectFolderBinding) => Promise<void>;
  requireSelected?: boolean;
} = {}): Promise<LocalProjectFolderBinding> => {
  if (options.afterVerified && (typeof navigator === 'undefined' || !navigator.locks?.request)) {
    throw new ProjectPackageError('This browser cannot safely coordinate a folder move between tabs. Save a folder copy and keep the device Set.');
  }
  const namespace = getScopedProjectStorageNamespace('project-assets');
  if (!expectedBinding && !await getLocalProjectWorkBinding(setId, namespace)) return await saveCardSetToNewFolder({ setId }, { requireUnlinked: true, afterVerified: options.afterVerified });
  return await serializeFolderSave(namespace, async () => {
    const binding = await getLocalProjectWorkBinding(setId, namespace);
    assertFolderScope(namespace);
    if (expectedBinding && (!binding?.handle || binding.sourceRevision !== expectedBinding.sourceRevision
      || binding.workId !== expectedBinding.workId || binding.packageScope !== expectedBinding.packageScope || binding.verifiedSetScope !== expectedBinding.verifiedSetScope || binding.portableWorkId !== expectedBinding.portableWorkId
      || folderFileName(binding) !== folderFileName(expectedBinding) || !await binding.handle.isSameEntry(expectedBinding.handle))) {
      throw new ProjectPackageError('The linked folder changed or is unavailable. Check its location before saving; browser work was left unchanged.');
    }
    assertFolderScope(namespace);
    if (!binding?.handle) throw new ProjectPackageError('The linked folder changed or is unavailable. The device Set remains unchanged.');
    await readWorkBindingIndex(namespace);
    const ensureBindingCurrent = async () => {
      const current = await getLocalProjectWorkBinding(setId, namespace);
      const attached = await readAttachedBinding(namespace);
      assertFolderScope(namespace);
      if (!current || current.sourceRevision !== binding.sourceRevision || current.workId !== binding.workId || current.packageScope !== binding.packageScope || current.verifiedSetScope !== binding.verifiedSetScope || current.portableWorkId !== binding.portableWorkId || folderFileName(current) !== folderFileName(binding)
        || !await current.handle.isSameEntry(binding.handle)
        || (options.requireSelected && (!attached || attached.workId !== setId || !await attached.handle.isSameEntry(binding.handle)))) {
        throw new ProjectPackageError('The selected folder link changed. The device Set remains available; check the folder before retrying.');
      }
      assertFolderScope(namespace);
    };
    await ensureBindingCurrent();
    let portableWorkId: string;
    let revision: string | undefined;
    if (options.asNew) {
      portableWorkId = `set-${globalThis.crypto.randomUUID()}`;
    } else {
      if (binding.packageScope === 'workspace') throw new ProjectPackageError('This folder contains a workspace backup, not a Set copy. The backup was left unchanged.');
      if (!binding.verifiedSetScope) throw new LocalFolderRevisionConflict('unverified');
      const fileHandle = await binding.handle.getFileHandle(folderFileName(binding));
      const decoded = await decodeProjectFile(await fileHandle.getFile());
      if (decoded.format !== 'cardforge-package' || !decoded.sourceRevision || decoded.document.cardSets.length !== 1) {
        throw new ProjectPackageError('This folder file is not a verified single-Set package. It was left unchanged.');
      }
      portableWorkId = decoded.document.cardSets[0]!.id;
      if (binding.portableWorkId && binding.portableWorkId !== portableWorkId) {
        throw new ProjectPackageError('This folder file contains a different Set. It was left unchanged; save a new copy instead.');
      }
      if (!binding.portableWorkId && decoded.sourceRevision !== binding.sourceRevision) {
        throw new LocalFolderRevisionConflict('changed');
      }
      if (decoded.sourceRevision !== binding.sourceRevision) throw new LocalFolderRevisionConflict('changed');
      revision = decoded.sourceRevision;
    }
    const fileName = options.asNew ? `project-${globalThis.crypto.randomUUID()}${CARDFORGE_PROJECT_FILE_EXTENSION}` : folderFileName(binding);
    const identities = options.asNew ? {} : structuredClone(binding.identities ?? {});
    const saved = await writeSnapshotToDirectory(binding.handle, options.asNew ? null : binding, setId, namespace, {
      fileName, portableWorkId, identities, expectedCurrentRevision: revision, asNew: options.asNew, assertCurrent: ensureBindingCurrent,
    });
    if (options.afterVerified) {
      try {
        const current = await getLocalProjectWorkBinding(setId, namespace);
        const attached = await readAttachedBinding(namespace);
        assertFolderScope(namespace);
        if (!current || current.sourceRevision !== saved.sourceRevision || folderFileName(current) !== folderFileName(saved)
          || !await current.handle.isSameEntry(saved.handle)
          || (options.requireSelected && (!attached || attached.workId !== setId || !await attached.handle.isSameEntry(saved.handle)))) {
          throw new ProjectPackageError('The folder link changed after saving. Review the saved copy before removing device work.');
        }
        await assertLocalProjectFolderRevisionCurrent(saved.handle, saved);
        assertFolderScope(namespace);
        await options.afterVerified(saved);
      }
      catch (error) { throw new LocalFolderSavedSourceRetainedError(saved, error); }
    }
    return saved;
  });
};

const openProjectDirectory = async (
  directory: FileSystemDirectoryHandle,
  namespace: string,
  expectedState: ReturnType<typeof useProjectStore.getState>,
  remembered?: LocalProjectFolderBinding & { workId: string },
  preserveActiveSet = false,
  assertCurrent?: () => void,
): Promise<LocalProjectFolderBinding> => {
  assertFolderScope(namespace);
  let fileHandle: FileSystemFileHandle;
  try {
    fileHandle = await directory.getFileHandle(folderFileName(remembered));
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') {
      throw new ProjectPackageError(`“${directory.name}” does not contain ${LOCAL_PROJECT_FILE_NAME}. Choose the saved project folder; use “Save workspace backup to folder” to create a new backup.`);
    }
    throw error;
  }
  const file = await fileHandle.getFile();
  assertFolderScope(namespace);
  if (remembered) {
    // Decode and verify the archive once, then inspect its exact source revision
    // before materializing any assets into this account's browser workspace.
    const snapshot = await decodeCardForgeProjectPackage(file);
    assertFolderScope(namespace);
    const inspected = referenceCardForgeProjectSnapshotAssets(snapshot, (asset) => getBrowserProjectAssetReference(asset.id));
    if (inspected.cardSets.length !== 1) {
      throw new ProjectPackageError('This remembered folder no longer contains one current CardForge Set. Browser and folder work were left unchanged.');
    }
    if (!remembered.sourceRevision || snapshot.manifest.projectRevision !== remembered.sourceRevision) {
      throw new ProjectPackageError('The folder has changed or its saved revision is unavailable. Browser and folder work were left unchanged. Back up both copies before comparing them; do not save over the folder.');
    }
    if (remembered.portableWorkId && remembered.portableWorkId !== inspected.cardSets[0]!.id) {
      throw new ProjectPackageError('This folder file contains a different Set. Browser and folder work were left unchanged.');
    }
    if (useProjectStore.getState().cardSets.some((set) => set.id === remembered.workId)) return remembered;
    if (typeof navigator === 'undefined' || !navigator.locks?.request) {
      throw new ProjectPackageError('This browser cannot safely coordinate opening this linked folder Set across tabs. Your folder and device work remain unchanged.');
    }
    const importedDocument = await materializeBrowserProjectSnapshot(snapshot);
    assertFolderScope(namespace);
    // Reuse the shared mapping across tabs; replacing it would make a tab
    // that already opened this Set unable to restore its portable identities.
    const identities: ProjectDocumentIdentityMap = structuredClone(remembered.identities ?? {});
    identities.set = { ...identities.set, [importedDocument.cardSets[0]!.id]: remembered.workId };
    const document = mapProjectDocumentIdentity(importedDocument, identities, 'open');
    const existingTemplateIds = new Set(selectAllTemplates(expectedState).map((template) => template.id));
    if (document.userTemplates.some((template) => template.id && existingTemplateIds.has(template.id))) {
      throw new ProjectPackageError('This folder Set shares a Template identity with other device work. Open the Set file as an independent copy instead; the folder and device work remain unchanged.');
    }
    // Persist the inverse mapping before publishing remapped work into the
    // workspace, so a later save cannot silently replace portable identities.
    const mappedBinding = { ...remembered, identities };
    await writeStructuredBrowserValue(getWorkBindingStorageKey(remembered.workId, namespace), mappedBinding);
    assertFolderScope(namespace);
    await applyProjectDocumentToWorkspace(document, 'merge', { expectedState, preserveOutputPreferences: true, ...(preserveActiveSet ? { preserveActiveSet: true } : {}), ...(assertCurrent ? { assertCurrent } : {}) });
    assertFolderScope(namespace);
    return mappedBinding;
  }
  const inspected = await decodeProjectFile(file);
  assertFolderScope(namespace);
  if (inspected.format !== 'cardforge-package' || !inspected.sourceRevision) {
    throw new ProjectPackageError('The selected folder does not contain a current .cardforge project package.');
  }
  const decoded = await decodeBrowserProjectFile(file);
  assertFolderScope(namespace);
  const imported = await applyProjectDocumentToWorkspace(decoded.document, 'copy', { expectedState });
  assertFolderScope(namespace);
  const binding: LocalProjectFolderBinding = {
    handle: directory,
    folderName: directory.name,
    sourceRevision: decoded.sourceRevision,
    lastSavedAt: file.lastModified ? new Date(file.lastModified).toISOString() : null,
    workId: decoded.document.cardSets.length === 1 ? imported.activeSetId : null,
    packageScope: decoded.document.cardSets.length === 1 ? 'set' : 'workspace',
    ...(decoded.document.cardSets.length === 1 ? { workName: decoded.document.cardSets[0]!.name } : {}),
    ...(decoded.document.cardSets.length === 1 ? { portableWorkId: decoded.document.cardSets[0]!.id } : {}),
  };
  if (binding.workId && decoded.document.cardSets.length === 1) {
    await writeStructuredBrowserValue(getWorkBindingStorageKey(binding.workId, namespace), binding);
    await indexWorkBinding(binding.workId, namespace);
  }
  await persistBinding(binding, namespace);
  return binding;
};

export const openRememberedLocalProject = async (workId: string, options: { preserveActiveSet?: boolean; assertCurrent?: () => void } = {}): Promise<{ setId: string; sourceRevision: string }> => {
  const namespace = getScopedProjectStorageNamespace('project-assets');
  return await serializeFolderSave(namespace, async () => {
  const expectedState = useProjectStore.getState();
  const binding = await getLocalProjectWorkBinding(workId, namespace);
  assertFolderScope(namespace);
  if (!binding?.handle) throw new ProjectPackageError('This folder link is unavailable. Choose Open project folder in Library → Locations to reconnect it.');
  const permission = await getPermission(binding.handle, false, 'read');
  assertFolderScope(namespace);
  if (permission !== 'granted') {
    throw new ProjectPackageError('This folder needs read permission again. Choose Reconnect folder or Open project folder in Library → Locations; CardForge will not request access in the background.');
  }
  const opened = await openProjectDirectory(binding.handle, namespace, expectedState, { ...binding, workId }, options.preserveActiveSet, options.assertCurrent);
  return { setId: workId, sourceRevision: opened.sourceRevision! };
  });
};

export const openProjectFromFolder = async (): Promise<LocalProjectFolderBinding> => {
  const expectedState = useProjectStore.getState();
  const namespace = getScopedProjectStorageNamespace('project-assets');
  const directory = await chooseDirectory('read');
  return await serializeFolderSave(namespace, async () => {
  assertFolderScope(namespace);
  // A picker open is a user gesture; reading must not require write access.
  if (await getPermission(directory, false, 'read') !== 'granted') {
    throw new ProjectPackageError('The selected folder did not grant read access. Choose it again to open the saved Set.');
  }
  assertFolderScope(namespace);
  const matches: Array<LocalProjectFolderBinding & { workId: string }> = [];
  for (const workId of await readWorkBindingIndex(namespace)) {
    const binding = await getLocalProjectWorkBinding(workId, namespace);
    if (binding && await directory.isSameEntry(binding.handle)) matches.push({ ...binding, workId });
    assertFolderScope(namespace);
  }
  if (matches.length > 1) {
    throw new ProjectPackageError('More than one browser Set is linked to this folder. Open the intended Set from Desk or Library; no work was changed.');
  }
  const opened = await openProjectDirectory(directory, namespace, expectedState, matches[0]);
  if (matches[0]) {
    await persistBinding(opened, namespace);
    assertFolderScope(namespace);
  }
  return opened;
  });
};

export const saveProjectToAttachedFolder = async (): Promise<LocalProjectFolderBinding> => {
  const namespace = getScopedProjectStorageNamespace('project-assets');
  const binding = await readAttachedBinding(namespace);
  assertFolderScope(namespace);
  if (!binding?.handle) throw new ProjectPackageError('No local project folder is attached. Choose a folder first.');
  if (!binding.workId && binding.packageScope !== 'workspace') {
    throw new ProjectPackageError('Reopen this folder before saving so CardForge can verify whether it contains one Set or a workspace backup. Existing files were left unchanged.');
  }
  if (binding.workId) return await saveCardSetToAttachedFolder(binding.workId, binding);
  return await serializeFolderSave(namespace, async () => {
    const current = await readAttachedBinding(namespace);
    assertFolderScope(namespace);
    if (!current || current.workId || current.packageScope !== 'workspace' || current.sourceRevision !== binding.sourceRevision || !await current.handle.isSameEntry(binding.handle)) {
      throw new ProjectPackageError('The attached folder changed. The workspace backup was left unchanged.');
    }
    return await writeSnapshotToDirectory(current.handle, current, undefined, namespace);
  });
};

export const reconnectAttachedProjectFolder = async (presentedHandle?: FileSystemDirectoryHandle): Promise<LocalProjectFolderBinding> => {
  const namespace = getScopedProjectStorageNamespace('project-assets');
  // The panel already has this handle. Request permission before awaiting IDB,
  // so the browser still sees the explicit click's transient user activation.
  if (presentedHandle) await requireWritePermission(presentedHandle);
  return await serializeFolderSave(namespace, async () => {
  assertFolderScope(namespace);
  const binding = await readAttachedBinding(namespace);
  assertFolderScope(namespace);
  if (!binding?.handle) throw new ProjectPackageError('No local project folder is attached.');
  if (presentedHandle) {
    if (!await presentedHandle.isSameEntry(binding.handle)) {
      throw new ProjectPackageError('The selected folder changed while reconnecting. No folder binding was changed.');
    }
  } else {
    await requireWritePermission(binding.handle);
  }
  assertFolderScope(namespace);
  await persistBinding(binding, namespace);
  return binding;
  });
};

export const disconnectLocalProjectFolder = async (): Promise<void> => {
  const namespace = getScopedProjectStorageNamespace('project-assets');
  return await serializeFolderSave(namespace, async () => {
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
  assertFolderScope(namespace);
  notifyLocalProjectFolderChange();
  });
};

export const getLocalProjectFileName = () => LOCAL_PROJECT_FILE_NAME;
