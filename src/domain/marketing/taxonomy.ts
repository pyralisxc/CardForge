export const MARKETING_AUDIENCES = [
  { id: 'tabletop-designers', label: 'Independent tabletop designers', role: 'Primary market' },
  { id: 'deck-creators', label: 'Tarot, oracle, affirmation, and conversation-deck creators', role: 'Validation market' },
  { id: 'small-publishers', label: 'Small publishers and design studios', role: 'Future recurring market' },
  { id: 'educators-facilitators', label: 'Educators, coaches, and facilitators', role: 'Future specialty' },
] as const;

export type MarketingAudienceId = typeof MARKETING_AUDIENCES[number]['id'];

export const MARKETING_CONTENT_PILLARS = [
  { id: 'product-proof', label: 'Product proof', purpose: 'Show one design becoming a complete, coherent set.' },
  { id: 'creator-education', label: 'Creator education', purpose: 'Help creators solve real prototype, set, export, and print problems.' },
  { id: 'build-in-public', label: 'Build in public', purpose: 'Share honest product progress and the reasoning behind it.' },
  { id: 'customer-research', label: 'Customer research', purpose: 'Ask focused questions that improve CardForge and reveal demand.' },
  { id: 'launch-update', label: 'Launch and product updates', purpose: 'Announce meaningful releases, access, and completed creator outcomes.' },
] as const;

export type MarketingContentPillar = typeof MARKETING_CONTENT_PILLARS[number]['id'];

export const MARKETING_CHANNELS = [
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
  'reddit',
  'discord',
  'boardgamegeek',
] as const;

export type MarketingChannel = typeof MARKETING_CHANNELS[number];

export const MARKETING_CHANNEL_LABELS: Record<MarketingChannel, string> = {
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
  reddit: 'Reddit',
  discord: 'Discord',
  boardgamegeek: 'BoardGameGeek',
};

export const MARKETING_FUNNEL_STAGES = [
  'awareness',
  'consideration',
  'activation',
  'feedback',
] as const;

export type MarketingFunnelStage = typeof MARKETING_FUNNEL_STAGES[number];

export const MARKETING_CONTENT_KINDS = [
  'demonstration',
  'education',
  'question',
  'update',
  'creator-story',
] as const;

export type MarketingContentKind = typeof MARKETING_CONTENT_KINDS[number];

export type MarketingCampaignStatus =
  | 'planning'
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled';

export interface MarketingStrategy {
  primaryAudience: MarketingAudienceId;
  validationAudience: MarketingAudienceId;
  positioning: string;
  offer: string;
  defaultCallToAction: string;
  enabledPillars: MarketingContentPillar[];
  approvedClaims: string[];
  prohibitedClaims: string[];
}

export interface MarketingStrategyRecord extends MarketingStrategy {
  version: number;
  updatedBy: string | null;
  updatedAt: string;
}

export interface MarketingCampaign {
  id: string;
  createdBy: string;
  name: string;
  objective: string;
  audienceKey: MarketingAudienceId;
  offer: string;
  status: MarketingCampaignStatus;
  startsOn: string | null;
  endsOn: string | null;
  successMetric: string;
  utmCampaign: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type MarketingDeliveryStatus =
  | 'planned'
  | 'ready'
  | 'provider_draft'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'cancelled'
  | 'skipped'
  | 'unknown';
