"use client";

import { useEffect, useState } from 'react';

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
  localFolderSupported: boolean;
  locations: WorkLocationId[];
}

const staleDriveBindingMessage = 'The Drive content revision differs from this saved binding. Refresh a clean working copy before saving, or use Save as new to preserve local changes.';

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
    localFolderSupported: false,
    locations: ['device'],
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void Promise.all([
      isSignedIn
        ? loadGoogleDriveProjectLibrary().catch(() => null)
        : Promise.resolve(null),
      getLocalProjectFolderStatus().then((result) => result.supported).catch(() => false),
      getGoogleDriveWorkBinding(setId),
      getLocalProjectWorkBinding(setId),
    ]).then(async ([driveLibrary, localFolderSupported, driveBinding, localFolderBinding]) => {
      const linkedDriveProject = driveBinding && driveLibrary?.projects.find((project) => (
        project.fileId === driveBinding.fileId
        && (!driveBinding.accountId || project.accountId === driveBinding.accountId)
      ));
      const remoteRevisionChanged = Boolean(linkedDriveProject && driveBinding && (
        linkedDriveProject.providerRevision !== driveBinding.providerRevision
        || linkedDriveProject.projectRevision !== driveBinding.projectRevision
      ));
      const hasLocalDriveChanges = remoteRevisionChanged && driveBinding
        ? await hasGoogleDriveWorkingChanges(driveBinding).catch(() => false)
        : false;
      const driveConflictMessage = hasLocalDriveChanges ? staleDriveBindingMessage : null;
      if (!cancelled) setLocationState({
        driveConnected: Boolean(driveLibrary?.connection.connected),
        driveConflictMessage,
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
      localFolderSupported={locationState.localFolderSupported}
    />
  );
}
