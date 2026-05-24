import { currentUser } from '@clerk/nextjs/server';

import { isClerkAuthConfigured, resolveAccountEntitlement } from '@/lib/accountEntitlement';
import { resolveOwnerAccess } from '@/lib/ownerAccess';
import { isShippedLibraryWriteEnabled } from '@/lib/projectAccess';

export const canCurrentAccountWriteShippedLibrary = async (): Promise<boolean> => {
  if (process.env.CARDFORGE_ALLOW_LIBRARY_WRITES !== 'true') return false;

  if (!isClerkAuthConfigured()) {
    return isShippedLibraryWriteEnabled();
  }

  const user = await currentUser();
  if (!user) return false;
  const emailAddresses = user.emailAddresses.map((email) => email.emailAddress);
  const ownerAccess = resolveOwnerAccess({
    authConfigured: true,
    isSignedIn: true,
    emailAddresses,
    publicMetadata: user.publicMetadata,
    privateMetadata: user.privateMetadata,
  });

  const entitlement = resolveAccountEntitlement({
    authConfigured: true,
    isSignedIn: true,
    emailAddresses,
    privateMetadata: user.privateMetadata,
    ownerAccess,
  });

  return entitlement.capabilities.canWriteShippedLibrary;
};
