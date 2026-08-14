import { afterEach, describe, expect, it, vi } from 'vitest';

import { getOwnerIntegrationStatus } from '@/features/owner/server';

describe('owner integration status', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps email in mailto mode until delivery env vars are configured', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', '');
    vi.stubEnv('VERCEL_URL', '');
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('CARDFORGE_EMAIL_FROM', '');
    vi.stubEnv('CARDFORGE_EMAIL_REPLY_TO', '');

    const status = getOwnerIntegrationStatus();

    expect(status.site.publicAppUrl).toBe('http://localhost:9002');
    expect(status.site.usingLocalFallback).toBe(true);
    expect(status.email.contactMode).toBe('mailto');
    expect(status.email.resendConfigured).toBe(false);
    expect(status.email.missing).toEqual([
      'RESEND_API_KEY',
      'CARDFORGE_EMAIL_FROM',
      'CARDFORGE_EMAIL_REPLY_TO',
    ]);
    expect(status.connectedServices.find((service) => service.id === 'resend')).toMatchObject({
      status: 'attention',
      statusLabel: 'Mailto fallback',
    });
  });

  it('reports server delivery readiness when transactional email env vars are present', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://cardforges.com');
    vi.stubEnv('RESEND_API_KEY', 're_test');
    vi.stubEnv('CARDFORGE_EMAIL_FROM', 'CardForge <notifications@example.test>');
    vi.stubEnv('CARDFORGE_EMAIL_REPLY_TO', 'support@example.test');

    const status = getOwnerIntegrationStatus();

    expect(status.site.publicAppUrl).toBe('https://cardforges.com');
    expect(status.site.usingLocalFallback).toBe(false);
    expect(status.site.sitemapUrl).toBe('https://cardforges.com/sitemap.xml');
    expect(status.site.robotsUrl).toBe('https://cardforges.com/robots.txt');
    expect(status.email.contactMode).toBe('ready_for_server_delivery');
    expect(status.email.resendConfigured).toBe(true);
    expect(status.email.fromConfigured).toBe(true);
    expect(status.email.replyToConfigured).toBe(true);
    expect(status.email.missing).toEqual([]);
    expect(status.connectedServices.find((service) => service.id === 'resend')).toMatchObject({
      status: 'ready',
      statusLabel: 'Delivery ready',
    });
  });

  it('does not attribute Google reporting readiness to the wrong Cloud project', () => {
    vi.stubEnv('CARDFORGE_GOOGLE_ANALYTICS_PROPERTY_ID', '123456');
    vi.stubEnv('CARDFORGE_GOOGLE_SERVICE_ACCOUNT_EMAIL', 'reports@another-project.iam.gserviceaccount.com');
    vi.stubEnv('CARDFORGE_GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', 'test-private-key');
    vi.stubEnv('CARDFORGE_GOOGLE_SEARCH_CONSOLE_SITE_URL', 'sc-domain:cardforges.com');

    const status = getOwnerIntegrationStatus();

    expect(status.connectedServices.find((service) => service.id === 'google-analytics-cloud')).toMatchObject({
      identifier: 'cardforge-analytics',
      status: 'attention',
      statusLabel: 'Service identity mismatch',
    });
  });

  it('reports one unambiguous owner publisher instead of mere allowlist presence', () => {
    vi.stubEnv('CARDFORGE_OWNER_ACCOUNT_EMAILS', 'owner@example.com,legacy@example.com');
    expect(getOwnerIntegrationStatus().canonicalOwnerConfigured).toBe(false);

    vi.stubEnv('CARDFORGE_OWNER_ACCOUNT_EMAILS', 'pyraliscameron@gmail.com');
    expect(getOwnerIntegrationStatus().canonicalOwnerConfigured).toBe(true);
  });

  it('keeps provider ownership and destructive-impact links visible to the owner', () => {
    const status = getOwnerIntegrationStatus();
    const googleAuthentication = status.connectedServices.find((service) => service.id === 'google-authentication');

    expect(googleAuthentication).toMatchObject({
      identifier: 'cardforge-authentication',
      dashboardUrl: 'https://console.cloud.google.com/auth/overview?project=cardforge-authentication',
      status: 'reference',
    });
    expect(googleAuthentication?.removalImpact).toContain('Google sign-in fails');
    expect(status.connectedServices.map((service) => service.id)).toEqual(expect.arrayContaining([
      'vercel',
      'clerk',
      'supabase',
      'stripe',
      'google-analytics-cloud',
      'google-analytics',
      'search-console',
      'posthog',
      'buffer',
      'github',
    ]));
  });
});
