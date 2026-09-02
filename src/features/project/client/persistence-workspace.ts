export {
  discardBrowserWorkspaceRecovery,
  getBrowserWorkspaceRecoveryState,
  restoreBrowserWorkspaceRecovery,
  type BrowserWorkspaceRecoverySource,
  type BrowserWorkspaceRecoveryState,
} from '../persistence/projectPersistenceScope';
export {
  BROWSER_WORKSPACE_RECORD_VERSION,
  BrowserWorkspaceConflictError,
  parseBrowserWorkspaceRecord,
  resolveGuestWorkspaceAdoption,
  serializeBrowserWorkspaceRecord,
} from '../persistence/workspaceRevision';
export type {
  BrowserWorkspaceRecord,
  GuestWorkspaceAdoptionChoice,
  ParsedBrowserWorkspaceRecord,
} from '../persistence/workspaceRevision';
export {
  applyGuestWorkspaceAdoption,
  inspectGuestWorkspaceAdoption,
} from '../persistence/guestWorkspaceAdoption';
export type { GuestWorkspaceAdoptionOffer } from '../persistence/guestWorkspaceAdoption';
export {
  BROWSER_WORKSPACE_REMOTE_CHANGE_EVENT,
  createProjectPersistenceScope,
  createScopedProjectStorage,
  getProjectPersistenceScope,
  getScopedProjectStorageNamespace,
  LEGACY_PROJECT_ASSETS_NAMESPACE,
  LEGACY_PROJECT_WORKSPACE_NAMESPACE,
  setProjectPersistenceScope,
} from '../persistence/projectPersistenceScope';
export type { ProjectPersistenceScope } from '../persistence/projectPersistenceScope';
