export type ProjectPersistenceScope = `account:${string}` | 'guest' | 'local';

const DISABLED_SCOPE = 'unscoped-disabled';
let activeProjectPersistenceScope: ProjectPersistenceScope | typeof DISABLED_SCOPE = DISABLED_SCOPE;

export const createProjectPersistenceScope = ({
  authConfigured,
  accountUserId,
}: {
  authConfigured: boolean;
  accountUserId?: string | null;
}): ProjectPersistenceScope => {
  if (!authConfigured) return 'local';
  if (!accountUserId) return 'guest';
  return `account:${encodeURIComponent(accountUserId)}`;
};

export const setProjectPersistenceScope = (scope: ProjectPersistenceScope) => {
  activeProjectPersistenceScope = scope;
};

export const getProjectPersistenceScope = () => activeProjectPersistenceScope;

export const getScopedProjectStorageNamespace = (
  baseNamespace: 'project-workspace' | 'project-assets',
  scope: ProjectPersistenceScope | typeof DISABLED_SCOPE = activeProjectPersistenceScope,
) => `${baseNamespace}:${scope}`;

export const LEGACY_PROJECT_WORKSPACE_NAMESPACE = 'project-workspace';
export const LEGACY_PROJECT_ASSETS_NAMESPACE = 'project-assets';
