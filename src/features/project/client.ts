export { BrowserStorageAlerts } from './components/BrowserStorageAlerts';
export { useBrowserWorkspaceSaveStatus } from './hooks/useBrowserWorkspaceSaveStatus';
export {
  buildProjectImportPreview,
  buildProjectImportSummary,
  useProjectFileActions,
} from './hooks/useProjectFileActions';
export type { ProjectImportMode, ProjectImportPreview } from './hooks/useProjectFileActions';
export {
  applyProjectDocumentToState,
  createProjectDocumentFromState,
  CUSTOM_DIVIDER_ASSETS_STORAGE_KEY,
  CUSTOM_ICON_ASSETS_STORAGE_KEY,
  CUSTOM_IMAGE_ASSETS_STORAGE_KEY,
  CUSTOM_TEXTURE_ASSETS_STORAGE_KEY,
  parseProjectDocumentFile,
} from './model/projectDocument';
export type {
  CreateProjectDocumentInput,
  ProjectDocumentCustomAssets,
  ProjectDocumentExportSettings,
  ProjectDocumentStatePatch,
  ProjectDocumentV1,
} from './model/projectDocument';
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
  MAX_LOCAL_ASSET_BYTES,
  MAX_LOCAL_ASSET_DIMENSION,
  optimizeLocalAssetFile,
  subscribeToBrowserWorkspaceSaveStatus,
  validateLocalAssetFile,
} from './persistence/indexedDbStorage';
export type { BrowserStorageHealth, BrowserStorageSaveStatus } from './persistence/indexedDbStorage';
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
  readTypedProjectAssetListFromStorage,
  writeProjectAssetListToStorage,
} from './persistence/projectAssets';
export type { ProjectAssetStorage } from './persistence/projectAssets';
export {
  selectAllTemplates,
  selectEditingCard,
  selectGeneratedDisplayCards,
} from './store/selectors';
export { useProjectStore } from './store/workspaceStore';
export type { ProjectState } from './store/workspaceStore';
