import { getCachedGoogleDriveProjectPreview } from '../client/googleDriveProjectPreviewCache';
import { loadGoogleDriveProjectLibrary as loadNativeGoogleDriveProjectLibrary } from '../client/googleDriveProjectTransfer';
import type { GoogleDriveProjectListResult } from '../model/googleDriveProject';

export {
  GOOGLE_DRIVE_FILE_SCOPE,
  GOOGLE_DRIVE_FOLDER_MIME_TYPE,
  GOOGLE_DRIVE_IDENTITY_SCOPES,
  GOOGLE_DRIVE_PROJECT_MIME_TYPE,
  GOOGLE_DRIVE_PROJECT_PROVIDER,
  GOOGLE_DRIVE_ROOT_FOLDER_NAME,
  isGoogleDriveFileId,
  isGoogleDriveProviderRevision,
} from '../model/googleDriveProject';
export type {
  GoogleDriveFolderSelection,
  GoogleDrivePickerConfiguration,
  GoogleDriveProjectConnectionSummary,
  GoogleDriveProjectDownload,
  GoogleDriveProjectListResult,
  GoogleDriveProjectSummary,
  GoogleDriveUploadCompletion,
  GoogleDriveUploadPrepareResult,
} from '../model/googleDriveProject';
export {
  authorizeExistingGoogleDriveProjects,
  chooseGoogleDriveProjectFolder,
  createGoogleDriveProjectFolder,
} from '../client/googleDriveFolderPicker';
export {
  loadGoogleDrivePickerConfiguration,
  pickGoogleDriveItems,
} from '../client/googleDrivePicker';
export type {
  GoogleDrivePickerItem,
  GoogleDrivePickerRequest,
} from '../client/googleDrivePicker';
export {
  deleteGoogleDriveProjectFromLibrary,
  deleteGoogleDriveProjectCopy,
  disconnectGoogleDriveProjectBinding,
  disconnectGoogleDriveStorage,
  getGoogleDriveProjectBinding,
  getGoogleDriveProjectSourceDescriptor,
  openGoogleDriveProject,
  refreshGoogleDriveProject,
  hasGoogleDriveWorkingChanges,
  copyGoogleDriveProjectToBrowser,
  saveCurrentProjectToGoogleDrive,
  saveCardSetToGoogleDrive,
  getGoogleDriveWorkBinding,
  GoogleDriveSaveLinkageError,
} from '../client/googleDriveProjectTransfer';
export type { GoogleDriveProjectBinding } from '../client/googleDriveProjectTransfer';
export {
  cacheGoogleDriveProjectPreview,
  clearCachedGoogleDriveProjectPreviews,
  getCachedGoogleDriveProjectPreview,
} from '../client/googleDriveProjectPreviewCache';
export { repairConfirmedGoogleDriveLink } from '../client/googleDriveLinkRepair';
export {
  revalidateGoogleDriveWorkBinding,
  useGoogleDriveWorkingSession,
} from '../client/googleDriveWorkingSession';
export type {
  GoogleDriveBindingCheck,
  GoogleDriveWorkingSessionPhase,
  GoogleDriveWorkingSessionState,
} from '../client/googleDriveWorkingSession';

let inFlightLibraryRead: Promise<GoogleDriveProjectListResult> | null = null;

const readNativeGoogleDriveProjectLibrary = (): Promise<GoogleDriveProjectListResult> => {
  if (!inFlightLibraryRead) {
    inFlightLibraryRead = loadNativeGoogleDriveProjectLibrary().finally(() => {
      inFlightLibraryRead = null;
    });
  }
  return inFlightLibraryRead;
};

/** Apply only ephemeral compatibility pixels; source identity remains provider-owned. */
export const applyCachedGoogleDriveProjectPreviews = (
  library: GoogleDriveProjectListResult,
): GoogleDriveProjectListResult => ({
  ...library,
  projects: library.projects.map((project) => project.thumbnailLink
    ? project
    : { ...project, thumbnailLink: getCachedGoogleDriveProjectPreview(project) }),
});

/**
 * Provider thumbnails stay authoritative. A browser-only compatibility preview
 * may fill the visual gap for older Drive packages that predate native
 * contentHints thumbnails; it never changes source identity or editable work.
 * Concurrent consumers share the same provider read, but no result is cached
 * after that request settles, so an explicit later refresh still reaches Drive.
 */
export const loadGoogleDriveProjectLibrary = async (): Promise<GoogleDriveProjectListResult> => (
  applyCachedGoogleDriveProjectPreviews(await readNativeGoogleDriveProjectLibrary())
);
