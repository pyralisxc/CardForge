import { revalidateTag, unstable_cache } from 'next/cache';

import { getBusinessIdentity } from './businessIdentityStore';

export const PUBLIC_IDENTITY_TAG = 'public:business-identity';

export const getCachedBusinessIdentity = unstable_cache(
  getBusinessIdentity,
  ['public-business-identity'],
  { tags: [PUBLIC_IDENTITY_TAG], revalidate: 3600 },
);

export const revalidatePublicIdentityCache = (): void => {
  try {
    revalidateTag(PUBLIC_IDENTITY_TAG, { expire: 0 });
  } catch (error) {
    console.error('Unable to invalidate public business identity cache:', error);
  }
};
