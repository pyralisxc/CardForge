export * from './lib/assetRegistry';
export * from './lib/developerAssets';
export * from './lib/developerAssetStore';
export * from './lib/developerAssetRegistryCommands';
export * from './lib/developerAssetUploadPolicy';
export * from './lib/developerAssetUploadSubmission';
export * from './lib/registryContentAssets';
export * from './lib/registryFonts';

import { currentUser } from '@clerk/nextjs/server';

import { isShippedLibraryWriteEnabled, resolveOwnerAccess } from '@/domain/entitlements';
import { isClerkAuthConfigured, resolveAccountEntitlement } from '@/features/account/server';

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
