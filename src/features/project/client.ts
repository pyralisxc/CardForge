export { BrowserStorageAlerts } from './components/BrowserStorageAlerts';
export { AccountProjectWorkspaceBoundary } from './components/AccountProjectWorkspaceBoundary';
export {
  DefaultWorkLocationControl,
  ProjectWorkLocationDialog,
} from './components/ProjectWorkLocationDialog';
export type {
  ProjectWorkLocationContextProps,
  ProjectWorkLocationTarget,
} from './components/ProjectWorkLocationDialog';
export { StudioSaveMoveDialog } from './components/StudioSaveMoveDialog';
export { useBrowserWorkspaceSaveStatus } from './hooks/useBrowserWorkspaceSaveStatus';
export { useCardTransferActions } from './hooks/useCardTransferActions';
export {
  buildProjectImportPreview,
  buildProjectImportSummary,
  useProjectFileActions,
} from './hooks/useProjectFileActions';
export type { ProjectImportMode, ProjectImportPreview } from './hooks/useProjectFileActions';
export {
  CARD_TRANSFER_VERSION,
  createCardSetTransfer,
  createCardTransfer,
  parseCardForgeTransferFile,
  parseCardForgeTransferValue,
} from './model/cardTransfer';
export type { CardForgeTransferV1, CardTransferKind } from './model/cardTransfer';
export {
  applyProjectDocumentToState,
  createProjectDocumentFromState,
  CUSTOM_DIVIDER_ASSETS_STORAGE_KEY,
  CUSTOM_FONT_ASSETS_STORAGE_KEY,
  CUSTOM_ICON_ASSETS_STORAGE_KEY,
  CUSTOM_IMAGE_ASSETS_STORAGE_KEY,
  CUSTOM_TEXTURE_ASSETS_STORAGE_KEY,
  isolateProjectDocumentToSet,
  instantiateProjectDocumentCopy,
  parseProjectDocumentFile,
  parseProjectDocumentValue,
} from './model/projectDocument';
export type {
  CreateProjectDocumentInput,
  ProjectDocumentCustomAssets,
  ProjectDocumentExportSettings,
  ProjectDocumentStatePatch,
  ProjectDocumentV1,
} from './model/projectDocument';
export {
  getProjectFontValue,
  isProjectFontAssetId,
  isProjectFontMimeType,
  MAX_PROJECT_FONT_BYTES,
  MAX_PROJECT_FONTS,
  normalizeProjectFontAsset,
  normalizeProjectFontAssets,
  PROJECT_FONT_LIBRARY_CHANGE_EVENT,
  PROJECT_FONT_MIME_TYPES,
} from './model/projectFont';
export type { ProjectFontAsset, ProjectFontMimeType } from './model/projectFont';
export {
  CARDFORGE_PROJECT_ASSET_REFERENCE_PREFIX,
  CARDFORGE_PROJECT_FILE_EXTENSION,
  CARDFORGE_PROJECT_MANIFEST_FILE,
  CARDFORGE_PROJECT_PACKAGE_VERSION,
  LEGACY_CARDFORGE_PROJECT_PACKAGE_VERSION,
  getProjectPackageAssetExtension,
  getProjectPackageAssetIdFromReference,
  getProjectPackageAssetReference,
  isProjectPackageAssetId,
  isProjectPackageAssetMimeType,
  MAX_PROJECT_PACKAGE_ASSET_BYTES,
  MAX_PROJECT_PACKAGE_ASSETS,
  MAX_PROJECT_PACKAGE_BYTES,
  MAX_PROJECT_PACKAGE_METADATA_BYTES,
  normalizeProjectFileName,
  PROJECT_PACKAGE_ASSET_MIME_TYPES,
} from './model/projectPackage';
export type {
  CardForgeProjectManifest,
  CardForgeProjectManifestV1,
  CardForgeProjectManifestV2,
  CardForgeProjectPackageSnapshot,
  CardForgeProjectPackageSnapshotV2,
  PortableProjectDocumentV2,
  ProjectPackageAssetDescriptor,
  ProjectPackageAssetMimeType,
  ProjectSourceDescriptor,
  ProjectSourceProvider,
} from './model/projectPackage';
export {
  GOOGLE_DRIVE_FILE_SCOPE,
  GOOGLE_DRIVE_FOLDER_MIME_TYPE,
  GOOGLE_DRIVE_IDENTITY_SCOPES,
  GOOGLE_DRIVE_PROJECT_MIME_TYPE,
  GOOGLE_DRIVE_PROJECT_PROVIDER,
  GOOGLE_DRIVE_ROOT_FOLDER_NAME,
  isGoogleDriveFileId,
  isGoogleDriveProviderRevision,
} from './model/googleDriveProject';
export type {
  GoogleDriveFolderSelection,
  GoogleDrivePickerConfiguration,
  GoogleDriveProjectConnectionSummary,
  GoogleDriveProjectDownload,
  GoogleDriveProjectListResult,
  GoogleDriveProjectSummary,
  GoogleDriveUploadCompletion,
  GoogleDriveUploadPrepareResult,
} from './model/googleDriveProject';
export {
  buildCardForgeProjectSnapshot,
  createCardForgeProjectPackageBlob,
  decodeCardForgeProjectPackage,
  decodeProjectFile,
  encodeCardForgeProjectPackage,
  hydrateCardForgeProjectSnapshot,
  writeCardForgeProjectPackage,
  ProjectPackageError,
} from './lib/projectPackageCodec';
export { referenceCardForgeProjectSnapshotAssets } from './lib/projectPackageAssetReferences';
export type { DecodedProjectFile } from './lib/projectPackageCodec';
export { decodeBrowserProjectFile, materializeBrowserProjectSnapshot } from './client/browserProjectPackage';
export {
  applyProjectDocumentToWorkspace,
  captureCurrentProjectDocument,
  captureCardSetProjectDocument,
} from './client/projectWorkspaceDocument';
export { createPublishedSetCopy } from './client/publishedSet';
export type { PublishedSetCopyResult } from './client/publishedSet';
export type {
  ProjectWorkspaceApplyMode,
  ProjectWorkspaceApplySummary,
} from './client/projectWorkspaceDocument';
export { chooseGoogleDriveProjectFolder } from './client/googleDriveFolderPicker';
export {
  loadGoogleDrivePickerConfiguration,
  pickGoogleDriveItems,
} from './client/googleDrivePicker';
export type {
  GoogleDrivePickerItem,
  GoogleDrivePickerRequest,
} from './client/googleDrivePicker';
export {
  deleteGoogleDriveProjectFromLibrary,
  deleteGoogleDriveProjectCopy,
  disconnectGoogleDriveProjectBinding,
  disconnectGoogleDriveStorage,
  getGoogleDriveProjectBinding,
  getGoogleDriveProjectSourceDescriptor,
  loadGoogleDriveProjectLibrary,
  openGoogleDriveProject,
  copyGoogleDriveProjectToBrowser,
  saveCurrentProjectToGoogleDrive,
  saveCardSetToGoogleDrive,
  getGoogleDriveWorkBinding,
} from './client/googleDriveProjectTransfer';
export type { GoogleDriveProjectBinding } from './client/googleDriveProjectTransfer';
export {
  disconnectLocalProjectFolder,
  getLocalProjectFileName,
  getLocalProjectFolderStatus,
  isLocalProjectFolderSupported,
  openProjectFromFolder,
  getLocalProjectWorkBinding,
  listLocalProjectWorkBindings,
  reconnectAttachedProjectFolder,
  saveCurrentProjectToNewFolder,
  saveCardSetToNewFolder,
  saveCardSetToAttachedFolder,
  saveProjectToAttachedFolder,
} from './client/localProjectFolder';
export type {
  LocalProjectFolderBinding,
  LocalProjectFolderStatus,
  LocalProjectWorkBindingStatus,
} from './client/localProjectFolder';
export {
  BROWSER_STORAGE_DATABASE,
  BROWSER_STORAGE_FAILURE_EVENT,
  BROWSER_STORAGE_SAVE_STATUS_EVENT,
  BROWSER_WORKSPACE_CONFLICT_EVENT,
  compareAndSetBrowserWorkspaceValue,
  createBrowserKeyValueStorage,
  createIndexedDbStorage,
  getBrowserRecoverySnapshot,
  getBrowserWorkspaceSaveStatus,
  getBrowserStorageHealth,
  getConstrainedImageSize,
  MAX_LOCAL_ASSET_DIMENSION,
  optimizeLocalAssetFile,
  quarantineBrowserStorageValue,
  subscribeToBrowserWorkspaceSaveStatus,
  validateLocalAssetFile,
} from './persistence/indexedDbStorage';
export {
  BROWSER_WORKSPACE_RECORD_VERSION,
  BrowserWorkspaceConflictError,
  parseBrowserWorkspaceRecord,
  resolveGuestWorkspaceAdoption,
  serializeBrowserWorkspaceRecord,
} from './persistence/workspaceRevision';
export type {
  BrowserWorkspaceRecord,
  GuestWorkspaceAdoptionChoice,
  ParsedBrowserWorkspaceRecord,
} from './persistence/workspaceRevision';
export type { BrowserStorageHealth, BrowserStorageSaveStatus } from './persistence/indexedDbStorage';
export {
  BROWSER_PROJECT_ASSET_REFERENCE_PREFIX,
  copyBrowserProjectAssets,
  getBrowserProjectAssetIds,
} from './persistence/contentAddressedBrowserAssets';
export {
  applyGuestWorkspaceAdoption,
  inspectGuestWorkspaceAdoption,
} from './persistence/guestWorkspaceAdoption';
export type { GuestWorkspaceAdoptionOffer } from './persistence/guestWorkspaceAdoption';
export {
  createProjectBinaryAssetResolver,
  createScopedProjectBinaryAssetResolver,
  isProjectBinaryAssetReference,
} from './persistence/projectBinaryAssetResolver';
export type {
  ProjectBinaryAssetHandle,
  ProjectBinaryAssetResolver,
} from './persistence/projectBinaryAssetResolver';
export {
  readStructuredBrowserValue,
  removeStructuredBrowserValue,
  writeStructuredBrowserValue,
} from './persistence/structuredBrowserStorage';
export {
  BROWSER_WORKSPACE_REMOTE_CHANGE_EVENT,
  createProjectPersistenceScope,
  createScopedProjectStorage,
  getProjectPersistenceScope,
  getScopedProjectStorageNamespace,
  LEGACY_PROJECT_ASSETS_NAMESPACE,
  LEGACY_PROJECT_WORKSPACE_NAMESPACE,
  setProjectPersistenceScope,
} from './persistence/projectPersistenceScope';
export type { ProjectPersistenceScope } from './persistence/projectPersistenceScope';
export { SPATIAL_WORKSPACE_PREFERENCE_KEY, useSpatialWorkspacePreferences } from './client/useSpatialWorkspacePreferences';
export {
  readProjectPreference,
  removeProjectPreference,
  writeProjectPreference,
} from './persistence/preferences';
export {
  canUploadCustomLocalAssets,
  getProjectAssetStorage,
  mergeProjectAssetListToStorage,
  readProjectAssetListFromStorage,
  readRequiredProjectAssetListFromStorage,
  readRequiredTypedProjectAssetListFromStorage,
  readTypedProjectAssetListFromStorage,
  writeProjectAssetListToStorage,
} from './persistence/projectAssets';
export type { ProjectAssetStorage } from './persistence/projectAssets';
export {
  mapProjectFontsToCardFontOptions,
  readProjectFonts,
  removeProjectFont,
  upsertProjectFont,
  writeProjectFonts,
} from './persistence/projectFonts';
export {
  selectAllGeneratedDisplayCards,
  selectAllTemplates,
  selectEditingCard,
  selectGeneratedDisplayCards,
  resolveGeneratorFrontTemplateId,
} from './store/selectors';
export { hydrateProjectWorkspaceForScope, useProjectStore } from './store/workspaceStore';
export type { ProjectState } from './store/workspaceStore';
export { normalizeStudioView } from './store/workspaceDefaults';
export type { StudioView } from './store/workspaceDefaults';
export {
  canMoveWork,
  canTransferWork,
  DEFAULT_WORK_LOCATION_PREFERENCE,
  getWorkLocationCapabilities,
  normalizeDefaultWorkLocation,
  WORK_LOCATION_IDS,
} from './model/workLocations';
export type {
  WorkLocationCapability,
  WorkLocationContext,
  WorkLocationId,
} from './model/workLocations';
