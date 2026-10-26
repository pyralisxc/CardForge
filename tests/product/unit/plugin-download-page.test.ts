import { describe, expect, it } from 'vitest';
import { createAuthRouteHref } from '@/infrastructure/auth/clerk';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('download page public shell and access presentation', () => {
  it('uses the existing public shell rather than a standalone technical layout', () => {
    const source = readFileSync(resolve('src/app/downloads/page.tsx'), 'utf8');
    expect(source).toContain('ConfiguredPublicSiteShell');
    expect(source).toContain('<section className=');
    expect(source).not.toContain('<main className=');
    expect(source).toContain('ContributorPublicAuthSlot');
    expect(source).toContain('PluginDownloadLinks scope="studio"');
    expect(source).not.toContain('scope="owner"');
    expect(source).toContain('href="/"');
  });
  it('retains the validated local sign-in return', () => {
    expect(createAuthRouteHref('/sign-in', '/downloads')).toBe('/sign-in?redirect_url=%2Fdownloads');
    expect(createAuthRouteHref('/sign-in', '/?ownerSite=editions')).toBe('/sign-in?redirect_url=%2F%3FownerSite%3Deditions');
  });
  it('keeps unauthorized responses distinct and does not advertise made-up build dates', () => {
    const source = readFileSync(resolve('src/features/plugin-distribution/components/PluginDownloadLinks.tsx'), 'utf8');
    expect(source).toContain('status === 401');
    expect(source).toContain('status === 403');
    expect(source).toContain('Release date: not recorded');
    expect(source).not.toContain('Build date unavailable');
    expect(source).toContain("await fetch('/api/plugin-downloads?'");
    expect(source).toContain("response.headers.get('X-Checksum-SHA256')");
    expect(source).toContain('URL.createObjectURL(blob)');
    expect(source).not.toContain('href={\'/api/plugin-downloads?');
  });
});
