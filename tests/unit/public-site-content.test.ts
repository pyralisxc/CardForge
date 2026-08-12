import { describe, expect, it } from 'vitest';

import {
  createSiteContentMap,
  DEFAULT_SITE_CONTENT_BLOCKS,
  normalizeSiteContentBlockInput,
} from '@/features/public-site/client';

describe('public site content rules', () => {
  it('ships with the editable public content blocks', () => {
    expect(DEFAULT_SITE_CONTENT_BLOCKS.map((block) => block.slug)).toEqual([
      'landing.hero.headline',
      'landing.hero.body',
      'landing.hero.support',
      'about.hero.headline',
      'about.hero.body',
      'sharing.message',
    ]);
  });

  it('keeps the bundled public hero copy aligned with the polished live experience', () => {
    const content = createSiteContentMap(DEFAULT_SITE_CONTENT_BLOCKS);

    expect(content['landing.hero.support']).toBe('Build the card once. Let the set follow.');
    expect(content['landing.hero.headline']).toBe('Design one card. Add your list. CardForge builds the set.');
    expect(content['landing.hero.body']).toContain('keep your work on your device');
    expect(content['about.hero.headline']).toBe('Give everyday creators room to make it their own.');
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
    expect(normalizeSiteContentBlockInput({
      slug: 'access.hero.headline',
      body: 'This removed route must not remain editable.',
    }).ok).toBe(false);
  });
});
