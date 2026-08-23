export { BrowserStorageAlerts } from './components/BrowserStorageAlerts';
export { useBrowserWorkspaceSaveStatus } from './hooks/useBrowserWorkspaceSaveStatus';
export { useCardTransferActions } from './hooks/useCardTransferActions';
export { useCloudSetActions } from './hooks/useCloudSetActions';
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
  applyProjectDocumentToState,
  createProjectDocumentFromState,
  CUSTOM_DIVIDER_ASSETS_STORAGE_KEY,
  CUSTOM_ICON_ASSETS_STORAGE_KEY,
  CUSTOM_IMAGE_ASSETS_STORAGE_KEY,
  CUSTOM_TEXTURE_ASSETS_STORAGE_KEY,
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
  buildCardForgeProjectSnapshot,
  decodeCardForgeProjectPackage,
  decodeProjectFile,
  encodeCardForgeProjectPackage,
  hydrateCardForgeProjectSnapshot,
  ProjectPackageError,
} from './lib/projectPackageCodec';
export type { DecodedProjectFile } from './lib/projectPackageCodec';
export {
  applyProjectDocumentToWorkspace,
  captureCurrentProjectDocument,
} from './client/projectWorkspaceDocument';
export type {
  ProjectWorkspaceApplyMode,
  ProjectWorkspaceApplySummary,
} from './client/projectWorkspaceDocument';
export {
  disconnectLocalProjectFolder,
  getLocalProjectFileName,
  getLocalProjectFolderStatus,
  isLocalProjectFolderSupported,
  openProjectFromFolder,
  reconnectAttachedProjectFolder,
  saveCurrentProjectToNewFolder,
  saveProjectToAttachedFolder,
} from './client/localProjectFolder';
export type {
  LocalProjectFolderBinding,
  LocalProjectFolderStatus,
} from './client/localProjectFolder';
export {
  BROWSER_STORAGE_DATABASE,
  BROWSER_STORAGE_FAILURE_EVENT,
  BROWSER_STORAGE_SAVE_STATUS_EVENT,
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
export type { BrowserStorageHealth, BrowserStorageSaveStatus } from './persistence/indexedDbStorage';
export {
  readStructuredBrowserValue,
  removeStructuredBrowserValue,
  writeStructuredBrowserValue,
} from './persistence/structuredBrowserStorage';
export {
  createProjectPersistenceScope,
  createScopedProjectStorage,
  getProjectPersistenceScope,
  getScopedProjectStorageNamespace,
  LEGACY_PROJECT_ASSETS_NAMESPACE,
  LEGACY_PROJECT_WORKSPACE_NAMESPACE,
  setProjectPersistenceScope,
} from './persistence/projectPersistenceScope';
export type { ProjectPersistenceScope } from './persistence/projectPersistenceScope';
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
  selectAllGeneratedDisplayCards,
  selectAllTemplates,
  selectEditingCard,
  selectGeneratedDisplayCards,
  resolveGeneratorFrontTemplateId,
} from './store/selectors';
export { hydrateProjectWorkspaceForScope, useProjectStore } from './store/workspaceStore';
export type { ProjectState } from './store/workspaceStore';