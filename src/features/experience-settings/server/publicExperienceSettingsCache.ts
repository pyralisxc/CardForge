import { revalidateTag, unstable_cache } from 'next/cache';

import { getExperienceSettings } from './experienceSettingsStore';

export const EXPERIENCE_SETTINGS_TAG = 'public:experience-settings';

export const getCachedExperienceSettings = unstable_cache(
  getExperienceSettings,
  ['public-experience-settings'],
  { tags: [EXPERIENCE_SETTINGS_TAG], revalidate: 3600 },
);

export const revalidateExperienceSettingsCache = (): void => {
  try {
    revalidateTag(EXPERIENCE_SETTINGS_TAG, { expire: 0 });
  } catch (error) {
    console.error('Unable to invalidate public experience settings cache:', error);
  }
};
