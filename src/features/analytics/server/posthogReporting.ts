import {
  isAllowedPostHogHost,
  isValidPostHogProjectId,
  PRODUCT_ANALYTICS_EVENT_NAMES,
  type AnalyticsMetricRow,
  type OwnerAnalyticsSnapshot,
  type ProductAnalyticsEventName,
  type ProductAnalyticsRecentEvent,
} from '../model';

interface PostHogQueryResponse {
  results?: unknown[][];
}

const eventFilter = PRODUCT_ANALYTICS_EVENT_NAMES.map((name) => `'${name}'`).join(', ');

const asNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const asString = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback;

const isProductEventName = (value: unknown): value is ProductAnalyticsEventName => (
  typeof value === 'string' && PRODUCT_ANALYTICS_EVENT_NAMES.includes(value as ProductAnalyticsEventName)
);

const posthogQuery = async (
  appHost: string,
  projectId: string,
  personalApiKey: string,
  name: string,
  query: string,
) => {
  const response = await fetch(`${appHost}/api/projects/${encodeURIComponent(projectId)}/query/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${personalApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query }, name }),
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`PostHog reporting request failed with status ${response.status}.`);
  return response.json() as Promise<PostHogQueryResponse>;
};

const toMetricRows = (response: PostHogQueryResponse): AnalyticsMetricRow[] => (response.results ?? [])
  .map(([label, value]) => ({ label: asString(label, 'Unknown'), value: asNumber(value) }));

const toRecentEvents = (response: PostHogQueryResponse): ProductAnalyticsRecentEvent[] => (response.results ?? [])
  .flatMap(([occurredAt, eventName, path, detail]) => isProductEventName(eventName) ? [{
    occurredAt: asString(occurredAt),
    eventName,
    path: asString(path, '/'),
    detail: asString(detail),
  }] : []);

export const applyProductAnalyticsReporting = async (snapshot: OwnerAnalyticsSnapshot): Promise<void> => {
  if (!snapshot.configuration.interactionReportingConfigured) return;
  const personalApiKey = process.env.CARDFORGE_POSTHOG_PERSONAL_API_KEY?.trim() ?? '';
  const projectId = process.env.CARDFORGE_POSTHOG_PROJECT_ID?.trim() ?? '';
  const appHost = (process.env.CARDFORGE_POSTHOG_APP_HOST?.trim() ?? '').replace(/\/+$/u, '');
  if (!personalApiKey || !isValidPostHogProjectId(projectId) || !isAllowedPostHogHost(appHost)) {
    snapshot.warnings.push('PostHog reporting configuration is invalid.');
    return;
  }
  snapshot.interactions.recordingsUrl = `${appHost}/project/${encodeURIComponent(projectId)}/replay`;

  const queries = [
    {
      key: 'interactionLive',
      name: 'CardForge active visitors',
      query: `SELECT uniq(distinct_id) FROM events WHERE timestamp >= now() - INTERVAL 5 MINUTE AND event IN (${eventFilter})`,
    },
    {
      key: 'interactionRecent',
      name: 'CardForge recent interaction activity',
      query: `SELECT toString(timestamp), event, coalesce(toString(properties.path), '/'), coalesce(toString(properties.placement), toString(properties.creation_method), toString(properties.export_kind), toString(properties.format_id), '') FROM events WHERE timestamp >= now() - INTERVAL 30 MINUTE AND event IN (${eventFilter}) ORDER BY timestamp DESC LIMIT 30`,
    },
    {
      key: 'interactionEvents',
      name: 'CardForge interaction counts',
      query: `SELECT event, count() FROM events WHERE timestamp >= now() - INTERVAL 24 HOUR AND event IN (${eventFilter}) GROUP BY event ORDER BY count() DESC LIMIT 20`,
    },
    {
      key: 'interactionPaths',
      name: 'CardForge active paths',
      query: `SELECT toString(properties.path), count() FROM events WHERE timestamp >= now() - INTERVAL 24 HOUR AND event IN (${eventFilter}) AND notEmpty(toString(properties.path)) GROUP BY properties.path ORDER BY count() DESC LIMIT 20`,
    },
  ] as const;

  const results = await Promise.allSettled(queries.map(async (query) => ({
    key: query.key,
    value: await posthogQuery(appHost, projectId, personalApiKey, query.name, query.query),
  })));

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('PostHog analytics report failed:', result.reason instanceof Error ? result.reason.message : result.reason);
      snapshot.warnings.push('One PostHog interaction report is temporarily unavailable.');
      continue;
    }
    switch (result.value.key) {
      case 'interactionLive':
        snapshot.interactions.activeVisitors = asNumber(result.value.value.results?.[0]?.[0]);
        snapshot.availability.interactionLive = true;
        break;
      case 'interactionRecent':
        snapshot.interactions.recentEvents = toRecentEvents(result.value.value);
        snapshot.availability.interactionRecent = true;
        break;
      case 'interactionEvents':
        snapshot.interactions.events = toMetricRows(result.value.value);
        snapshot.availability.interactionEvents = true;
        break;
      case 'interactionPaths':
        snapshot.interactions.paths = toMetricRows(result.value.value);
        snapshot.availability.interactionPaths = true;
        break;
    }
  }
};
