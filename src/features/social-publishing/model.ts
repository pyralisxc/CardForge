export const SOCIAL_SERVICES = [
  'facebook',
  'instagram',
  'threads',
  'bluesky',
  'linkedin',
  'x',
  'pinterest',
  'tiktok',
  'youtube',
  'mastodon',
  'googlebusiness',
] as const;

export type SocialService = typeof SOCIAL_SERVICES[number];

export const SOCIAL_SERVICE_LABELS: Record<SocialService, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  threads: 'Threads',
  bluesky: 'Bluesky',
  linkedin: 'LinkedIn',
  x: 'X',
  pinterest: 'Pinterest',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  mastodon: 'Mastodon',
  googlebusiness: 'Google Business',
};

export type SocialPublishJobStatus =
  | 'provider_draft'
  | 'scheduled'
  | 'published'
  | 'failed'
  | 'cancelled'
  | 'unknown';
