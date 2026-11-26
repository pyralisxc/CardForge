import { getProjectPersistenceScope } from '../persistence/projectPersistenceScope';
import { useProjectStore } from '../store/workspaceStore';
import { openGoogleDriveProject, type GoogleDriveProjectBinding } from './googleDriveProjectTransfer';
import { openRememberedLocalProject } from './localProjectFolder';

/** Exact source identities selected by Desk or Library; this owner does not navigate. */
export interface SelectedSetSource {
  name: string;
  references: { localSetId?: string; driveFileId?: string; driveAccountId?: string; localFolderWorkId?: string };
}
export interface PreparedSelectedSet { setId: string; driveBinding?: GoogleDriveProjectBinding }
type LocalSelectedSet = SelectedSetSource & { references: SelectedSetSource['references'] & { localSetId: string } };

/** Prepare exactly one Set; already-loaded device work is returned without provider I/O. */
type PrepareOptions = { requireSingleSet?: boolean; preserveCurrent?: boolean; assertCurrent?: () => void };
export function prepareSelectedSet(source: LocalSelectedSet, options?: PrepareOptions): PreparedSelectedSet;
export function prepareSelectedSet(source: SelectedSetSource, options?: PrepareOptions): PreparedSelectedSet | Promise<PreparedSelectedSet>;
export function prepareSelectedSet(source: SelectedSetSource, options: PrepareOptions = {}): PreparedSelectedSet | Promise<PreparedSelectedSet> {
  const scope = getProjectPersistenceScope();
  options.assertCurrent?.();
  if (scope === 'unscoped-disabled') throw new Error('Wait for the browser workspace to finish opening before preparing this Set.');
  const { localSetId, driveFileId, driveAccountId, localFolderWorkId } = source.references;
  if (localSetId) {
    if (!useProjectStore.getState().cardSets.some((set) => set.id === localSetId)) throw new Error('This device Set is no longer available. Refresh before opening it.');
    return { setId: localSetId };
  }
  return (async () => {
    if (driveFileId) {
      if (!driveAccountId) throw new Error('The selected Google Drive account is unavailable. Refresh Drive before opening this Set.');
      const binding = await openGoogleDriveProject({ fileId: driveFileId, name: source.name, accountId: driveAccountId }, { requireSingleSet: options.requireSingleSet, preserveActiveSet: options.preserveCurrent, preserveSetOutputPreferences: true, assertCurrent: options.assertCurrent });
      if (getProjectPersistenceScope() !== scope) throw new Error('The active account changed while opening this Set. Reopen it in the intended account.');
      options.assertCurrent?.();
      if (!binding.workId) throw new Error('This Drive document has no Set that CardForge can focus.');
      return { setId: binding.workId, driveBinding: binding };
    }
    if (localFolderWorkId) {
      const opened = await openRememberedLocalProject(localFolderWorkId, { preserveActiveSet: options.preserveCurrent, assertCurrent: options.assertCurrent });
      if (getProjectPersistenceScope() !== scope) throw new Error('The active account changed while opening this Set. Reopen it in the intended account.');
      options.assertCurrent?.();
      return { setId: opened.setId };
    }
    throw new Error('This item has no available Set to prepare. Its source was left unchanged.');
  })();
}
