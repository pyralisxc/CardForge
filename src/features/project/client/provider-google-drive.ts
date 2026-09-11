import { getCachedGoogleDriveProjectPreview } from '../client/googleDriveProjectPreviewCache';
import { loadGoogleDriveProjectLibrary as loadNativeGoogleDriveProjectLibrary } from '../client/googleDriveProjectTransfer';
import type { GoogleDriveProjectListResult } from '../model/googleDriveProject';
import { getProjectPersistenceScope } from '../persistence/projectPersistenceScope';

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

type InFlightLibraryRead = {
  scope: ReturnType<typeof getProjectPersistenceScope>;
  request: Promise<GoogleDriveProjectListResult>;
};

let inFlightLibraryRead: InFlightLibraryRead | null = null;

const readNativeGoogleDriveProjectLibrary = (): Promise<GoogleDriveProjectListResult> => {
  const scope = getProjectPersistenceScope();
  if (inFlightLibraryRead?.scope === scope) return inFlightLibraryRead.request;

  const request = loadNativeGoogleDriveProjectLibrary();
  const entry: InFlightLibraryRead = { scope, request };
  inFlightLibraryRead = entry;
  const clearIfCurrent = () => {
    if (inFlightLibraryRead === entry) inFlightLibraryRead = null;
  };
  // Use both settlement handlers instead of an ignored `finally()` promise;
  // otherwise a provider rejection would create a second unhandled rejection.
  void request.then(clearIfCurrent, clearIfCurrent);
  return request;
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
 * Concurrent consumers for the same browser owner share one provider read,
 * but the promise is cleared after settlement so a later refresh still reaches
 * Drive. Account changes never reuse an older owner's in-flight request.
 */
export const loadGoogleDriveProjectLibrary = async (): Promise<GoogleDriveProjectListResult> => (
  applyCachedGoogleDriveProjectPreviews(await readNativeGoogleDriveProjectLibrary())
);
