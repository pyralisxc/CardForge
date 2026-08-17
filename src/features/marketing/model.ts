export const MARKETING_AUDIENCES = [
  {
    id: 'tabletop-designers',
    label: 'Independent tabletop designers',
    role: 'Primary market',
  },
  {
    id: 'deck-creators',
    label: 'Tarot, oracle, affirmation, and conversation-deck creators',
    role: 'Validation market',
  },
  {
    id: 'small-publishers',
    label: 'Small publishers and design studios',
    role: 'Future recurring market',
  },
  {
    id: 'educators-facilitators',
    label: 'Educators, coaches, and facilitators',
    role: 'Future specialty',
  },
] as const;

export type MarketingAudienceId = typeof MARKETING_AUDIENCES[number]['id'];

export const MARKETING_CONTENT_PILLARS = [
  {
    id: 'product-proof',
    label: 'Product proof',
    purpose: 'Show one design becoming a complete, coherent set.',
  },
  {
    id: 'creator-education',
    label: 'Creator education',
    purpose: 'Help creators solve real prototype, set, export, and print problems.',
  },
  {
    id: 'build-in-public',
    label: 'Build in public',
    purpose: 'Share honest product progress and the reasoning behind it.',
  },
  {
    id: 'customer-research',
    label: 'Customer research',
    purpose: 'Ask focused questions that improve CardForge and reveal demand.',
  },
  {
    id: 'launch-update',
    label: 'Launch and product updates',
    purpose: 'Announce meaningful releases, access, and completed creator outcomes.',
  },
] as const;

export type MarketingContentPillar = typeof MARKETING_CONTENT_PILLARS[number]['id'];

export const MARKETING_SERVICES = [
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

export type MarketingService = typeof MARKETING_SERVICES[number];

export const MARKETING_SERVICE_LABELS: Record<MarketingService, string> = {
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
export type MarketingDestinationKind = 'owned' | 'community';
export type MarketingProvider = 'meta' | 'manual';
export type MarketingPublishingMode = 'automatic' | 'manual';
export type MarketingCampaignStatus = 'planning' | 'active' | 'paused' | 'completed' | 'cancelled';

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

export const DEFAULT_MARKETING_STRATEGY: MarketingStrategy = {
  primaryAudience: 'tabletop-designers',
  validationAudience: 'deck-creators',
  positioning: 'CardForge is the fastest way to turn one card design and a content list into a consistent, printable deck.',
  offer: 'Enter the Studio and build a complete set in your browser.',
  defaultCallToAction: 'Enter the Studio',
  enabledPillars: MARKETING_CONTENT_PILLARS.map((pillar) => pillar.id),
  approvedClaims: [
    'Design one card and bulk-generate a consistent set.',
    'Create, review, and export in the browser.',
    'Projects stay on the creator\'s device unless they intentionally submit shared work.',
  ],
  prohibitedClaims: [
    'Do not claim automatic printing or fulfillment until a production integration is live.',
    'Do not claim AI playtesting, game balancing, or legal/compliance approval.',
  ],
};

export interface MarketingDestination {
  id: string;
  name: string;
  service: MarketingService;
  kind: MarketingDestinationKind;
  provider: MarketingProvider;
  publishingMode: MarketingPublishingMode;
  externalAccountId: string;
  url: string;
  rulesUrl: string;
  rulesSummary: string;
  postingGuidance: string;
  audienceKeys: MarketingAudienceId[];
  active: boolean;
  rulesCheckedAt: string | null;
  createdAt: string;
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

export interface MarketingConnectionSummary {
  id: string;
  provider: 'meta';
  service: 'facebook' | 'instagram';
  externalAccountId: string;
  displayName: string;
  grantedScopes: string[];
  expiresAt: string | null;
  status: 'active' | 'expired' | 'revoked' | 'error';
  statusNote: string;
  lastVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MarketingCommandCenterView {
  configured: boolean;
  strategy: MarketingStrategyRecord;
  campaigns: MarketingCampaign[];
  destinations: MarketingDestination[];
  connections: MarketingConnectionSummary[];
  meta: {
    configured: boolean;
    publishingEnabled: boolean;
    missing: string[];
  };
}

export type MarketingStrategyInputResult =
  | { ok: true; value: MarketingStrategy }
  | { ok: false; message: string };

export type MarketingDestinationInputResult =
  | { ok: true; value: Omit<MarketingDestination, 'id' | 'rulesCheckedAt' | 'createdAt' | 'updatedAt'> }
  | { ok: false; message: string };

export type MarketingCampaignInputResult =
  | { ok: true; value: Omit<MarketingCampaign, 'id' | 'createdBy' | 'version' | 'createdAt' | 'updatedAt'> }
  | { ok: false; message: string };

const cleanSingleLine = (value: unknown): string => (
  typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ') : ''
);

const cleanLines = (value: unknown): string => (
  typeof value === 'string' ? value.trim().replace(/\r\n/gu, '\n') : ''
);

const uniqueLines = (value: unknown, limit: number): string[] => {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(cleanSingleLine).filter(Boolean))].slice(0, limit);
};

const normalizeHttpUrl = (value: unknown): string | null => {
  const input = cleanSingleLine(value);
  if (!input) return '';
  try {
    const url = new URL(input);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
};

const isAudience = (value: unknown): value is MarketingAudienceId => (
  typeof value === 'string'
  && MARKETING_AUDIENCES.some((audience) => audience.id === value)
);

const isPillar = (value: unknown): value is MarketingContentPillar => (
  typeof value === 'string'
  && MARKETING_CONTENT_PILLARS.some((pillar) => pillar.id === value)
);

const isService = (value: unknown): value is MarketingService => (
  typeof value === 'string' && MARKETING_SERVICES.includes(value as MarketingService)
);

const CAMPAIGN_STATUSES = new Set<MarketingCampaignStatus>([
  'planning', 'active', 'paused', 'completed', 'cancelled',
]);

const normalizeDate = (value: unknown): string | null | false => {
  const input = cleanSingleLine(value);
  if (!input) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(input)) return false;
  const parsed = new Date(`${input}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === input
    ? input
    : false;
};

const normalizeUtmKey = (value: unknown): string => cleanSingleLine(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/gu, '_')
  .replace(/^_+|_+$/gu, '');

export const normalizeMarketingCampaignInput = (
  input: Record<string, unknown>,
): MarketingCampaignInputResult => {
  const name = cleanSingleLine(input.name);
  const objective = cleanLines(input.objective);
  const offer = cleanLines(input.offer);
  const successMetric = cleanLines(input.successMetric);
  const utmCampaign = normalizeUtmKey(input.utmCampaign);
  const startsOn = normalizeDate(input.startsOn);
  const endsOn = normalizeDate(input.endsOn);
  if (!name || name.length > 160) {
    return { ok: false, message: 'Add a campaign name of 160 characters or fewer.' };
  }
  if (!objective || objective.length > 1_000) {
    return { ok: false, message: 'Add a campaign objective of 1,000 characters or fewer.' };
  }
  if (!isAudience(input.audienceKey)) {
    return { ok: false, message: 'Choose a supported campaign market.' };
  }
  if (!CAMPAIGN_STATUSES.has(input.status as MarketingCampaignStatus)) {
    return { ok: false, message: 'Choose a supported campaign status.' };
  }
  if (offer.length > 1_000 || successMetric.length > 1_000) {
    return { ok: false, message: 'Campaign offer and success metric must each be 1,000 characters or fewer.' };
  }
  if (!utmCampaign || utmCampaign.length > 120) {
    return { ok: false, message: 'Add a short campaign tracking key.' };
  }
  if (startsOn === false || endsOn === false) {
    return { ok: false, message: 'Campaign dates must use YYYY-MM-DD.' };
  }
  if (startsOn && endsOn && startsOn > endsOn) {
    return { ok: false, message: 'Campaign end date cannot be before its start date.' };
  }
  return {
    ok: true,
    value: {
      name,
      objective,
      audienceKey: input.audienceKey,
      offer,
      status: input.status as MarketingCampaignStatus,
      startsOn,
      endsOn,
      successMetric,
      utmCampaign,
    },
  };
};

export const normalizeMarketingStrategyInput = (
  input: Partial<Record<keyof MarketingStrategy, unknown>>,
): MarketingStrategyInputResult => {
  if (!isAudience(input.primaryAudience)) {
    return { ok: false, message: 'Choose a supported primary market.' };
  }
  if (!isAudience(input.validationAudience)) {
    return { ok: false, message: 'Choose a supported validation market.' };
  }
  if (input.primaryAudience === input.validationAudience) {
    return { ok: false, message: 'Primary and validation markets must be different.' };
  }
  const positioning = cleanLines(input.positioning);
  const offer = cleanLines(input.offer);
  const defaultCallToAction = cleanSingleLine(input.defaultCallToAction);
  if (!positioning || positioning.length > 1_000) {
    return { ok: false, message: 'Add a positioning statement of 1,000 characters or fewer.' };
  }
  if (!offer || offer.length > 1_000) {
    return { ok: false, message: 'Add a current offer of 1,000 characters or fewer.' };
  }
  if (!defaultCallToAction || defaultCallToAction.length > 200) {
    return { ok: false, message: 'Add a default call to action of 200 characters or fewer.' };
  }
  const enabledPillars = Array.isArray(input.enabledPillars)
    ? [...new Set(input.enabledPillars.filter(isPillar))]
    : [];
  if (!enabledPillars.length) {
    return { ok: false, message: 'Enable at least one content pillar.' };
  }
  return {
    ok: true,
    value: {
      primaryAudience: input.primaryAudience,
      validationAudience: input.validationAudience,
      positioning,
      offer,
      defaultCallToAction,
      enabledPillars,
      approvedClaims: uniqueLines(input.approvedClaims, 30),
      prohibitedClaims: uniqueLines(input.prohibitedClaims, 30),
    },
  };
};

export const normalizeMarketingDestinationInput = (
  input: Record<string, unknown>,
): MarketingDestinationInputResult => {
  const name = cleanSingleLine(input.name);
  if (!name || name.length > 160) {
    return { ok: false, message: 'Add a destination name of 160 characters or fewer.' };
  }
  if (!isService(input.service)) {
    return { ok: false, message: 'Choose a supported marketing channel.' };
  }
  if (input.kind !== 'owned' && input.kind !== 'community') {
    return { ok: false, message: 'Choose an owned account or community destination.' };
  }
  const community = input.kind === 'community';
  const provider = community
    ? 'manual'
    : input.provider === 'meta'
      ? input.provider
      : 'manual';
  const publishingMode = community
    ? 'manual'
    : input.publishingMode === 'automatic'
      ? 'automatic'
      : 'manual';
  if (community && (input.provider === 'meta' || input.publishingMode === 'automatic')) {
    return { ok: false, message: 'Community destinations must use guided manual publishing.' };
  }
  const url = normalizeHttpUrl(input.url);
  const rulesUrl = normalizeHttpUrl(input.rulesUrl);
  if (url === null || rulesUrl === null) {
    return { ok: false, message: 'Destination and rules links must use HTTP or HTTPS.' };
  }
  if (community && !url) {
    return { ok: false, message: 'Add the community destination link.' };
  }
  const audienceKeys = Array.isArray(input.audienceKeys)
    ? [...new Set(input.audienceKeys.filter(isAudience))]
    : [];
  return {
    ok: true,
    value: {
      name,
      service: input.service,
      kind: input.kind,
      provider,
      publishingMode,
      externalAccountId: cleanSingleLine(input.externalAccountId).slice(0, 500),
      url: url ?? '',
      rulesUrl: rulesUrl ?? '',
      rulesSummary: cleanLines(input.rulesSummary).slice(0, 2_000),
      postingGuidance: cleanLines(input.postingGuidance).slice(0, 2_000),
      audienceKeys,
      active: input.active !== false,
    },
  };
};
