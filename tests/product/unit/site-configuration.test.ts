import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PUBLIC_SITE_CONFIGURATION,
  completePublicSiteConfiguration,
  getPublicHeaderPresentation,
  hydratePublicSiteConfiguration,
  normalizePublicSiteConfigurationInput,
} from '@/features/public-site/model/siteConfiguration';

describe('public site configuration', () => {
  it('allows duplicated blocks to deliberately reuse canonical public media', () => {
    const section = {
      id: 'custom-gallery', kind: 'custom', visible: true,
      design: { layout: 'grid', tone: 'raised', spacing: 'balanced', align: 'start' },
      blocks: [{ id: 'block-hero', kind: 'image', mediaSlot: 'landing.composer.block-hero' }],
    };
    const apply = (item: typeof section) => normalizePublicSiteConfigurationInput({
      ...DEFAULT_PUBLIC_SITE_CONFIGURATION,
      homepageSections: [...DEFAULT_PUBLIC_SITE_CONFIGURATION.homepageSections, item],
    });
    expect(apply(section).homepageSections.at(-1)).toMatchObject(section);
    expect(apply({ ...section, blocks: [{
      id: 'block-copy', kind: 'image', mediaSlot: 'landing.composer.block-hero',
    }] }).homepageSections.at(-1)).toMatchObject({ blocks: [{ id: 'block-copy', mediaSlot: 'landing.composer.block-hero' }] });
  });

  it('supports four modern CardForge Desk-to-Output screenshots without repurposing legacy artwork', () => {
    const stages = [
      { id: 'desk', label: 'Your Desk', kind: 'screenshots', views: [{ label: 'Desk overview', mediaSlot: 'landing.showcase.desk' }] },
      { id: 'set', label: 'Edit a Set', kind: 'screenshots', views: [{ label: 'Set editor', mediaSlot: 'landing.showcase.set' }] },
      { id: 'template', label: 'Design Templates', kind: 'screenshots', views: [{ label: 'Template editor', mediaSlot: 'landing.showcase.template' }] },
      { id: 'output', label: 'Export', kind: 'screenshots', views: [{ label: 'Output panel', mediaSlot: 'landing.showcase.output' }] },
    ];
    const configuration = normalizePublicSiteConfigurationInput({
      ...DEFAULT_PUBLIC_SITE_CONFIGURATION,
      homepageSections: DEFAULT_PUBLIC_SITE_CONFIGURATION.homepageSections.map((section) => (
        section.id === 'showcase' ? { ...section, showcaseStages: stages } : section
      )),
    });
    expect(configuration.homepageSections.find((section) => section.id === 'showcase')?.showcaseStages)
      .toMatchObject(stages);
  });

  it('accepts reusable, ordered, responsive content sections without a new CMS', () => {
    const custom = {
      id: 'custom-desk-tour', kind: 'custom', visible: true,
      design: { layout: 'grid', tone: 'raised', spacing: 'spacious', align: 'center' },
      blocks: [
        { id: 'headline', kind: 'heading', text: 'Start from your Desk' },
        { id: 'feature-desk', kind: 'feature', title: 'Organize', body: 'All your Sets in one place.' },
        { id: 'screenshot', kind: 'image', mediaSlot: 'landing.showcase.layout' },
        { id: 'cta', kind: 'button', text: 'Open your Desk', href: '/account' },
      ],
    };
    const normalized = normalizePublicSiteConfigurationInput({
      ...DEFAULT_PUBLIC_SITE_CONFIGURATION,
      homepageSections: [DEFAULT_PUBLIC_SITE_CONFIGURATION.homepageSections[0], custom,
        ...DEFAULT_PUBLIC_SITE_CONFIGURATION.homepageSections.slice(1)],
    });
    expect(normalized.homepageSections[1]).toMatchObject(custom);
    expect(hydratePublicSiteConfiguration({ homepage_sections: normalized.homepageSections }).homepageSections[1])
      .toMatchObject(custom);
  });

  it('rejects executable content, outside-site links, and invalid section blocks', () => {
    const base = { id: 'custom-hero', kind: 'custom', visible: true,
      design: { layout: 'stack', tone: 'charcoal', spacing: 'balanced', align: 'start' } };
    const check = (blocks: unknown[]) => normalizePublicSiteConfigurationInput({
      ...DEFAULT_PUBLIC_SITE_CONFIGURATION,
      homepageSections: [...DEFAULT_PUBLIC_SITE_CONFIGURATION.homepageSections, { ...base, blocks }],
    });
    expect(() => check([{ id: 'button', kind: 'button', text: 'External', href: 'https://example.com' }]))
      .toThrow(/Custom website sections/i);
    expect(() => check([{ id: 'broken', kind: 'image', mediaSlot: 'https://external.example/a.png' }]))
      .toThrow(/Custom website sections/i);
    expect(() => check([{ id: 'script', kind: 'html', text: '<script>alert(1)</script>' }]))
      .toThrow(/Custom website sections/i);
    expect(() => check([{ id: 'one', kind: 'heading', text: 'One' }, { id: 'one', kind: 'text', text: 'Duplicate' }]))
      .toThrow(/Custom website sections/i);
  });


  it('keeps legacy published homepage walkthroughs intact until new stages are explicitly saved', () => {
    const legacy = hydratePublicSiteConfiguration({ homepage_sections: [
      { id: 'showcase', visible: true },
      { id: 'workflow', visible: true },
    ] });
    expect(legacy.homepageSections.find((section) => section.id === 'showcase')?.showcaseStages).toBeUndefined();
  });

  it('supports ordered Owner walkthrough screenshots and rendered demonstrations with no external media URLs', () => {
    const stages = [
      { id: 'desk', label: 'Your Desk', kind: 'screenshots', description: 'Organize Sets on one working surface.',
        views: [{ label: 'Desk overview', mediaSlot: 'landing.showcase.generator-single' }] },
      { id: 'set', label: 'Edit a Set', kind: 'screenshots',
        views: [{ label: 'Card editing', mediaSlot: 'landing.showcase.generator-bulk' }] },
      { id: 'templates', label: 'Make Templates', kind: 'screenshots',
        views: [{ label: 'Template editor', mediaSlot: 'landing.showcase.layout' }] },
      { id: 'result', label: 'Explore results', kind: 'rendered-set' },
    ] as const;
    const config = normalizePublicSiteConfigurationInput({
      ...DEFAULT_PUBLIC_SITE_CONFIGURATION,
      homepageSections: DEFAULT_PUBLIC_SITE_CONFIGURATION.homepageSections.map((section) => (
        section.id === 'showcase' ? { ...section, showcaseStages: stages } : section
      )),
    });
    expect(config.homepageSections.find((section) => section.id === 'showcase')?.showcaseStages)
      .toMatchObject(stages);
    const hydrated = hydratePublicSiteConfiguration({ homepage_sections: config.homepageSections });
    expect(hydrated.homepageSections.find((section) => section.id === 'showcase')?.showcaseStages)
      .toMatchObject(stages);
  });

  it('rejects duplicate stages, unsupported media targets, and misleading rendered-set image configuration', () => {
    const publish = (stages: unknown) => normalizePublicSiteConfigurationInput({
      ...DEFAULT_PUBLIC_SITE_CONFIGURATION,
      homepageSections: DEFAULT_PUBLIC_SITE_CONFIGURATION.homepageSections.map((section) => (
        section.id === 'showcase' ? { ...section, showcaseStages: stages } : section
      )),
    });
    expect(() => publish([{ id: 'a', label: 'A', kind: 'rendered-set' }, { id: 'a', label: 'Another', kind: 'rendered-set' }]))
      .toThrow(/walkthrough/i);
    expect(() => publish([{ id: 'unsafe', label: 'Unsafe image', kind: 'screenshots',
      views: [{ label: 'Secret', mediaSlot: 'brand.social' }] }])).toThrow(/approved image slots/i);
    expect(() => publish([{ id: 'extra', label: 'Not a screenshot', kind: 'rendered-set',
      views: [{ label: 'Unknown', mediaSlot: 'landing.showcase.layout' }] }])).toThrow(/walkthrough/i);
    expect(() => publish([])).toThrow(/walkthrough/i);
    expect(() => publish([{ id: 'bad', label: '<script>', kind: 'screenshots', views: [
      { label: 'External', mediaSlot: 'https://example.com/a.png' },
    ] }])).toThrow(/approved image slots/i);
  });


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

  it('uses the Owner primary action in the global header and keeps other approved destinations visible', () => {
    const configuration = {
      ...DEFAULT_PUBLIC_SITE_CONFIGURATION,
      primaryCtaLabel: 'See plans',
      primaryCtaHref: '/plans',
      primaryNavigation: DEFAULT_PUBLIC_SITE_CONFIGURATION.primaryNavigation.map((item) => (
        item.id === 'account' ? { ...item, label: 'Your Desk' } : item
      )),
    };

    expect(getPublicHeaderPresentation(configuration)).toMatchObject({
      primaryCtaLabel: 'See plans',
      primaryCtaHref: '/plans',
      visibleNavigation: expect.arrayContaining([
        expect.objectContaining({ id: 'account', label: 'Your Desk', href: '/account' }),
      ]),
    });
    expect(getPublicHeaderPresentation(configuration).visibleNavigation)
      .not.toContainEqual(expect.objectContaining({ href: '/plans' }));
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
      { id: 'hero', visible: true },
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

    expect(configuration.homepageSections.find((section) => section.id === 'showcase')).toMatchObject({
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

  it('requires visible homepage demonstrations to pin exact published Template revisions', () => {
    const base = {
      ...DEFAULT_PUBLIC_SITE_CONFIGURATION,
      primaryNavigation: [...DEFAULT_PUBLIC_SITE_CONFIGURATION.primaryNavigation],
      homepageSections: DEFAULT_PUBLIC_SITE_CONFIGURATION.homepageSections.map((section) => ({
        ...section,
        showcaseExamples: section.showcaseExamples?.map((example) => ({
          ...example,
          rows: example.rows.map((row) => ({ ...row })),
          altText: [...example.altText],
        })),
      })),
    };
    const showcaseIndex = base.homepageSections.findIndex((section) => section.id === 'showcase');
    const showcase = base.homepageSections[showcaseIndex]!;
    const unpinned = showcase.showcaseExamples!.map((example, index) => (
      index === 0 ? { ...example, frontTemplateRevision: null } : example
    ));

    expect(() => normalizePublicSiteConfigurationInput({
      ...base,
      homepageSections: base.homepageSections.map((section, index) => (
        index === showcaseIndex ? { ...showcase, showcaseExamples: unpinned } : section
      )),
    })).toThrow(/must pin the exact published Template revision/i);

    expect(normalizePublicSiteConfigurationInput(base).homepageSections
      .find((section) => section.id === 'showcase')?.showcaseExamples
      ?.every((example) => example.frontTemplateRevision !== null)).toBe(true);
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