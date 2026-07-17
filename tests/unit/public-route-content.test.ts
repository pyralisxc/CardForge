import { readFileSync } from 'node:fs';
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

    expect(about).toContain('Make one card. Build the whole set.');
    expect(about).toContain('Your work stays with you');
    expect(cameron).toContain('I’m Cameron');
    expect(cameron).toContain('Oregon sole proprietor');
    expect(cameron).toContain('AI-assisted code generation');
    expect(cameron).toContain('Hawaii');
    expect(cameron).toContain('hitchhiking');
    expect(cameron).toContain('first product');
    expect(cameron).toContain('href="/support"');
  });

  it('describes current access without calling Creator Pass planned', () => {
    const access = readRoute('access');

    expect(access).toContain('Creator Pass');
    expect(access).toContain('product subscription');
    expect(access).not.toContain('planned home');
  });

  it('publishes friendly support that activates checkout only with complete server configuration', () => {
    const support = readRoute('support');
    const checkout = readFileSync(
      join(process.cwd(), 'src/features/billing/components/SupportCheckoutActions.tsx'),
      'utf8',
    );

    for (const disclosure of [
      'voluntary',
      'separate from Creator Pass',
      'does not provide CardForge product access',
      'not a charitable donation or tax-deductible',
      'does not provide equity',
      'Payments are not active yet',
      'Creator Pass is the best way to support CardForge as a business',
      'food, housing, transportation',
    ]) {
      expect(support).toContain(disclosure);
    }
    expect(support).toContain('supportOffers ?');
    expect(support).toContain('<SupportCheckoutActions');
    expect(checkout).toContain('/api/billing/support/checkout');
    expect(checkout).toContain('does not provide CardForge product access');
    expect(checkout).toContain('Renews monthly until canceled');
    expect(checkout).toContain('aria-live="polite"');
  });

  it('uses the shared public shell across public marketing routes', () => {
    for (const route of ['about', 'access', 'cameron', 'support', 'developer', 'roadmap']) {
      expect(readRoute(route), route).toContain('<PublicSiteShell');
    }
  });
});
