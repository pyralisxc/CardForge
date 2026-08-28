import type { AccountLibrarySource } from './accountLibrary';

export const WORK_LOCATION_IDS = ['device', 'google-drive', 'local-folder'] as const;
export type WorkLocationId = typeof WORK_LOCATION_IDS[number];

export const DEFAULT_WORK_LOCATION_PREFERENCE = 'default-work-location';

export interface WorkLocationCapability {
  id: WorkLocationId;
  label: string;
  available: boolean;
  reason: string | null;
  create: boolean;
  read: boolean;
  write: boolean;
  remove: boolean;
  revisionSafe: boolean;
  serverReachable: boolean;
}

export interface WorkLocationContext {
  signedIn: boolean;
  driveConnected: boolean;
  localFolderSupported: boolean;
}

export const getWorkLocationCapabilities = ({
  signedIn,
  driveConnected,
  localFolderSupported,
}: WorkLocationContext): WorkLocationCapability[] => [
  {
    id: 'device', label: 'This device', available: true, reason: null,
    create: true, read: true, write: true, remove: true, revisionSafe: false, serverReachable: false,
  },
  {
    id: 'google-drive', label: 'Google Drive', available: signedIn && driveConnected,
    reason: !signedIn ? 'Sign in before saving to Google Drive.' : !driveConnected ? 'Connect Google Drive in Locations first.' : null,
    create: signedIn && driveConnected, read: signedIn && driveConnected, write: signedIn && driveConnected,
    remove: signedIn && driveConnected, revisionSafe: true, serverReachable: true,
  },
  {
    id: 'local-folder', label: 'Local project folder', available: localFolderSupported,
    reason: localFolderSupported ? null : 'Direct folder access is not supported by this browser.',
    create: localFolderSupported, read: localFolderSupported, write: localFolderSupported,
    remove: false, revisionSafe: false, serverReachable: false,
  },
];

export const accountSourceToWorkLocation = (source: AccountLibrarySource): WorkLocationId | null => {
  if (source === 'device' || source === 'google-drive' || source === 'local-folder') return source;
  return null;
};

export const normalizeDefaultWorkLocation = (
  value: unknown,
  capabilities: readonly WorkLocationCapability[],
): WorkLocationId => {
  const requested = WORK_LOCATION_IDS.find((id) => id === value);
  if (requested && capabilities.some((capability) => capability.id === requested && capability.available && capability.create)) return requested;
  return capabilities.find((capability) => capability.available && capability.create)?.id ?? 'device';
};

export const canTransferWork = ({
  source,
  destination,
  capabilities,
}: {
  source: WorkLocationId;
  destination: WorkLocationId;
  capabilities: readonly WorkLocationCapability[];
}): boolean => {
  if (source === destination) return false;
  const sourceCapability = capabilities.find((capability) => capability.id === source);
  const destinationCapability = capabilities.find((capability) => capability.id === destination);
  return Boolean(sourceCapability?.available && sourceCapability.read && destinationCapability?.available && destinationCapability.create);
};

export const canMoveWork = ({
  source,
  destination,
  capabilities,
}: {
  source: WorkLocationId;
  destination: WorkLocationId;
  capabilities: readonly WorkLocationCapability[];
}): boolean => {
  const sourceCapability = capabilities.find((capability) => capability.id === source);
  return canTransferWork({ source, destination, capabilities }) && Boolean(sourceCapability?.remove);
};
