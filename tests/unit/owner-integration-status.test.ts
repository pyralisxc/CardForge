import { afterEach, describe, expect, it, vi } from 'vitest';

import { getOwnerIntegrationStatus } from '@/features/owner/lib/ownerConsoleStore';

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
  });
});
