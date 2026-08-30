import 'server-only';

import { auth } from '@clerk/nextjs/server';

import {
  AccountToolAccessError,
  getAccountToolAccessForUserId,
} from '@/features/account/server';
import {
  getContributorCapabilities,
  type ContributorAccessProjection,
  type ContributorScope,
} from '@/features/contributor-access/server';
import type { StudioAgentAccess } from '@/features/studio-documents/server';

export interface McpStudioAccess extends StudioAgentAccess {
  contribution: ContributorAccessProjection;
  isContributor: boolean;
  scopes: ContributorScope[];
}

export const getMcpStudioAccess = async (): Promise<McpStudioAccess> => {
  const clerkAuth = await auth({ acceptsToken: 'oauth_token' });
  if (!clerkAuth.userId) {
    throw new AccountToolAccessError('A linked CardForge account is required.', 401);
  }
  const account = await getAccountToolAccessForUserId(clerkAuth.userId);
  const contribution = await getContributorCapabilities(account);
  return {
    ...account,
    contribution,
    isContributor: contribution.active,
    scopes: [...contribution.scopes],
  };
};
