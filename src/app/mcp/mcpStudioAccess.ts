import 'server-only';

import { auth } from '@clerk/nextjs/server';

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
  return getDeveloperCockpitAccessForUserId(clerkAuth.userId);
};
