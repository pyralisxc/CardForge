import { describe, expect, it } from 'vitest';

import { PUBLIC_NAVIGATION } from '@/features/public-site/client';

describe('consolidated public navigation', () => {
  it('keeps one direct account destination and removes redundant marketing destinations', () => {
    const primaryLinks = PUBLIC_NAVIGATION.primary.map((link) => link.href);
    const footerLinks = PUBLIC_NAVIGATION.footerGroups.flatMap((group) => group.links.map((link) => link.href));

    expect(primaryLinks).toContain('/account');
    expect(primaryLinks).toContain('/plans');
    expect(footerLinks).toContain('/account');
    expect(footerLinks).toContain('/plans');
    expect([...primaryLinks, ...footerLinks]).not.toContain('/examples');
    expect([...primaryLinks, ...footerLinks]).not.toContain('/access');
    expect(footerLinks).not.toContain('/cameron#support');
    expect(primaryLinks).not.toContain('/cameron');
    expect(primaryLinks).not.toContain('/contributor');
  });
});
