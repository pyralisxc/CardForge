import { afterEach, describe, expect, it, vi } from 'vitest';

import { getAnalyticsConfigurationStatus } from '@/features/analytics/server';

describe('analytics configuration', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('keeps collection and reporting disabled by default', () => {
    vi.stubEnv('NEXT_PUBLIC_CARDFORGE_ANALYTICS_ENABLED', '');
    vi.stubEnv('NEXT_PUBLIC_CARDFORGE_GA_MEASUREMENT_ID', '');
    vi.stubEnv('CARDFORGE_GOOGLE_ANALYTICS_PROPERTY_ID', '');
    vi.stubEnv('CARDFORGE_GOOGLE_SERVICE_ACCOUNT_EMAIL', '');
    vi.stubEnv('CARDFORGE_GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', '');
    vi.stubEnv('CARDFORGE_GOOGLE_SEARCH_CONSOLE_SITE_URL', '');

    expect(getAnalyticsConfigurationStatus()).toEqual({
      collectionEnabled: false,
      measurementIdConfigured: false,
      reportingConfigured: false,
      searchConsoleConfigured: false,
      missing: [
        'NEXT_PUBLIC_CARDFORGE_GA_MEASUREMENT_ID',
        'CARDFORGE_GOOGLE_ANALYTICS_PROPERTY_ID',
        'CARDFORGE_GOOGLE_SERVICE_ACCOUNT_EMAIL',
        'CARDFORGE_GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
        'CARDFORGE_GOOGLE_SEARCH_CONSOLE_SITE_URL',
      ],
    });
  });

  it('reports the independently gated collection and read-only reporting surfaces', () => {
    vi.stubEnv('NEXT_PUBLIC_CARDFORGE_ANALYTICS_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_CARDFORGE_GA_MEASUREMENT_ID', 'G-TEST123');
    vi.stubEnv('CARDFORGE_GOOGLE_ANALYTICS_PROPERTY_ID', '123456789');
    vi.stubEnv('CARDFORGE_GOOGLE_SERVICE_ACCOUNT_EMAIL', 'analytics@example.test');
    vi.stubEnv('CARDFORGE_GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', 'private-key');
    vi.stubEnv('CARDFORGE_GOOGLE_SEARCH_CONSOLE_SITE_URL', 'sc-domain:cardforges.com');

    expect(getAnalyticsConfigurationStatus()).toMatchObject({
      collectionEnabled: true,
      measurementIdConfigured: true,
      reportingConfigured: true,
      searchConsoleConfigured: true,
      missing: [],
    });
  });
});
