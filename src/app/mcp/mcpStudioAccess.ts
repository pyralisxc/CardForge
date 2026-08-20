import 'server-only';

import { auth } from '@clerk/nextjs/server';

import {
  getCardforgeUserAccessForUserId,
  resolveAccountEntitlement,
} from '@/features/account/server';
import {
  DeveloperCockpitAccessError,
  getDeveloperCockpitAccessForUserId,
  type DeveloperCockpitAccess,
} from '@/features/developer-access/server';

export const getMcpStudioAccess = async (): Promise<DeveloperCockpitAccess> => {
  const clerkAuth = await auth({ acceptsToken: 'oauth_token' });
  if (!clerkAuth.userId) {
    throw new DeveloperCockpitAccessError('A linked CardForge account is required.', 401);
  }

  const accountAccess = await getCardforgeUserAccessForUserId(clerkAuth.userId);
  if (!accountAccess.user) {
    throw new DeveloperCockpitAccessError('A linked CardForge account is required.', 401);
  }

  const entitlement = resolveAccountEntitlement({
    accountUserId: accountAccess.user.id,
    authConfigured: accountAccess.authConfigured,
    isSignedIn: true,
    emailAddresses: accountAccess.user.emailAddresses,
    privateMetadata: accountAccess.user.privateMetadata,
    ownerAccess: accountAccess.ownerAccess,
  });

  if (accountAccess.ownerAccess.isOwner) {
    return getDeveloperCockpitAccessForUserId(clerkAuth.userId);
  }

  if (entitlement.accessMode === 'dev') {
    return getDeveloperCockpitAccessForUserId(clerkAuth.userId);
  }

  return {
    user: accountAccess.user,
    isDeveloper: false,
    isOwner: false,
    email: accountAccess.user.email,
    displayName: [accountAccess.user.firstName, accountAccess.user.lastName].filter(Boolean).join(' ').trim()
      || accountAccess.user.email,
    scopes: ['studio.ai.create'],
  };
};
