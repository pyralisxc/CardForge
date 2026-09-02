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
} from '../persistence/indexedDbStorage';
export type { BrowserStorageHealth, BrowserStorageSaveStatus } from '../persistence/indexedDbStorage';
