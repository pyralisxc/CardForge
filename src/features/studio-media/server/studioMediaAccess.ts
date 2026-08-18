import { getCurrentCardforgeEntitlement } from '@/features/account/server';

import { StudioMediaError } from './StudioMediaError';

export const getCurrentStudioMediaAccount = async () => {
  const entitlement = await getCurrentCardforgeEntitlement();
  if (!entitlement.authConfigured || !entitlement.isSignedIn || !entitlement.accountUserId) {
    throw new StudioMediaError('Sign in before using personal Studio media.', 401);
  }
  return {
    ownerUserId: entitlement.accountUserId,
    entitlement,
  };
};
