import type {
  AnalyticsAdoptionRow,
  AnalyticsMetricRow,
  CardForgeAnalyticsEventName,
  OrganicCampaignMetricRow,
  OwnerAnalyticsSnapshot,
  SearchPerformanceRow,
} from '../model';
import { getAnalyticsConfigurationStatus } from './configuration';
import { getGoogleReadOnlyAccessToken } from './googleAccessToken';

const ANALYTICS_API_ROOT = 'https://analyticsdata.googleapis.com/v1beta';
const SEARCH_CONSOLE_API_ROOT = 'https://searchconsole.googleapis.com/webmasters/v3';
const REPORT_RANGE_DAYS = 28;
const JOURNEY_EVENTS: Array<{ eventName: CardForgeAnalyticsEventName; label: string }> = [
  { eventName: 'open_studio', label: 'Opened Studio' },
  { eventName: 'sign_up', label: 'Created account' },
  { eventName: 'card_created', label: 'Created cards' },
  { eventName: 'export_completed', label: 'Completed export' },
];

interface GoogleReportRow {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Array<{ value?: string }>;
}

interface GoogleAnalyticsReport {
  dimensionHeaders?: Array<{ name?: string }>;
  metricHeaders?: Array<{ name?: string }>;
  rows?: GoogleReportRow[];
}

interface SearchAnalyticsResponse {
  rows?: Array<{
    keys?: string[];
    clicks?: number;
    impressions?: number;
    ctr?: number;
    position?: number;
  }>;
}

interface SearchConsoleSitemapsResponse {
  sitemap?: Array<{
    path?: string;
    lastSubmitted?: string;
    lastDownloaded?: string;
    isPending?: boolean;
    warnings?: string;
    errors?: string;
  }>;
}

const numberValue = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const emptySnapshot = (): OwnerAnalyticsSnapshot => ({
  capturedAt: new Date().toISOString(),
  rangeDays: REPORT_RANGE_DAYS,
  configuration: getAnalyticsConfigurationStatus(),
  realtime: { activeUsers: 0, pages: [], events: [], devices: [] },
  overview: { users: 0, sessions: 0, pageViews: 0, events: 0, keyEvents: 0 },
  campaigns: [],
  journey: JOURNEY_EVENTS.map((step) => ({ ...step, users: 0, events: 0 })),
  search: { clicks: 0, impressions: 0, ctr: 0, position: 0, queries: [], pages: [], sitemap: null },
  interactions: { activeVisitors: 0, recentEvents: [], events: [], paths: [], recordingsUrl: null },
  availability: {
    realtime: false,
    realtimePages: false,
    realtimeEvents: false,
    realtimeDevices: false,
    overview: false,
    campaigns: false,
    journey: false,
    search: false,
    searchQueries: false,
    searchPages: false,
    sitemap: false,
    interactionLive: false,
    interactionRecent: false,
    interactionEvents: false,
    interactionPaths: false,
  },
  warnings: [],
});

const googleJson = async <T>(url: string, accessToken: string, body?: unknown): Promise<T> => {
  const response = await fetch(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Google reporting request failed with status ${response.status}.`);
  return response.json() as Promise<T>;
};

const mapGoogleRows = (report: GoogleAnalyticsReport) => {
  const dimensions = report.dimensionHeaders?.map(({ name }) => name ?? '') ?? [];
  const metrics = report.metricHeaders?.map(({ name }) => name ?? '') ?? [];
  return (report.rows ?? []).map((row) => ({
    dimensions: Object.fromEntries(dimensions.map((name, index) => [name, row.dimensionValues?.[index]?.value ?? ''])),
    metrics: Object.fromEntries(metrics.map((name, index) => [name, numberValue(row.metricValues?.[index]?.value)])),
  }));
};

const analyticsReport = (
  propertyId: string,
  accessToken: string,
  method: 'runReport' | 'runRealtimeReport',
  body: unknown,
) => googleJson<GoogleAnalyticsReport>(
  `${ANALYTICS_API_ROOT}/properties/${encodeURIComponent(propertyId)}:${method}`,
  accessToken,
  body,
);

const reportBody = (dimensions: string[], metrics: string[], extra: Record<string, unknown> = {}) => ({
  dateRanges: [{ startDate: `${REPORT_RANGE_DAYS - 1}daysAgo`, endDate: 'today' }],
  dimensions: dimensions.map((name) => ({ name })),
  metrics: metrics.map((name) => ({ name })),
  ...extra,
});

const realtimeBody = (dimensions: string[], metrics: string[], extra: Record<string, unknown> = {}) => ({
  dimensions: dimensions.map((name) => ({ name })),
  metrics: metrics.map((name) => ({ name })),
  ...extra,
});

const toMetricRows = (
  report: GoogleAnalyticsReport,
  dimension: string,
  metric: string,
  secondaryMetric?: string,
): AnalyticsMetricRow[] => mapGoogleRows(report).map(({ dimensions, metrics }) => ({
  label: dimensions[dimension] || 'Direct / unknown',
  value: metrics[metric] ?? 0,
  ...(secondaryMetric ? { secondaryValue: metrics[secondaryMetric] ?? 0 } : {}),
}));

const toSearchRows = (report: SearchAnalyticsResponse): SearchPerformanceRow[] => (report.rows ?? []).map((row) => ({
  label: row.keys?.[0] || 'Unknown',
  clicks: numberValue(row.clicks),
  impressions: numberValue(row.impressions),
  ctr: numberValue(row.ctr),
  position: numberValue(row.position),
}));

const dateOnly = (date: Date) => date.toISOString().slice(0, 10);

export const getGoogleOwnerAnalyticsSnapshot = async (): Promise<OwnerAnalyticsSnapshot> => {
  const snapshot = emptySnapshot();
  const propertyId = process.env.CARDFORGE_GOOGLE_ANALYTICS_PROPERTY_ID?.trim();
  const siteUrl = process.env.CARDFORGE_GOOGLE_SEARCH_CONSOLE_SITE_URL?.trim();
  if (!snapshot.configuration.reportingConfigured
    && !snapshot.configuration.searchConsoleConfigured
    && !snapshot.configuration.searchConsoleConfigured) {
    snapshot.warnings.push('Google read-only reporting is not configured yet.');
    return snapshot;
  }

  let accessToken: string | null = null;
  if (snapshot.configuration.reportingConfigured || snapshot.configuration.searchConsoleConfigured) {
    try {
      accessToken = await getGoogleReadOnlyAccessToken();
    } catch (error) {
      console.error('Unable to authorize Google analytics reporting:', error instanceof Error ? error.message : error);
      snapshot.warnings.push('Google reporting authorization is unavailable.');
    }
  }

  const requests: Array<Promise<{ key: string; value: unknown }>> = [];
  if (snapshot.configuration.reportingConfigured && propertyId && accessToken) {
    requests.push(
      analyticsReport(propertyId, accessToken, 'runRealtimeReport', realtimeBody([], ['activeUsers']))
        .then((value) => ({ key: 'realtimeTotal', value })),
      analyticsReport(propertyId, accessToken, 'runRealtimeReport', realtimeBody(['unifiedScreenName'], ['activeUsers'], { limit: 8, orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }] }))
        .then((value) => ({ key: 'realtimePages', value })),
      analyticsReport(propertyId, accessToken, 'runRealtimeReport', realtimeBody(['eventName'], ['eventCount'], { limit: 10, orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }] }))
        .then((value) => ({ key: 'realtimeEvents', value })),
      analyticsReport(propertyId, accessToken, 'runRealtimeReport', realtimeBody(['deviceCategory'], ['activeUsers'], { limit: 8, orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }] }))
        .then((value) => ({ key: 'realtimeDevices', value })),
      analyticsReport(propertyId, accessToken, 'runReport', reportBody([], ['activeUsers', 'sessions', 'screenPageViews', 'eventCount', 'keyEvents']))
        .then((value) => ({ key: 'overview', value })),
      analyticsReport(propertyId, accessToken, 'runReport', reportBody(
        ['sessionManualSource', 'sessionManualMedium', 'sessionManualCampaignName', 'sessionManualAdContent'],
        ['sessions', 'activeUsers', 'eventCount', 'keyEvents'],
        {
          dimensionFilter: { filter: { fieldName: 'sessionManualMedium', stringFilter: { matchType: 'EXACT', value: 'organic_social' } } },
          limit: 50,
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        },
      )).then((value) => ({ key: 'campaigns', value })),
      analyticsReport(propertyId, accessToken, 'runReport', reportBody(
        ['eventName'],
        ['totalUsers', 'eventCount'],
        { dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: JOURNEY_EVENTS.map(({ eventName }) => eventName) } } } },
      )).then((value) => ({ key: 'journey', value })),
    );
  }

  if (snapshot.configuration.searchConsoleConfigured && siteUrl && accessToken) {
    const end = new Date();
    end.setUTCDate(end.getUTCDate() - 3);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - REPORT_RANGE_DAYS + 1);
    const searchUrl = `${SEARCH_CONSOLE_API_ROOT}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
    const searchBase = { startDate: dateOnly(start), endDate: dateOnly(end), dataState: 'final', type: 'web' };
    requests.push(
      googleJson<SearchAnalyticsResponse>(searchUrl, accessToken, searchBase).then((value) => ({ key: 'searchTotal', value })),
      googleJson<SearchAnalyticsResponse>(searchUrl, accessToken, { ...searchBase, dimensions: ['query'], rowLimit: 10 }).then((value) => ({ key: 'searchQueries', value })),
      googleJson<SearchAnalyticsResponse>(searchUrl, accessToken, { ...searchBase, dimensions: ['page'], rowLimit: 10 }).then((value) => ({ key: 'searchPages', value })),
      googleJson<SearchConsoleSitemapsResponse>(`${SEARCH_CONSOLE_API_ROOT}/sites/${encodeURIComponent(siteUrl)}/sitemaps`, accessToken).then((value) => ({ key: 'sitemaps', value })),
    );
  }

  const results = await Promise.allSettled(requests);
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('Google analytics report failed:', result.reason instanceof Error ? result.reason.message : result.reason);
      snapshot.warnings.push('One Google report is temporarily unavailable.');
      continue;
    }
    const report = result.value.value;
    switch (result.value.key) {
      case 'realtimeTotal': {
        const row = mapGoogleRows(report as GoogleAnalyticsReport)[0];
        snapshot.realtime.activeUsers = row?.metrics.activeUsers ?? 0;
        snapshot.availability.realtime = true;
        break;
      }
      case 'realtimePages':
        snapshot.realtime.pages = toMetricRows(report as GoogleAnalyticsReport, 'unifiedScreenName', 'activeUsers');
        snapshot.availability.realtimePages = true;
        break;
      case 'realtimeEvents':
        snapshot.realtime.events = toMetricRows(report as GoogleAnalyticsReport, 'eventName', 'eventCount');
        snapshot.availability.realtimeEvents = true;
        break;
      case 'realtimeDevices':
        snapshot.realtime.devices = toMetricRows(report as GoogleAnalyticsReport, 'deviceCategory', 'activeUsers');
        snapshot.availability.realtimeDevices = true;
        break;
      case 'overview': {
        const metrics = mapGoogleRows(report as GoogleAnalyticsReport)[0]?.metrics ?? {};
        snapshot.overview = {
          users: metrics.activeUsers ?? 0,
          sessions: metrics.sessions ?? 0,
          pageViews: metrics.screenPageViews ?? 0,
          events: metrics.eventCount ?? 0,
          keyEvents: metrics.keyEvents ?? 0,
        };
        snapshot.availability.overview = true;
        break;
      }
      case 'campaigns':
        snapshot.campaigns = mapGoogleRows(report as GoogleAnalyticsReport).map(({ dimensions, metrics }): OrganicCampaignMetricRow => ({
          source: dimensions.sessionManualSource || 'Unknown',
          medium: dimensions.sessionManualMedium || 'organic_social',
          campaign: dimensions.sessionManualCampaignName || 'Unlabelled',
          content: dimensions.sessionManualAdContent || '—',
          sessions: metrics.sessions ?? 0,
          users: metrics.activeUsers ?? 0,
          events: metrics.eventCount ?? 0,
          keyEvents: metrics.keyEvents ?? 0,
        }));
        snapshot.availability.campaigns = true;
        break;
      case 'journey': {
        const rows = mapGoogleRows(report as GoogleAnalyticsReport);
        snapshot.journey = JOURNEY_EVENTS.map((step): AnalyticsAdoptionRow => {
          const row = rows.find(({ dimensions }) => dimensions.eventName === step.eventName);
          return { ...step, users: row?.metrics.totalUsers ?? 0, events: row?.metrics.eventCount ?? 0 };
        });
        snapshot.availability.journey = true;
        break;
      }
      case 'searchTotal': {
        const row = (report as SearchAnalyticsResponse).rows?.[0];
        snapshot.search.clicks = numberValue(row?.clicks);
        snapshot.search.impressions = numberValue(row?.impressions);
        snapshot.search.ctr = numberValue(row?.ctr);
        snapshot.search.position = numberValue(row?.position);
        snapshot.availability.search = true;
        break;
      }
      case 'searchQueries':
        snapshot.search.queries = toSearchRows(report as SearchAnalyticsResponse);
        snapshot.availability.searchQueries = true;
        break;
      case 'searchPages':
        snapshot.search.pages = toSearchRows(report as SearchAnalyticsResponse);
        snapshot.availability.searchPages = true;
        break;
      case 'sitemaps': {
        const sitemap = (report as SearchConsoleSitemapsResponse).sitemap?.find(({ path }) => path?.endsWith('/sitemap.xml'));
        if (sitemap) snapshot.search.sitemap = {
          status: sitemap.isPending ? 'Pending' : numberValue(sitemap.errors) > 0 ? 'Errors' : 'Success',
          lastSubmitted: sitemap.lastSubmitted ?? null,
          lastDownloaded: sitemap.lastDownloaded ?? null,
          errors: numberValue(sitemap.errors),
          warnings: numberValue(sitemap.warnings),
        };
        snapshot.availability.sitemap = true;
        break;
      }
    }
  }
  snapshot.warnings = Array.from(new Set(snapshot.warnings));
  return snapshot;
};
