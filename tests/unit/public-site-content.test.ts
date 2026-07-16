import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SITE_CONTENT_BLOCKS,
  DEFAULT_SITE_OPERATOR_SETTINGS,
  normalizeSiteContentBlockInput,
  normalizeSiteOperatorSettingsInput,
} from '@/features/public-site/client';

describe('public site content rules', () => {
  it('ships with the editable public content blocks', () => {
    expect(DEFAULT_SITE_CONTENT_BLOCKS.map((block) => block.slug)).toEqual([
      'landing.hero.headline',
      'landing.hero.body',
      'landing.hero.support',
      'landing.demo.heading',
      'landing.demo.body',
      'about.hero.headline',
      'about.hero.body',
      'access.hero.headline',
      'access.hero.body',
      'access.creatorPool.note',
    ]);
  });

  it('normalizes operator identity settings', () => {
    expect(normalizeSiteOperatorSettingsInput({
      businessName: '  Card Forge LLC  ',
      ownerName: '  Cameron Locke ',
      supportEmail: '  pyraliscameron@gmail.com ',
      supportPhone: '  555-0100 ',
      websiteUrl: '  https://cardforge.example ',
    })).toEqual({
      businessName: 'Card Forge LLC',
      ownerName: 'Cameron Locke',
      supportEmail: 'pyraliscameron@gmail.com',
      supportPhone: '555-0100',
      websiteUrl: 'https://cardforge.example',
    });
    expect(normalizeSiteOperatorSettingsInput({})).toEqual(DEFAULT_SITE_OPERATOR_SETTINGS);
  });

  it('accepts only bounded known content blocks', () => {
    expect(normalizeSiteContentBlockInput({
      slug: 'landing.hero.headline',
      body: '  A sharper owner-controlled headline.  ',
    })).toEqual({
      ok: true,
      value: {
        slug: 'landing.hero.headline',
        body: 'A sharper owner-controlled headline.',
      },
    });
    expect(normalizeSiteContentBlockInput({
      slug: 'new.random.page',
      body: 'No page builder from owner console.',
    }).ok).toBe(false);
    expect(normalizeSiteContentBlockInput({
      slug: 'landing.hero.body',
      body: 'x'.repeat(801),
    }).ok).toBe(false);
  });
});
