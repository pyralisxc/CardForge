import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('founder social links', () => {
  it('renders the three approved networks from the founder profile', () => {
    const component = source('src/features/public-site/components/FounderSocialLinks.tsx');

    for (const network of ['Facebook', 'Instagram', 'Discord']) {
      expect(component).toContain(`label: '${network}'`);
    }
    expect(component).toContain('profile.facebookUrl');
    expect(component).toContain('profile.instagramUrl');
    expect(component).toContain('profile.discordUrl');
  });

  it('uses safe external links and accessible coming-soon controls', () => {
    const component = source('src/features/public-site/components/FounderSocialLinks.tsx');

    expect(component).toContain('aria-label={`Follow ${brandName}`}');
    expect(component).toContain('target="_blank"');
    expect(component).toContain('rel="noopener noreferrer"');
    expect(component).toContain('aria-live="polite"');
    expect(component).toContain('setAnnouncement(`${network.label} coming soon`)');
    expect(component).toContain('title={`${network.label} coming soon`}');
  });

  it('places the shared controls in desktop header, mobile menu, and compact footer', () => {
    const header = source('src/features/public-site/components/PublicSiteHeader.tsx');
    const footer = source('src/features/public-site/components/PublicSiteFooter.tsx');
    const layout = source('src/app/layout.tsx');

    expect(header.match(/<FounderSocialLinks/g)).toHaveLength(2);
    expect(header).toContain('brandName={businessIdentity.brandName}');
    expect(footer).toContain('<FounderSocialLinks');
    expect(footer).toContain('brandName={businessIdentity.brandName}');
    expect(layout).toContain('<FounderProfileProvider profile={founderProfile}>');
  });
});
