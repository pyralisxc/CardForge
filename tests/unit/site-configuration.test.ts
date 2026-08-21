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

    expect(configuration.homepageSections).toEqual([
      { id: 'workflow', visible: false },
      { id: 'showcase', visible: true },
      { id: 'access', visible: true },
      { id: 'founder', visible: true },
      { id: 'final_cta', visible: true },
    ]);
  });
});
