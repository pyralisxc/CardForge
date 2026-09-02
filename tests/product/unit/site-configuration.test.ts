import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PUBLIC_SITE_CONFIGURATION,
  completePublicSiteConfiguration,
  hydratePublicSiteConfiguration,
  normalizePublicSiteConfigurationInput,
} from '@/features/public-site/model/siteConfiguration';

describe('public site configuration', () => {
  it('keeps navigation routes code-owned while preserving owner order and labels', () => {
    const configuration = hydratePublicSiteConfiguration({
      primary_navigation: [
        { id: 'account', label: 'Your cards', href: 'https://example.com', visible: false },
        { id: 'about', label: 'Learn', href: '/owner', visible: true },
        { id: 'unknown', label: 'Unsafe', href: '/unsafe', visible: true },
      ],
    });

    expect(configuration.primaryNavigation).toEqual([
      { id: 'account', label: 'Your cards', href: '/account', visible: false },
      { id: 'about', label: 'Learn', href: '/about', visible: true },
      { id: 'plans', label: 'Plans', href: '/plans', visible: true },
      { id: 'roadmap', label: 'Roadmap', href: '/roadmap', visible: true },
    ]);
  });

  it('completes cached configuration when a new code-owned destination ships', () => {
    const legacyCached = {
      ...DEFAULT_PUBLIC_SITE_CONFIGURATION,
      primaryNavigation: DEFAULT_PUBLIC_SITE_CONFIGURATION.primaryNavigation.filter((item) => item.id !== 'plans'),
    };

    expect(completePublicSiteConfiguration(legacyCached).primaryNavigation).toContainEqual({
      id: 'plans',
      label: 'Plans',
      href: '/plans',
      visible: true,
    });
  });

  it('rejects external actions and invalid owner presentation values', () => {
    const base = {
      ...DEFAULT_PUBLIC_SITE_CONFIGURATION,
      primaryNavigation: [...DEFAULT_PUBLIC_SITE_CONFIGURATION.primaryNavigation],
      homepageSections: [...DEFAULT_PUBLIC_SITE_CONFIGURATION.homepageSections],
    };

    expect(() => normalizePublicSiteConfigurationInput({
      ...base,
      primaryCtaHref: 'https://example.com',
    })).toThrow('safe CardForge path');

    expect(() => normalizePublicSiteConfigurationInput({
      ...base,
      primaryCtaHref: '//example.com',
    })).toThrow('safe CardForge path');

    expect(() => normalizePublicSiteConfigurationInput({
      ...base,
      watermarkPreviewOpacity: 0,
    })).toThrow('Preview watermark opacity');

    expect(() => normalizePublicSiteConfigurationInput({
      ...base,
      searchKeywords: [],
    })).toThrow('search phrases');
  });

  it('restores missing allowed sections and never admits unknown section ids', () => {
    const configuration = hydratePublicSiteConfiguration({
      homepage_sections: [
        { id: 'workflow', visible: false },
        { id: 'unknown', visible: false },
      ],
    });

    expect(configuration.homepageSections.map(({ id, visible }) => ({ id, visible }))).toEqual([
      { id: 'workflow', visible: false },
      { id: 'showcase', visible: true },
      { id: 'access', visible: true },
      { id: 'founder', visible: true },
      { id: 'final_cta', visible: true },
    ]);
    expect(configuration.homepageSections.find((section) => section.id === 'showcase')?.showcaseExamples?.length).toBeGreaterThan(0);
  });

  it('hydrates owner-selected showcase Templates, order, card data, and accessibility copy', () => {
    const configuration = hydratePublicSiteConfiguration({
      homepage_sections: [
        {
          id: 'showcase',
          visible: true,
          showcaseExamples: [
            {
              slug: 'owner-demo',
              name: 'Owner demo set',
              visible: true,
              frontTemplateId: 'published-template',
              frontTemplateName: 'Published Template',
              rows: [
                { CardName: 'Alpha', Artwork: 'https://example.com/alpha.png' },
                { CardName: 'Beta', Artwork: 'https://example.com/beta.png' },
              ],
              altText: ['Alpha finished card.', 'Beta finished card.'],
            },
          ],
        },
      ],
    });

    expect(configuration.homepageSections[0]).toMatchObject({
      id: 'showcase',
      showcaseExamples: [{
        slug: 'owner-demo',
        name: 'Owner demo set',
        frontTemplateId: 'published-template',
        rows: [{ CardName: 'Alpha', Artwork: 'https://example.com/alpha.png' }, { CardName: 'Beta', Artwork: 'https://example.com/beta.png' }],
        altText: ['Alpha finished card.', 'Beta finished card.'],
      }],
    });
  });

  it('rejects unsafe showcase snapshots instead of silently publishing inaccessible demos', () => {
    const base = {
      ...DEFAULT_PUBLIC_SITE_CONFIGURATION,
      primaryNavigation: [...DEFAULT_PUBLIC_SITE_CONFIGURATION.primaryNavigation],
      homepageSections: DEFAULT_PUBLIC_SITE_CONFIGURATION.homepageSections.map((section) => ({
        ...section,
        showcaseExamples: section.showcaseExamples?.map((example) => ({ ...example, rows: example.rows.map((row) => ({ ...row })), altText: [...example.altText] })),
      })),
    };
    const showcaseIndex = base.homepageSections.findIndex((section) => section.id === 'showcase');
    const showcase = base.homepageSections[showcaseIndex]!;

    expect(() => normalizePublicSiteConfigurationInput({
      ...base,
      homepageSections: base.homepageSections.map((section, index) => index === showcaseIndex ? {
        ...showcase,
        showcaseExamples: showcase.showcaseExamples?.map((example, exampleIndex) => exampleIndex === 0 ? { ...example, altText: [] } : example),
      } : section),
    })).toThrow('complete alt text');

    expect(() => normalizePublicSiteConfigurationInput({
      ...base,
      homepageSections: base.homepageSections.map((section, index) => index === showcaseIndex ? {
        ...showcase,
        showcaseExamples: showcase.showcaseExamples?.map((example) => ({ ...example, visible: false })),
      } : section),
    })).toThrow('at least one visible set');
  });
});
