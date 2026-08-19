import { revalidateTag, unstable_cache } from 'next/cache';

import { DEFAULT_BUSINESS_IDENTITY } from '../model/businessIdentity';
import { getBusinessIdentity } from './businessIdentityStore';

export const PUBLIC_IDENTITY_TAG = 'public:business-identity';

const getPublicBusinessIdentity = async () => {
  try {
    return await getBusinessIdentity();
  } catch (error) {
    console.error('Unable to load public business identity; using compiled defaults:', error);
    return { ...DEFAULT_BUSINESS_IDENTITY };
  }
};

export const getCachedBusinessIdentity = unstable_cache(
  getPublicBusinessIdentity,
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
