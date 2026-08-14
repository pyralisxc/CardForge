import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const readRoute = (route: string): string => readFileSync(
  join(process.cwd(), 'src/app', route, 'page.tsx'),
  'utf8',
);

describe('public route stories', () => {
  it('separates the product story from the founder story', () => {
    const about = readRoute('about');
    const cameron = readRoute('cameron');
    const contentCatalog = readFileSync(
      join(process.cwd(), 'src/features/public-site/model/siteContent.ts'),
      'utf8',
    );

    expect(about).toContain('getCachedSiteContentBlocks');
    expect(about).toContain('createSiteContentMap');
    expect(about).toContain("siteContent['about.hero.headline']");
    expect(contentCatalog).toContain('Your work stays with you');
    expect(contentCatalog).toContain('Cards are the starting point');
    expect(contentCatalog).toContain('future printable formats');
    expect(contentCatalog).toContain('Qualified contributors can submit shared assets, marketing drafts, and site-copy proposals.');
    expect(contentCatalog).toContain('All public changes remain owner-approved.');
    expect(about).not.toContain('Independent brand notice');
    expect(about).not.toContain('cardforge.com');
    expect(about).not.toContain('future developer compensation program');
    expect(cameron).toContain('getCachedFounderProfile');
    expect(cameron).toContain('profile.heroHeadline');
    expect(cameron).toContain('profile.roadBody');
    expect(cameron).toContain('profile.currentBody');
    expect(cameron).toContain('profile.priorities.map');
    expect(cameron).toContain('id="support"');
  });

  it('describes current access without calling Creator Pass planned', () => {
    const landing = readFileSync(join(process.cwd(), 'src/app/page.tsx'), 'utf8');
    const access = readFileSync(
      join(process.cwd(), 'src/features/public-site/components/AccessComparison.tsx'),
      'utf8',
    );
    const contentCatalog = readFileSync(
      join(process.cwd(), 'src/features/public-site/model/siteContent.ts'),
      'utf8',
    );

    expect(landing).toContain('<AccessComparison');
    expect(access).toContain('Creator Pass');
    expect(access).toContain('Start free');
    expect(access).toContain('See Creator Pass');
    expect(contentCatalog).toContain('watermark-free downloads');
    expect(access).toContain("siteContent['landing.access.headline']");
    expect(access).not.toContain('clean downloads');
    expect(access).not.toContain('planned home');
  });

  it('publishes friendly support that activates checkout only with complete server configuration', () => {
    const cameron = readRoute('cameron');
    const checkout = readFileSync(
      join(process.cwd(), 'src/features/billing/components/SupportCheckoutActions.tsx'),
      'utf8',
    );
    const contentCatalog = readFileSync(
      join(process.cwd(), 'src/features/public-site/model/siteContent.ts'),
      'utf8',
    );

    for (const disclosure of [
      'voluntary',
      'separate from Creator Pass',
      'does not provide CardForge product access',
      'not a charitable donation or tax-deductible',
      'does not provide equity',
      'Payments are not active yet',
    ]) {
      expect(cameron).toContain(disclosure);
    }
    expect(contentCatalog).toContain('Creator Pass is the best way to support CardForge as a business');
    expect(contentCatalog).toContain('food, housing, transportation');
    expect(cameron).toContain("siteContent['founder.creator-pass.body']");
    expect(cameron).toContain('supportOffers ?');
    expect(cameron).toContain('<SupportCheckoutActions');
    expect(existsSync(join(process.cwd(), 'src/app/support/page.tsx'))).toBe(false);
    expect(checkout).toContain('/api/billing/support/checkout');
    expect(checkout).toContain('does not provide CardForge product access');
    expect(checkout).toContain('Renews monthly until canceled');
    expect(checkout).toContain('aria-live="polite"');
    expect(checkout).toContain('text-[#2f2418]');
    expect(checkout).not.toContain('text-[var(--public-text)]');
  });

  it('uses the shared public shell across public marketing routes', () => {
    for (const route of ['about', 'cameron', 'developer', 'roadmap']) {
      expect(readRoute(route), route).toMatch(/<(?:Configured)?PublicSiteShell/u);
    }
  });
});
