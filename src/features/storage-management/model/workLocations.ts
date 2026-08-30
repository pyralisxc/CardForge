import type { AccountLibrarySource } from './accountLibrary';

export {
  canMoveWork,
  canTransferWork,
  DEFAULT_WORK_LOCATION_PREFERENCE,
  getWorkLocationCapabilities,
  normalizeDefaultWorkLocation,
  WORK_LOCATION_IDS,
} from '@/features/project/client';
export type {
  WorkLocationCapability,
  WorkLocationContext,
  WorkLocationId,
} from '@/features/project/client';

export const accountSourceToWorkLocation = (source: AccountLibrarySource) => {
  if (source === 'device' || source === 'google-drive' || source === 'local-folder') return source;
  return null;
};
