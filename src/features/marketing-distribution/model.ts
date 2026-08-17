import {
  MARKETING_AUDIENCES,
  MARKETING_CHANNELS,
  type MarketingAudienceId,
  type MarketingChannel,
} from '@/domain/marketing';

export type MarketingDestinationKind = 'owned' | 'community';
export type MarketingProvider = 'meta' | 'manual';
export type MarketingPublishingMode = 'automatic' | 'manual';

export interface MarketingDestination {
  id: string;
  name: string;
  service: MarketingChannel;
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

export interface MarketingDistributionView {
  configured: boolean;
  destinations: MarketingDestination[];
  connections: MarketingConnectionSummary[];
  meta: {
    configured: boolean;
    publishingEnabled: boolean;
    missing: string[];
  };
}

export type MarketingDestinationInputResult =
  | { ok: true; value: Omit<MarketingDestination, 'id' | 'rulesCheckedAt' | 'createdAt' | 'updatedAt'> }
  | { ok: false; message: string };

const cleanSingleLine = (value: unknown): string => (
  typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ') : ''
);

const cleanLines = (value: unknown): string => (
  typeof value === 'string' ? value.trim().replace(/\r\n/gu, '\n') : ''
);

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

const isChannel = (value: unknown): value is MarketingChannel => (
  typeof value === 'string'
  && MARKETING_CHANNELS.includes(value as MarketingChannel)
);

export const normalizeMarketingDestinationInput = (
  input: Record<string, unknown>,
): MarketingDestinationInputResult => {
  const name = cleanSingleLine(input.name);
  if (!name || name.length > 160) {
    return { ok: false, message: 'Add a destination name of 160 characters or fewer.' };
  }
  if (!isChannel(input.service)) {
    return { ok: false, message: 'Choose a supported marketing channel.' };
  }
  if (input.kind !== 'owned' && input.kind !== 'community') {
    return { ok: false, message: 'Choose an owned account or community destination.' };
  }
  const community = input.kind === 'community';
  const provider = community ? 'manual' : input.provider === 'meta' ? 'meta' : 'manual';
  const publishingMode = community
    ? 'manual'
    : input.publishingMode === 'automatic' ? 'automatic' : 'manual';
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
