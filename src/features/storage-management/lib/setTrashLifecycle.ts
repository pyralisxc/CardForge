import { deleteGoogleDriveProjectCopy } from '@/features/project/client/provider-google-drive';
import { getProjectPersistenceScope } from '@/features/project/client/persistence-workspace';
import { trashDeviceSet } from '@/features/project/client/workLocationTransfer';
import type { AccountLibraryItem } from '../model/accountLibrary';

export type SetTrashTarget = 'device' | 'drive';
export type SetTrashOutcome = { kind: 'removed'; target: SetTrashTarget } | { kind: 'needs-attention'; message: string };

export const getSetTrashTargets = (item: AccountLibraryItem, canUseDrive: boolean) => ({
  hasDevice: Boolean(item.references.localSetId),
  hasDrive: Boolean(item.references.driveFileId),
  driveReady: Boolean(canUseDrive && item.references.driveAccountId && item.references.driveProviderRevision && item.references.driveProjectRevision),
});

/** Executes one explicitly selected copy through its storage owner. */
export const executeSetTrash = async ({ item, target, canUseDrive, scope }: {
  item: AccountLibraryItem;
  target: SetTrashTarget;
  canUseDrive: boolean;
  scope: ReturnType<typeof getProjectPersistenceScope>;
}): Promise<SetTrashOutcome> => {
  try {
    if (getProjectPersistenceScope() !== scope) throw new Error('The active account changed. Reopen Trash for the intended Set.');
    if (target === 'device') {
      if (!item.references.localSetId) throw new Error('The device Set could not be found. Refresh before trying again.');
      await trashDeviceSet(item.references.localSetId, scope);
    } else if (target === 'drive') {
      const { driveFileId, driveAccountId, driveProviderRevision, driveProjectRevision } = item.references;
      if (!getSetTrashTargets(item, canUseDrive).driveReady || !driveFileId || !driveAccountId || !driveProviderRevision || !driveProjectRevision) throw new Error('Refresh this Set to confirm the Drive account and revisions.');
      await deleteGoogleDriveProjectCopy({ fileId: driveFileId, accountId: driveAccountId, providerRevision: driveProviderRevision, projectRevision: driveProjectRevision });
    } else {
      throw new Error('Choose a device or Google Drive copy before using Trash.');
    }
    return { kind: 'removed', target };
  } catch (error) {
    return { kind: 'needs-attention', message: error instanceof Error ? error.message : 'Check the selected location before trying again.' };
  }
};
