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
    vi.stubEnv('NEXT_PUBLIC_CARDFORGE_POSTHOG_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_CARDFORGE_POSTHOG_HOST', '');
    vi.stubEnv('CARDFORGE_POSTHOG_PERSONAL_API_KEY', '');
    vi.stubEnv('CARDFORGE_POSTHOG_PROJECT_ID', '');
    vi.stubEnv('CARDFORGE_POSTHOG_APP_HOST', '');

    expect(getAnalyticsConfigurationStatus()).toEqual({
      collectionEnabled: false,
      measurementIdConfigured: false,
      reportingConfigured: false,
      searchConsoleConfigured: false,
      interactionCollectionConfigured: false,
      interactionReportingConfigured: false,
      missing: [
        'NEXT_PUBLIC_CARDFORGE_GA_MEASUREMENT_ID',
        'CARDFORGE_GOOGLE_ANALYTICS_PROPERTY_ID',
        'CARDFORGE_GOOGLE_SERVICE_ACCOUNT_EMAIL',
        'CARDFORGE_GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
        'CARDFORGE_GOOGLE_SEARCH_CONSOLE_SITE_URL',
        'NEXT_PUBLIC_CARDFORGE_POSTHOG_KEY',
        'NEXT_PUBLIC_CARDFORGE_POSTHOG_HOST',
        'CARDFORGE_POSTHOG_PERSONAL_API_KEY',
        'CARDFORGE_POSTHOG_PROJECT_ID',
        'CARDFORGE_POSTHOG_APP_HOST',
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
    vi.stubEnv('NEXT_PUBLIC_CARDFORGE_POSTHOG_KEY', 'phc_test');
    vi.stubEnv('NEXT_PUBLIC_CARDFORGE_POSTHOG_HOST', 'https://us.i.posthog.com');
    vi.stubEnv('CARDFORGE_POSTHOG_PERSONAL_API_KEY', 'phx_test');
    vi.stubEnv('CARDFORGE_POSTHOG_PROJECT_ID', '12345');
    vi.stubEnv('CARDFORGE_POSTHOG_APP_HOST', 'https://us.posthog.com');

    expect(getAnalyticsConfigurationStatus()).toMatchObject({
      collectionEnabled: true,
      measurementIdConfigured: true,
      reportingConfigured: true,
      searchConsoleConfigured: true,
      interactionCollectionConfigured: true,
      interactionReportingConfigured: true,
      missing: [],
    });
  });

  it('does not report malformed PostHog settings as ready', () => {
    vi.stubEnv('NEXT_PUBLIC_CARDFORGE_ANALYTICS_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_CARDFORGE_GA_MEASUREMENT_ID', '');
    vi.stubEnv('CARDFORGE_GOOGLE_ANALYTICS_PROPERTY_ID', '');
    vi.stubEnv('CARDFORGE_GOOGLE_SERVICE_ACCOUNT_EMAIL', '');
    vi.stubEnv('CARDFORGE_GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', '');
    vi.stubEnv('CARDFORGE_GOOGLE_SEARCH_CONSOLE_SITE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_CARDFORGE_POSTHOG_KEY', 'phc_test');
    vi.stubEnv('NEXT_PUBLIC_CARDFORGE_POSTHOG_HOST', 'https://posthog.example.test');
    vi.stubEnv('CARDFORGE_POSTHOG_PERSONAL_API_KEY', '   ');
    vi.stubEnv('CARDFORGE_POSTHOG_PROJECT_ID', 'not-a-project');
    vi.stubEnv('CARDFORGE_POSTHOG_APP_HOST', 'http://us.posthog.com');

    expect(getAnalyticsConfigurationStatus()).toMatchObject({
      collectionEnabled: false,
      interactionCollectionConfigured: false,
      interactionReportingConfigured: false,
    });
  });
});
