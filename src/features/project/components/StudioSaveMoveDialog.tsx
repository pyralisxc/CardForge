"use client";

import { useEffect, useState } from 'react';

import {
  getGoogleDriveWorkBinding,
  loadGoogleDriveProjectLibrary,
} from '../client/googleDriveProjectTransfer';
import {
  getLocalProjectFolderStatus,
  getLocalProjectWorkBinding,
} from '../client/localProjectFolder';
import type { WorkLocationId } from '../model/workLocations';
import { ProjectWorkLocationDialog } from './ProjectWorkLocationDialog';

interface StudioLocationState {
  driveConnected: boolean;
  localFolderSupported: boolean;
  locations: WorkLocationId[];
}

export function StudioSaveMoveDialog({
  open,
  onOpenChange,
  isSignedIn,
  canUseProjectFiles,
  setId,
  setName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSignedIn: boolean;
  canUseProjectFiles: boolean;
  setId: string;
  setName: string;
}) {
  const [locationState, setLocationState] = useState<StudioLocationState>({
    driveConnected: false,
    localFolderSupported: false,
    locations: ['device'],
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void Promise.all([
      isSignedIn
        ? loadGoogleDriveProjectLibrary().then((result) => result.connection.connected).catch(() => false)
        : Promise.resolve(false),
      getLocalProjectFolderStatus().then((result) => result.supported).catch(() => false),
      getGoogleDriveWorkBinding(setId),
      getLocalProjectWorkBinding(setId),
    ]).then(([driveConnected, localFolderSupported, driveBinding, localFolderBinding]) => {
      if (!cancelled) setLocationState({
        driveConnected,
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
      target={{ name: setName, locations: locationState.locations, localSetId: setId }}
      open={open}
      onOpenChange={onOpenChange}
      isSignedIn={isSignedIn}
      canUseProjectFiles={canUseProjectFiles}
      driveConnected={locationState.driveConnected}
      localFolderSupported={locationState.localFolderSupported}
    />
  );
}
