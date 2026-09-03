import {
  MARKETING_AUDIENCES,
  MARKETING_CONTENT_PILLARS,
  type MarketingAudienceId,
  type MarketingCampaign,
  type MarketingCampaignStatus,
  type MarketingContentPillar,
  type MarketingStrategy,
  type MarketingStrategyRecord,
} from '@/domain/marketing';
import type {
  MarketingConnectionSummary,
  MarketingDestination,
} from '@/features/marketing-distribution/client';

export {
  MARKETING_AUDIENCES,
  MARKETING_CHANNELS as MARKETING_SERVICES,
  MARKETING_CHANNEL_LABELS as MARKETING_SERVICE_LABELS,
  MARKETING_CONTENT_KINDS,
  MARKETING_CONTENT_PILLARS,
  MARKETING_FUNNEL_STAGES,
  type MarketingAudienceId,
  type MarketingCampaign,
  type MarketingCampaignStatus,
  type MarketingChannel as MarketingService,
  type MarketingContentKind,
  type MarketingContentPillar,
  type MarketingFunnelStage,
  type MarketingStrategy,
  type MarketingStrategyRecord,
} from '@/domain/marketing';
export {
  normalizeMarketingDestinationInput,
  type MarketingConnectionSummary,
  type MarketingDestination,
  type MarketingDestinationInputResult,
  type MarketingDestinationKind,
  type MarketingProvider,
  type MarketingPublishingMode,
} from '@/features/marketing-distribution/client';
export const DEFAULT_MARKETING_STRATEGY: MarketingStrategy = {
  primaryAudience: 'tabletop-designers',
  validationAudience: 'deck-creators',
  positioning: 'CardForge is the fastest way to turn one card design and a content list into a consistent, printable deck.',
  offer: 'Open your Desk and build a complete Set in your browser.',
  defaultCallToAction: 'Open your Desk',
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

const isAudience = (value: unknown): value is MarketingAudienceId => (
  typeof value === 'string'
  && MARKETING_AUDIENCES.some((audience) => audience.id === value)
);

const isPillar = (value: unknown): value is MarketingContentPillar => (
  typeof value === 'string'
  && MARKETING_CONTENT_PILLARS.some((pillar) => pillar.id === value)
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
