"use client";

import { ProjectPackageError } from '../lib/projectPackageCodec';
import { getScopedProjectStorageNamespace } from '../persistence/projectPersistenceScope';
import { useProjectStore } from '../store/workspaceStore';
import { decodeBrowserProjectFile } from './browserProjectPackage';
import { getLocalProjectWorkBinding } from './localProjectFolder';
import { applyProjectDocumentToWorkspace } from './projectWorkspaceDocument';

type PermissionAwareDirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<'granted' | 'denied' | 'prompt'>;
};

const LOCAL_PROJECT_FILE_NAME = 'project.cardforge';

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
  const expectedState = useProjectStore.getState();
  let file: File;
  try {
    file = await (await binding.handle.getFileHandle(LOCAL_PROJECT_FILE_NAME)).getFile();
  } catch (error) {
    throw new ProjectPackageError(error instanceof Error
      ? `The saved folder project is unavailable. ${error.message}`
      : 'The saved folder project is unavailable. Reconnect it before editing.');
  }
  if (getScopedProjectStorageNamespace('project-assets') !== namespace) {
    throw new ProjectPackageError('The browser account changed while opening the folder. No work was imported.');
  }
  const decoded = await decodeBrowserProjectFile(file);
  if (decoded.format !== 'cardforge-package' || !decoded.sourceRevision || decoded.document.cardSets.length !== 1) {
    throw new ProjectPackageError('This remembered folder no longer contains one current CardForge Set. Open it from Locations to review the source before editing.');
  }
  const portableSetId = decoded.document.cardSets[0]!.id;
  if (portableSetId !== workId) {
    throw new ProjectPackageError('The folder now contains a different Set identity. Open it from Locations to compare; existing browser work was left unchanged.');
  }
  const imported = await applyProjectDocumentToWorkspace(decoded.document, 'merge', { expectedState });
  if (getScopedProjectStorageNamespace('project-assets') !== namespace) {
    throw new ProjectPackageError('The browser account changed while opening the folder. Reload the correct account before editing.');
  }
  return { setId: imported.activeSetId ?? workId, sourceRevision: decoded.sourceRevision };
};
