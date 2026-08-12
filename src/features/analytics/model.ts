export const ANALYTICS_CONSENT_COOKIE = 'cardforge_analytics_consent_v1';
export const ANALYTICS_SESSION_CONSENT_KEY = 'cardforge.analytics.session-consent.v1';
export const ANALYTICS_SIGN_UP_INTENT_KEY = 'cardforge.analytics.sign-up-intent.v1';

export const isAllowedPostHogHost = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && url.pathname === '/'
      && !url.search
      && !url.hash
      && (url.hostname === 'posthog.com' || url.hostname.endsWith('.posthog.com'));
  } catch {
    return false;
  }
};

export const isValidPostHogProjectId = (value: string): boolean => /^\d+$/u.test(value.trim());

export type AnalyticsConsentPreference = 'granted' | 'granted_once' | 'denied';

export type CardForgeAnalyticsEventName =
  | 'open_studio'
  | 'sign_up'
  | 'navigation_selected'
  | 'template_creation_started'
  | 'template_created'
  | 'card_format_changed'
  | 'card_back_selected'
  | 'matching_back_requested'
  | 'generation_method_selected'
  | 'card_created'
  | 'export_started'
  | 'export_failed'
  | 'export_completed';

export type ProductAnalyticsEventName = CardForgeAnalyticsEventName | 'page_viewed';

export const PRODUCT_ANALYTICS_EVENT_NAMES: ProductAnalyticsEventName[] = [
  'page_viewed',
  'open_studio',
  'sign_up',
  'navigation_selected',
  'template_creation_started',
  'template_created',
  'card_format_changed',
  'card_back_selected',
  'matching_back_requested',
  'generation_method_selected',
  'card_created',
  'export_started',
  'export_failed',
  'export_completed',
];

export type AnalyticsEventParameter = string | number | boolean;
export type AnalyticsEventParameters = Record<string, AnalyticsEventParameter>;

const ALLOWED_EVENT_PARAMETERS = new Set([
  'placement',
  'method',
  'creation_method',
  'destination',
  'failure_stage',
  'format_id',
  'format_kind',
  'generation_method',
  'has_matching_back',
  'path',
  'resize_strategy',
  'side',
  'starting_point',
  'export_kind',
  'card_count',
  'success',
]);

export const sanitizeAnalyticsEventParameters = (
  input: Record<string, unknown>,
): AnalyticsEventParameters => Object.fromEntries(
  Object.entries(input).filter(([key, value]) => {
    if (!ALLOWED_EVENT_PARAMETERS.has(key)) return false;
    if (typeof value === 'string') return value.length > 0 && value.length <= 100;
    if (typeof value === 'number') return Number.isFinite(value);
    return typeof value === 'boolean';
  }) as Array<[string, AnalyticsEventParameter]>,
);

export const normalizeOrganicCampaignToken = (value: string): string => value
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/gu, '_')
  .replace(/^_+|_+$/gu, '')
  .slice(0, 100);

export interface OrganicCampaignUrlInput {
  destinationUrl: string;
  source: string;
  campaign: string;
  content?: string;
}

export const buildOrganicCampaignUrl = ({
  destinationUrl,
  source,
  campaign,
  content = '',
}: OrganicCampaignUrlInput): string => {
  const url = new URL(destinationUrl);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Destination must use HTTP or HTTPS.');
  const normalizedSource = normalizeOrganicCampaignToken(source);
  const normalizedCampaign = normalizeOrganicCampaignToken(campaign);
  const normalizedContent = normalizeOrganicCampaignToken(content);
  if (!normalizedSource) throw new Error('Add a campaign source.');
  if (!normalizedCampaign) throw new Error('Add a campaign name.');
  url.searchParams.set('utm_source', normalizedSource);
  url.searchParams.set('utm_medium', 'organic_social');
  url.searchParams.set('utm_campaign', normalizedCampaign);
  if (normalizedContent) url.searchParams.set('utm_content', normalizedContent);
  else url.searchParams.delete('utm_content');
  return url.toString();
};

export interface AnalyticsConfigurationStatus {
  collectionEnabled: boolean;
  measurementIdConfigured: boolean;
  reportingConfigured: boolean;
  searchConsoleConfigured: boolean;
  interactionCollectionConfigured: boolean;
  interactionReportingConfigured: boolean;
  missing: string[];
}

export interface AnalyticsMetricRow {
  label: string;
  value: number;
  secondaryValue?: number;
}

export interface OrganicCampaignMetricRow {
  source: string;
  medium: string;
  campaign: string;
  content: string;
  sessions: number;
  users: number;
  events: number;
  keyEvents: number;
}

export interface AnalyticsAdoptionRow {
  eventName: CardForgeAnalyticsEventName;
  label: string;
  users: number;
  events: number;
}

export interface SearchPerformanceRow {
  label: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface ProductAnalyticsRecentEvent {
  occurredAt: string;
  eventName: ProductAnalyticsEventName;
  path: string;
  detail: string;
}

export interface OwnerAnalyticsSnapshot {
  capturedAt: string;
  rangeDays: number;
  configuration: AnalyticsConfigurationStatus;
  realtime: {
    activeUsers: number;
    pages: AnalyticsMetricRow[];
    events: AnalyticsMetricRow[];
    devices: AnalyticsMetricRow[];
  };
  overview: {
    users: number;
    sessions: number;
    pageViews: number;
    events: number;
    keyEvents: number;
  };
  campaigns: OrganicCampaignMetricRow[];
  journey: AnalyticsAdoptionRow[];
  search: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    queries: SearchPerformanceRow[];
    pages: SearchPerformanceRow[];
    sitemap: {
      status: string;
      lastSubmitted: string | null;
      lastDownloaded: string | null;
      errors: number;
      warnings: number;
    } | null;
  };
  interactions: {
    activeVisitors: number;
    recentEvents: ProductAnalyticsRecentEvent[];
    events: AnalyticsMetricRow[];
    paths: AnalyticsMetricRow[];
    recordingsUrl: string | null;
  };
  availability: {
    realtime: boolean;
    realtimePages: boolean;
    realtimeEvents: boolean;
    realtimeDevices: boolean;
    overview: boolean;
    campaigns: boolean;
    journey: boolean;
    search: boolean;
    searchQueries: boolean;
    searchPages: boolean;
    sitemap: boolean;
    interactionLive: boolean;
    interactionRecent: boolean;
    interactionEvents: boolean;
    interactionPaths: boolean;
  };
  warnings: string[];
}
