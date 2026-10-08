import 'server-only';

import { auth } from '@clerk/nextjs/server';

import {
  AccountToolAccessError,
  getAccountToolAccessForUserId,
  type AccountToolAccess,
} from '@/features/account/server';

export type McpOwnerAccess = AccountToolAccess & { isOwner: true };

export const getMcpOwnerAccess = async (): Promise<McpOwnerAccess> => {
  const clerkAuth = await auth({ acceptsToken: 'oauth_token' });
  if (!clerkAuth.userId) {
    throw new AccountToolAccessError('A linked CardForge account is required.', 401);
  }
  const access = await getAccountToolAccessForUserId(clerkAuth.userId);
  if (!access.isOwner) {
    throw new AccountToolAccessError('CardForge Owner access is required for this plugin.', 403);
  }
  return { ...access, isOwner: true };
};
