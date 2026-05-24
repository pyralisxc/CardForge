import { currentUser } from '@clerk/nextjs/server';

import { isClerkAuthConfigured } from '@/lib/accountEntitlement';
import { resolveOwnerAccess, type OwnerAccess } from '@/lib/ownerAccess';

export const getCurrentOwnerAccess = async (): Promise<OwnerAccess & { userId: string | null; email: string | null }> => {
  const authConfigured = isClerkAuthConfigured();
  if (!authConfigured) {
    return { isOwner: false, source: 'none', userId: null, email: null };
  }

  const user = await currentUser();
  const emailAddresses = user?.emailAddresses.map((email) => email.emailAddress) ?? [];
  const access = resolveOwnerAccess({
    authConfigured,
    isSignedIn: Boolean(user),
    emailAddresses,
    publicMetadata: user?.publicMetadata,
    privateMetadata: user?.privateMetadata,
  });

  return {
    ...access,
    userId: user?.id ?? null,
    email: user?.primaryEmailAddress?.emailAddress ?? emailAddresses[0] ?? null,
  };
};
