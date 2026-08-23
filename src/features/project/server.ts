export { createProjectPersistenceScope } from './lib/projectPersistenceIdentity';
export type { ProjectPersistenceScope } from './lib/projectPersistenceIdentity';
export {
  createProjectDocumentFromState,
  parseProjectDocumentValue,
  CUSTOM_DIVIDER_ASSETS_STORAGE_KEY,
  CUSTOM_ICON_ASSETS_STORAGE_KEY,
  CUSTOM_IMAGE_ASSETS_STORAGE_KEY,
  CUSTOM_TEXTURE_ASSETS_STORAGE_KEY,
} from './model/projectDocument';
export type { ProjectDocumentV1 } from './model/projectDocument';
export {
  CARDFORGE_PROJECT_ASSET_REFERENCE_PREFIX,
  CARDFORGE_PROJECT_FILE_EXTENSION,
  CARDFORGE_PROJECT_MANIFEST_FILE,
  CARDFORGE_PROJECT_PACKAGE_VERSION,
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
  CardForgeProjectManifestV1,
  CardForgeProjectPackageSnapshot,
  ProjectPackageAssetDescriptor,
  ProjectPackageAssetMimeType,
  ProjectSourceDescriptor,
  ProjectSourceProvider,
} from './model/projectPackage';
export {
  GOOGLE_DRIVE_FILE_SCOPE,
  GOOGLE_DRIVE_IDENTITY_SCOPES,
  GOOGLE_DRIVE_PROJECT_MIME_TYPE,
  GOOGLE_DRIVE_PROJECT_PROVIDER,
  GOOGLE_DRIVE_ROOT_FOLDER_NAME,
  isGoogleDriveFileId,
  isGoogleDriveProviderRevision,
} from './model/googleDriveProject';
export type {
  GoogleDriveProjectConnectionSummary,
  GoogleDriveProjectDownload,
  GoogleDriveProjectListResult,
  GoogleDriveProjectSummary,
  GoogleDriveUploadCompletion,
  GoogleDriveUploadPrepareResult,
} from './model/googleDriveProject';
export {
  buildCardForgeProjectSnapshot,
  decodeCardForgeProjectPackage,
  decodeProjectFile,
  encodeCardForgeProjectPackage,
  hydrateCardForgeProjectSnapshot,
  ProjectPackageError,
} from './lib/projectPackageCodec';
export type { DecodedProjectFile } from './lib/projectPackageCodec';
export {
  buildGoogleDriveProjectAuthorizationUrl,
  connectGoogleDriveProjectStorage,
  deleteGoogleDriveProject,
  disconnectGoogleDriveProjectStorage,
  getGoogleDriveProject,
  getGoogleDriveProjectConnection,
  getGoogleDriveProjectStorageConfiguration,
  listGoogleDriveProjects,
  prepareGoogleDriveProjectUpload,
  ProjectStorageProviderError,
  updateGoogleDriveProjectFromServer,
} from './server/googleDriveProjectStore';
export {
  createCardSetTransfer,
  createCardTransfer,
  parseCardForgeTransferValue,
} from './model/cardTransfer';
export type { CardForgeTransferV1 } from './model/cardTransfer';
export {
  CLOUD_SET_ASSET_BUCKET,
  CLOUD_SET_ASSET_MIME_TYPES,
  CLOUD_SET_ASSET_REFERENCE_PREFIX,
  getCloudSetAssetIdFromReference,
  getCloudSetAssetReference,
  isCloudSetAssetId,
  isCloudSetAssetMimeType,
  MAX_CLOUD_SET_ASSET_BYTES,
  MAX_CLOUD_SET_ASSETS,
  MAX_CLOUD_SET_BYTES,
  MAX_CLOUD_SET_METADATA_BYTES,
} from './model/cloudSet';
export type {
  CloudSetAssetDescriptor,
  CloudSetDownloadAsset,
  CloudSetDownloadResult,
  CloudSetListResult,
  CloudSetPrepareResult,
  CloudSetPreparedUpload,
  CloudSetSummary,
} from './model/cloudSet';
export {
  CloudSetStoreError,
  deleteCloudSet,
  getCloudSet,
  listCloudSets,
  prepareCloudSetUploads,
  saveCloudSet,
} from './server/cloudSetStore';
export {
  PROJECT_ASSET_BINDINGS,
  PROJECT_ASSET_REQUIREMENT_KINDS,
  PROJECT_ASSET_REQUIREMENT_SOURCES,
  PROJECT_ASSET_REQUIREMENT_STATUSES,
  PROJECT_PRODUCTION_DECISION_MODES,
  PROJECT_PRODUCTION_PLAN_VERSION,
  PROJECT_PRODUCTION_SIZE_UNITS,
  summarizeProjectProductionAssets,
} from './model/projectProductionPlan';
export type {
  ProjectAssetBinding,
  ProjectAssetRequirement,
  ProjectAssetRequirementKind,
  ProjectAssetRequirementSource,
  ProjectAssetRequirementStatus,
  ProjectProductionAssetSummary,
  ProjectProductionDecisionMode,
  ProjectProductionOutputSize,
  ProjectProductionPlan,
  ProjectProductionSizeUnit,
  ProjectProductionVisualDirection,
} from './model/projectProductionPlan';
