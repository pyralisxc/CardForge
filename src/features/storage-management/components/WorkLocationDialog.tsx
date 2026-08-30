"use client";

import {
  DefaultWorkLocationControl,
  ProjectWorkLocationDialog,
  type ProjectWorkLocationTarget,
} from '@/features/project/client';

import type { AccountLibraryItem } from '../model/accountLibrary';
import { accountSourceToWorkLocation } from '../model/workLocations';

interface WorkLocationDialogProps {
  item: AccountLibraryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSignedIn: boolean;
  canUseProjectFiles: boolean;
  driveConnected: boolean;
  localFolderSupported: boolean;
  onChanged?: () => void;
}

const toProjectTarget = (item: AccountLibraryItem | null): ProjectWorkLocationTarget | null => {
  if (!item) return null;
  return {
    name: item.name,
    locations: item.locations
      .map((location) => accountSourceToWorkLocation(location.source))
      .filter((location) => location !== null),
    ...(item.references.localSetId ? { localSetId: item.references.localSetId } : {}),
    ...(item.references.driveFileId ? { driveFileId: item.references.driveFileId } : {}),
    ...(item.references.driveProviderRevision ? { driveProviderRevision: item.references.driveProviderRevision } : {}),
    ...(item.references.driveProjectRevision ? { driveProjectRevision: item.references.driveProjectRevision } : {}),
  };
};

export { DefaultWorkLocationControl };

export function WorkLocationDialog({ item, ...props }: WorkLocationDialogProps) {
  return <ProjectWorkLocationDialog target={toProjectTarget(item)} {...props} />;
}
