import { revalidateTag, unstable_cache } from 'next/cache';

import type { FounderProfile } from '../model/founderProfile';
import { getFounderProfile } from './founderProfileStore';

export const FOUNDER_PROFILE_TAG = 'public:founder-profile';

export const getCachedFounderProfile = unstable_cache(
  async (): Promise<FounderProfile> => getFounderProfile(),
  ['public-founder-profile'],
  { tags: [FOUNDER_PROFILE_TAG], revalidate: 3600 },
);

export const revalidateFounderProfile = (): void => {
  try {
    revalidateTag(FOUNDER_PROFILE_TAG, { expire: 0 });
  } catch (error) {
    console.error('Unable to invalidate founder profile cache:', error);
  }
};
