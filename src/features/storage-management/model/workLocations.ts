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
  canUseProjectFiles: boolean;
  driveConnected: boolean;
  localFolderSupported: boolean;
}

export const getWorkLocationCapabilities = ({
  signedIn,
  canUseProjectFiles,
  driveConnected,
  localFolderSupported,
}: WorkLocationContext): WorkLocationCapability[] => [
  {
    id: 'device', label: 'This device', available: true, reason: null,
    create: true, read: true, write: true, remove: true, revisionSafe: false, serverReachable: false,
  },
  {
    id: 'google-drive', label: 'Google Drive', available: canUseProjectFiles && signedIn && driveConnected,
    reason: !canUseProjectFiles ? 'Creator Pass is required for connected project locations.' : !signedIn ? 'Sign in before saving to Google Drive.' : !driveConnected ? 'Connect Google Drive in Locations first.' : null,
    create: canUseProjectFiles && signedIn && driveConnected, read: canUseProjectFiles && signedIn && driveConnected, write: canUseProjectFiles && signedIn && driveConnected,
    remove: canUseProjectFiles && signedIn && driveConnected, revisionSafe: true, serverReachable: true,
  },
  {
    id: 'local-folder', label: 'Local project folder', available: canUseProjectFiles && localFolderSupported,
    reason: !canUseProjectFiles ? 'Creator Pass is required for portable Set locations.' : localFolderSupported ? null : 'Direct folder access is not supported by this browser.',
    create: canUseProjectFiles && localFolderSupported, read: canUseProjectFiles && localFolderSupported, write: canUseProjectFiles && localFolderSupported,
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
