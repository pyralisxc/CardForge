import type { AccountToolAccess } from '@/features/account/server';
import type { ContributorScope } from '@/features/contributor-access/server';

export interface StudioAgentAccess extends AccountToolAccess {
  isContributor: boolean;
  scopes: readonly ContributorScope[];
}
