import { revalidateTag, unstable_cache } from 'next/cache';

import { DEFAULT_FOUNDER_PROFILE, type FounderProfile } from '../model/founderProfile';
import { getFounderProfile, FounderProfileStoreError } from './founderProfileStore';

export const FOUNDER_PROFILE_TAG = 'public:founder-profile';

const readCachedFounderProfile = unstable_cache(
  async (): Promise<FounderProfile> => getFounderProfile(),
  ['public-founder-profile'],
  { tags: [FOUNDER_PROFILE_TAG], revalidate: 3600 },
);

export const getCachedFounderProfile = async (): Promise<FounderProfile> => {
  try {
    return await readCachedFounderProfile();
  } catch (error) {
    console.error('Unable to load founder profile; using compiled defaults for this request.', error);
    return { ...DEFAULT_FOUNDER_PROFILE, priorities: [...DEFAULT_FOUNDER_PROFILE.priorities] };
  }
};

export const revalidateFounderProfile = (): void => {
  try {
    revalidateTag(FOUNDER_PROFILE_TAG, { expire: 0 });
  } catch (error) {
    console.error('Unable to invalidate founder profile cache:', error);
    throw new FounderProfileStoreError('The profile was saved, but the public cache could not be refreshed. Retry saving to refresh it.', 503);
  }
};
