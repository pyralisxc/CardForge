"use client";

import { writeStructuredBrowserValue } from '@/features/project/persistence/structuredBrowserStorage';

import { useProjectStore } from '../store/workspaceStore';
import { getProjectPersistenceScope, getScopedProjectStorageNamespace } from '../persistence/projectPersistenceScope';
import { saveCurrentGoogleDriveAttachment } from './workspaceProjectStorage';
import {
  getGoogleDriveWorkBinding,
  loadGoogleDriveProjectLibrary,
  type GoogleDriveProjectBinding,
} from './googleDriveProjectTransfer';

const GOOGLE_DRIVE_WORK_BINDING_KEY_PREFIX = 'google-drive-work:';
const driveWorkBindingStorageKey = (workId: string) => `${GOOGLE_DRIVE_WORK_BINDING_KEY_PREFIX}${workId}`;

const assertSameScope = (scope: string) => {
  if (getProjectPersistenceScope() !== scope) {
    throw new Error('The browser account changed while Drive linkage was being repaired. The Drive file was not changed.');
  }
};

/**
 * Repairs only CardForge browser bookkeeping after a provider-confirmed Drive
 * save. It never uploads or mutates Drive. The exact Drive file/account and both
 * revision receipts must still match before the local binding is rewritten.
 */
export const repairConfirmedGoogleDriveLink = async (
  receipt: GoogleDriveProjectBinding,
): Promise<GoogleDriveProjectBinding> => {
  const scope = getProjectPersistenceScope();
  const workId = receipt.workId?.trim() ?? '';
  if (!workId || !useProjectStore.getState().cardSets.some((set) => set.id === workId)) {
    throw new Error('The Set referenced by this Drive receipt is no longer open in this browser. Reopen the Drive document instead of replaying the save.');
  }

  const library = await loadGoogleDriveProjectLibrary();
  assertSameScope(scope);
  const current = library.projects.find((project) => (
    project.fileId === receipt.fileId
    && (!receipt.accountId || project.accountId === receipt.accountId)
  ));
  if (!current) {
    throw new Error('CardForge could not find the confirmed Drive file in the connected account. Do not repeat the save; reconnect or inspect the file first.');
  }
  if (current.providerRevision !== receipt.providerRevision || current.projectRevision !== receipt.projectRevision) {
    throw new Error('The Drive file changed after the confirmed save. Linkage was not repaired; refresh or compare the newer Drive revision first.');
  }

  const repaired: GoogleDriveProjectBinding = {
    fileId: current.fileId,
    name: current.name,
    providerRevision: current.providerRevision,
    projectRevision: current.projectRevision,
    workId,
    ...(current.accountId ? { accountId: current.accountId } : receipt.accountId ? { accountId: receipt.accountId } : {}),
  };
  await writeStructuredBrowserValue(
    getScopedProjectStorageNamespace('project-assets'),
    driveWorkBindingStorageKey(workId),
    repaired,
  );
  assertSameScope(scope);
  await saveCurrentGoogleDriveAttachment({
    fileId: repaired.fileId,
    name: repaired.name,
    providerRevision: repaired.providerRevision,
    projectRevision: repaired.projectRevision,
    accountId: repaired.accountId,
    workId,
  });
  assertSameScope(scope);

  const persisted = await getGoogleDriveWorkBinding(workId);
  if (!persisted
    || persisted.fileId !== repaired.fileId
    || persisted.providerRevision !== repaired.providerRevision
    || persisted.projectRevision !== repaired.projectRevision
    || persisted.accountId !== repaired.accountId) {
    throw new Error('Drive was not changed, but CardForge could not verify the repaired browser link. Keep the receipt and retry linkage repair later.');
  }
  return persisted;
};
