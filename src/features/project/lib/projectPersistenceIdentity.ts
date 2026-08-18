export type ProjectPersistenceScope = `account:${string}` | 'guest' | 'local';

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
