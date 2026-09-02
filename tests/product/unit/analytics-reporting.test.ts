import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/analytics/server/googleAccessToken', () => ({
  getGoogleReadOnlyAccessToken: vi.fn().mockResolvedValue('test-access-token'),
}));

import { getGoogleOwnerAnalyticsSnapshot } from '@/features/analytics/server/googleReporting';
import { getOwnerAnalyticsSnapshot } from '@/features/analytics/server/ownerReporting';

describe('Google analytics reporting', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('uses only Google-supported realtime dimensions and compatible metrics', async () => {
    vi.stubEnv('NEXT_PUBLIC_CARDFORGE_ANALYTICS_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_CARDFORGE_GA_MEASUREMENT_ID', 'G-TEST123');
    vi.stubEnv('CARDFORGE_GOOGLE_ANALYTICS_PROPERTY_ID', '123456789');
    vi.stubEnv('CARDFORGE_GOOGLE_SERVICE_ACCOUNT_EMAIL', 'analytics@example.test');
    vi.stubEnv('CARDFORGE_GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', 'private-key');
    vi.stubEnv('CARDFORGE_GOOGLE_SEARCH_CONSOLE_SITE_URL', '');
    vi.stubEnv('CARDFORGE_POSTHOG_PERSONAL_API_KEY', '');
    vi.stubEnv('CARDFORGE_POSTHOG_PROJECT_ID', '');
    vi.stubEnv('CARDFORGE_POSTHOG_APP_HOST', '');
    const fetchMock = vi.fn(async (_input: string | URL | Request, _options?: RequestInit) => new Response(JSON.stringify({ rows: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const snapshot = await getGoogleOwnerAnalyticsSnapshot();
    const realtimeBodies = fetchMock.mock.calls
      .filter(([url]) => String(url).includes(':runRealtimeReport'))
      .map(([, options]) => JSON.parse(String(options?.body)) as {
        dimensions: Array<{ name: string }>;
        metrics: Array<{ name: string }>;
      });
    const events = realtimeBodies.find(({ dimensions }) => dimensions.some(({ name }) => name === 'eventName'));
    const devices = realtimeBodies.find(({ dimensions }) => dimensions.some(({ name }) => name === 'deviceCategory'));

    expect(events?.metrics).toEqual([{ name: 'eventCount' }]);
    expect(devices?.metrics).toEqual([{ name: 'activeUsers' }]);
    expect(JSON.stringify(realtimeBodies)).not.toContain('"source"');
    expect(JSON.stringify(realtimeBodies)).not.toContain('"medium"');
    expect(snapshot.availability).toMatchObject({
      realtime: true,
      realtimePages: true,
      realtimeEvents: true,
      realtimeDevices: true,
    });
  });

  it('returns anonymous PostHog interaction summaries without visitor identifiers', async () => {
    vi.stubEnv('NEXT_PUBLIC_CARDFORGE_ANALYTICS_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_CARDFORGE_GA_MEASUREMENT_ID', '');
    vi.stubEnv('CARDFORGE_GOOGLE_ANALYTICS_PROPERTY_ID', '');
    vi.stubEnv('CARDFORGE_GOOGLE_SERVICE_ACCOUNT_EMAIL', '');
    vi.stubEnv('CARDFORGE_GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', '');
    vi.stubEnv('CARDFORGE_GOOGLE_SEARCH_CONSOLE_SITE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_CARDFORGE_POSTHOG_KEY', 'phc_test');
    vi.stubEnv('NEXT_PUBLIC_CARDFORGE_POSTHOG_HOST', 'https://us.i.posthog.com');
    vi.stubEnv('CARDFORGE_POSTHOG_PERSONAL_API_KEY', 'phx_read_only');
    vi.stubEnv('CARDFORGE_POSTHOG_PROJECT_ID', '12345');
    vi.stubEnv('CARDFORGE_POSTHOG_APP_HOST', 'https://us.posthog.com');
    const fetchMock = vi.fn(async (_input: string | URL | Request, options?: RequestInit) => {
      const body = JSON.parse(String(options?.body)) as { name: string; query: { query: string } };
      const results = body.name.includes('active visitors') ? [[2]]
        : body.name.includes('recent interaction') ? [['2026-08-12 19:10:00', 'card_created', '/studio', 'bulk']]
          : body.name.includes('interaction counts') ? [['card_created', 4]]
            : [['/studio', 6]];
      return new Response(JSON.stringify({ results }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const snapshot = await getOwnerAnalyticsSnapshot();

    expect(snapshot.interactions).toMatchObject({
      activeVisitors: 2,
      recentEvents: [{ eventName: 'card_created', path: '/studio', detail: 'bulk' }],
      events: [{ label: 'card_created', value: 4 }],
      paths: [{ label: '/studio', value: 6 }],
    });
    expect(snapshot.interactions).not.toHaveProperty('recordingsUrl');
    expect(snapshot.availability).toMatchObject({
      interactionLive: true,
      interactionRecent: true,
      interactionEvents: true,
      interactionPaths: true,
    });
    expect(JSON.stringify(snapshot)).not.toContain('distinct_id');
    expect(fetchMock.mock.calls.every(([url]) => String(url) === 'https://us.posthog.com/api/projects/12345/query/')).toBe(true);
  });

  it('keeps a fail-soft PostHog timeout out of production error telemetry', async () => {
    vi.stubEnv('NEXT_PUBLIC_CARDFORGE_ANALYTICS_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_CARDFORGE_GA_MEASUREMENT_ID', '');
    vi.stubEnv('CARDFORGE_GOOGLE_ANALYTICS_PROPERTY_ID', '');
    vi.stubEnv('CARDFORGE_GOOGLE_SERVICE_ACCOUNT_EMAIL', '');
    vi.stubEnv('CARDFORGE_GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', '');
    vi.stubEnv('CARDFORGE_GOOGLE_SEARCH_CONSOLE_SITE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_CARDFORGE_POSTHOG_KEY', 'phc_test');
    vi.stubEnv('NEXT_PUBLIC_CARDFORGE_POSTHOG_HOST', 'https://us.i.posthog.com');
    vi.stubEnv('CARDFORGE_POSTHOG_PERSONAL_API_KEY', 'phx_read_only');
    vi.stubEnv('CARDFORGE_POSTHOG_PROJECT_ID', '12345');
    vi.stubEnv('CARDFORGE_POSTHOG_APP_HOST', 'https://us.posthog.com');
    const timeoutMessage = 'The operation was aborted due to timeout';
    const fetchMock = vi.fn(async (_input: string | URL | Request, options?: RequestInit) => {
      const body = JSON.parse(String(options?.body)) as { name: string };
      if (body.name.includes('active visitors')) {
        const timeout = new Error(timeoutMessage);
        timeout.name = 'TimeoutError';
        throw timeout;
      }
      return new Response(JSON.stringify({ results: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const snapshot = await getOwnerAnalyticsSnapshot();

    expect(warnSpy).toHaveBeenCalledWith('PostHog analytics report timed out:', timeoutMessage);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(snapshot.warnings).toContain('One PostHog interaction report is temporarily unavailable.');
    expect(snapshot.availability).toMatchObject({
      interactionLive: false,
      interactionRecent: true,
      interactionEvents: true,
      interactionPaths: true,
    });
  });

  it('keeps non-timeout PostHog failures visible as production errors', async () => {
    vi.stubEnv('NEXT_PUBLIC_CARDFORGE_ANALYTICS_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_CARDFORGE_GA_MEASUREMENT_ID', '');
    vi.stubEnv('CARDFORGE_GOOGLE_ANALYTICS_PROPERTY_ID', '');
    vi.stubEnv('CARDFORGE_GOOGLE_SERVICE_ACCOUNT_EMAIL', '');
    vi.stubEnv('CARDFORGE_GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', '');
    vi.stubEnv('CARDFORGE_GOOGLE_SEARCH_CONSOLE_SITE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_CARDFORGE_POSTHOG_KEY', 'phc_test');
    vi.stubEnv('NEXT_PUBLIC_CARDFORGE_POSTHOG_HOST', 'https://us.i.posthog.com');
    vi.stubEnv('CARDFORGE_POSTHOG_PERSONAL_API_KEY', 'phx_read_only');
    vi.stubEnv('CARDFORGE_POSTHOG_PROJECT_ID', '12345');
    vi.stubEnv('CARDFORGE_POSTHOG_APP_HOST', 'https://us.posthog.com');
    const fetchMock = vi.fn(async (_input: string | URL | Request, options?: RequestInit) => {
      const body = JSON.parse(String(options?.body)) as { name: string };
      return body.name.includes('active visitors')
        ? new Response('{}', { status: 503 })
        : new Response(JSON.stringify({ results: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const snapshot = await getOwnerAnalyticsSnapshot();

    expect(errorSpy).toHaveBeenCalledWith(
      'PostHog analytics report failed:',
      'PostHog reporting request failed with status 503.',
    );
    expect(warnSpy).not.toHaveBeenCalled();
    expect(snapshot.warnings).toContain('One PostHog interaction report is temporarily unavailable.');
  });
});
