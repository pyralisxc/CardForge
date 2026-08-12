import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/analytics/server/googleAccessToken', () => ({
  getGoogleReadOnlyAccessToken: vi.fn().mockResolvedValue('test-access-token'),
}));

import { getOwnerAnalyticsSnapshot } from '@/features/analytics/server/googleReporting';

describe('Google analytics reporting', () => {
  afterEach(() => {
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
    const fetchMock = vi.fn(async (_input: string | URL | Request, _options?: RequestInit) => new Response(JSON.stringify({ rows: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const snapshot = await getOwnerAnalyticsSnapshot();
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
});
