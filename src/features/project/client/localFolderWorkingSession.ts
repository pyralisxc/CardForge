"use client";

import { decodeProjectFile, ProjectPackageError } from '../lib/projectPackageCodec';
import { getScopedProjectStorageNamespace } from '../persistence/projectPersistenceScope';
import { useProjectStore } from '../store/workspaceStore';
import { getLocalProjectFileName, getLocalProjectWorkBinding } from './localProjectFolder';

type PermissionAwareDirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<'granted' | 'denied' | 'prompt'>;
};

/**
 * Continue a remembered, already-authorized folder-backed Set without opening
 * another picker or manufacturing an independent copy. Permission prompts stay
 * user-triggered in Locations; this path only uses an existing grant.
 */
export const openRememberedLocalProject = async (workId: string): Promise<{ setId: string; sourceRevision: string }> => {
  const namespace = getScopedProjectStorageNamespace('project-assets');
  const binding = await getLocalProjectWorkBinding(workId, namespace);
  if (!binding?.handle) throw new ProjectPackageError('This folder link is unavailable. Reconnect it in Library → Locations.');
  const permissionHandle = binding.handle as PermissionAwareDirectoryHandle;
  const permission = permissionHandle.queryPermission
    ? await permissionHandle.queryPermission({ mode: 'readwrite' })
    : 'granted';
  if (permission !== 'granted') {
    throw new ProjectPackageError('This folder needs permission again. Reconnect it in Library → Locations; CardForge will not request access in the background.');
  }
  let file: File;
  try {
    file = await (await binding.handle.getFileHandle(getLocalProjectFileName())).getFile();
  } catch (error) {
    throw new ProjectPackageError(error instanceof Error
      ? `The saved folder project is unavailable. ${error.message}`
      : 'The saved folder project is unavailable. Reconnect it before editing.');
  }
  if (getScopedProjectStorageNamespace('project-assets') !== namespace) {
    throw new ProjectPackageError('The browser account changed while opening the folder. No work was imported.');
  }
  // Inspection must not materialize package assets into the browser workspace.
  const decoded = await decodeProjectFile(file);
  if (getScopedProjectStorageNamespace('project-assets') !== namespace) {
    throw new ProjectPackageError('The browser account changed while opening the folder. No work was imported.');
  }
  if (decoded.format !== 'cardforge-package' || !decoded.sourceRevision || decoded.document.cardSets.length !== 1) {
    throw new ProjectPackageError('This remembered folder no longer contains one current CardForge Set. Browser and folder work were left unchanged. Back up both copies before reviewing the folder in a separate browser profile.');
  }
  if (!binding.sourceRevision || decoded.sourceRevision !== binding.sourceRevision) {
    throw new ProjectPackageError('The folder has changed or its saved revision is unavailable. Browser and folder work were left unchanged. Back up both copies before comparing them; do not save over the folder.');
  }
  if (!useProjectStore.getState().cardSets.some((set) => set.id === workId)) {
    throw new ProjectPackageError('The remembered browser copy is missing. The folder and other browser work were left unchanged. Back up your browser work and the folder before opening the folder copy in a separate browser profile.');
  }
  // The binding identifies the runtime Set; the package's portable ID may differ.
  // Never merge a package here: browser edits and shared assets may have changed.
  return { setId: workId, sourceRevision: binding.sourceRevision };
};
