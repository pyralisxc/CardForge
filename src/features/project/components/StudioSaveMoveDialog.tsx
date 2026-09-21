"use client";

import { useEffect, useState } from 'react';

import { ApiClientError } from '@/infrastructure/http/clientResponses';

import {
  getGoogleDriveWorkBinding,
  hasGoogleDriveWorkingChanges,
  loadGoogleDriveProjectLibrary,
} from '../client/googleDriveProjectTransfer';
import {
  getLocalProjectFolderStatus,
  getLocalProjectWorkBinding,
} from '../client/localProjectFolder';
import type { ProjectDocumentV1 } from '../model/projectDocument';
import type { WorkLocationId } from '../model/workLocations';
import { ProjectWorkLocationDialog } from './ProjectWorkLocationDialog';

interface StudioLocationState {
  driveConnected: boolean;
  driveConflictMessage: string | null;
  driveAvailabilityMessage: string | null;
  localFolderSupported: boolean;
  locations: WorkLocationId[];
}

const staleDriveBindingMessage = 'The Drive content revision differs from this saved binding. Refresh a clean working copy before saving, or use Save as new to preserve local changes.';
const unverifiedDriveBindingMessage = 'Drive changed, but CardForge could not verify this browser’s working copy. The existing Drive copy is protected; use Save as new to preserve both versions.';

export const resolveGoogleDriveConflictMessage = async (
  checkLocalChanges: () => Promise<boolean>,
): Promise<string | null> => {
  try {
    return await checkLocalChanges() ? staleDriveBindingMessage : null;
  } catch {
    // An unreadable browser snapshot cannot prove that overwrite is safe.
    // Preserve the remote document and direct the creator to the recovery
    // branch instead of turning a failed check into “no local changes.”
    return unverifiedDriveBindingMessage;
  }
};

export const describeGoogleDriveLibraryFailure = (error: unknown) => {
  if (error instanceof ApiClientError) {
    return error.nextAction && !error.message.includes(error.nextAction)
      ? `${error.message} ${error.nextAction}`
      : error.message;
  }
  return 'Google Drive is temporarily unavailable. The existing browser and Drive copies were left unchanged; retry when Drive is reachable.';
};

const readGoogleDriveBinding = async (setId: string) => {
  try {
    return { binding: await getGoogleDriveWorkBinding(setId), failure: null };
  } catch {
    return {
      binding: null,
      failure: 'CardForge could not read this Set’s saved Drive link. The Drive copy was not changed; reopen the Set after browser storage is available.',
    };
  }
};

export function StudioSaveMoveDialog({
  open,
  onOpenChange,
  isSignedIn,
  canUseProjectFiles,
  setId,
  setName,
  renderThumbnail,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSignedIn: boolean;
  canUseProjectFiles: boolean;
  setId: string;
  setName: string;
  renderThumbnail?: (document: ProjectDocumentV1) => Promise<string | null>;
}) {
  const [locationState, setLocationState] = useState<StudioLocationState>({
    driveConnected: false,
    driveConflictMessage: null,
    driveAvailabilityMessage: null,
    localFolderSupported: false,
    locations: ['device'],
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void Promise.all([
      isSignedIn
        ? loadGoogleDriveProjectLibrary()
          .then((library) => ({ library, failure: null }))
          .catch((error: unknown) => ({ library: null, failure: describeGoogleDriveLibraryFailure(error) }))
        : Promise.resolve({ library: null, failure: null }),
      getLocalProjectFolderStatus().then((result) => result.supported).catch(() => false),
      readGoogleDriveBinding(setId),
      getLocalProjectWorkBinding(setId).catch(() => null),
    ]).then(async ([driveRead, localFolderSupported, driveBindingRead, localFolderBinding]) => {
      const driveLibrary = driveRead.library;
      const driveBinding = driveBindingRead.binding;
      const linkedDriveProject = driveBinding && driveLibrary?.projects.find((project) => (
        project.fileId === driveBinding.fileId
        && (!driveBinding.accountId || project.accountId === driveBinding.accountId)
      ));
      const remoteRevisionChanged = Boolean(linkedDriveProject && driveBinding && (
        linkedDriveProject.providerRevision !== driveBinding.providerRevision
        || linkedDriveProject.projectRevision !== driveBinding.projectRevision
      ));
      const driveConflictMessage = remoteRevisionChanged && driveBinding
        ? await resolveGoogleDriveConflictMessage(() => hasGoogleDriveWorkingChanges(driveBinding))
        : null;
      if (!cancelled) setLocationState({
        driveConnected: Boolean(driveLibrary?.connection.connected && driveLibrary.connection.rootFolderId),
        driveConflictMessage,
        driveAvailabilityMessage: driveRead.failure ?? driveBindingRead.failure,
        localFolderSupported,
        locations: [
          'device',
          ...(driveBinding ? ['google-drive' as const] : []),
          ...(localFolderBinding ? ['local-folder' as const] : []),
        ],
      });
    });
    return () => { cancelled = true; };
  }, [isSignedIn, open, setId]);

  return (
    <ProjectWorkLocationDialog
      renderThumbnail={renderThumbnail}
      target={{ name: setName, locations: locationState.locations, localSetId: setId }}
      open={open}
      onOpenChange={onOpenChange}
      isSignedIn={isSignedIn}
      canUseProjectFiles={canUseProjectFiles}
      driveConnected={locationState.driveConnected}
      driveConflictMessage={locationState.driveConflictMessage}
      driveAvailabilityMessage={locationState.driveAvailabilityMessage}
      localFolderSupported={locationState.localFolderSupported}
    />
  );
}
