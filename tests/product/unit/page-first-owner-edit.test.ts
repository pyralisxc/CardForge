import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('next/image', () => ({
  default: ({ src, alt, fill: _fill, priority: _priority, unoptimized: _unoptimized, ...props }: {
    src: string; alt: string; fill?: boolean; priority?: boolean; unoptimized?: boolean;
    [key: string]: unknown;
  }) => createElement('img', { ...props, src, alt }),
}));

import {
  PublicSiteOwnerLiveControls,
  getSupplementalOwnerPageTargets,
} from '@/features/public-site/components/PublicSiteOwnerLiveControls';
import { PublicSiteCopyLiveEditor, PublicSiteFocusedTextEditor } from '@/features/public-site/components/PublicSiteCopyLiveEditor';
import { PublicSiteHeader } from '@/features/public-site/components/PublicSiteHeader';
import { OutcomeHero } from '@/features/public-site/components/OutcomeHero';
import { ResponsiveSiteMediaImage } from '@/features/public-site/components/ResponsiveSiteMediaImage';
import { DEFAULT_SITE_CONTENT_BLOCKS } from '@/features/public-site/model/siteContent';
import { DEFAULT_PUBLIC_SITE_CONFIGURATION } from '@/features/public-site/model/siteConfiguration';
import { getDefaultSiteMedia } from '@/features/public-site/model/siteMedia';

describe('consolidated page-first Owner editor', () => {
  it('has one entry point outside edit mode, without competing Site settings navigation', () => {
    const html = renderToStaticMarkup(createElement(PublicSiteOwnerLiveControls, {
      currentPath: '/',
      publicationEnvironment: 'preview',
      initialBlocks: DEFAULT_SITE_CONTENT_BLOCKS,
      initialMedia: [getDefaultSiteMedia('brand.mark'), getDefaultSiteMedia('landing.hero'), getDefaultSiteMedia('brand.favicon')],
      initialSiteConfiguration: DEFAULT_PUBLIC_SITE_CONFIGURATION,
      siteOperationsEditor: createElement('span', null, 'Canonical site controls'),
    }));
    expect(html).toContain('Edit page');
    expect(html).not.toContain('Site settings');
    expect(html).toContain('Preview — staging only');
    expect(html).not.toContain('Edit Homepage');
    expect(html).not.toContain('Edit rendered copy');
  });

  it('excludes rendered values from the supplemental catalog but preserves every unreachable Owner value', () => {
    const blocks = DEFAULT_SITE_CONTENT_BLOCKS.filter((item) =>
      ['landing.hero.headline', 'landing.hero.body', 'landing.final.headline'].includes(item.slug));
    const media = ['brand.mark', 'brand.favicon', 'brand.watermark', 'landing.hero'].map((slot) =>
      getDefaultSiteMedia(slot as Parameters<typeof getDefaultSiteMedia>[0]));
    const rest = getSupplementalOwnerPageTargets({
      blocks,
      media,
      renderedCopySlugs: new Set(['landing.hero.headline', 'landing.hero.body']),
      renderedMediaSlots: new Set(['brand.mark', 'landing.hero']),
    });
    expect(rest.copy).toEqual(['landing.final.headline']);
    expect(rest.media).toEqual(['brand.favicon', 'brand.watermark']);
  });

  it('shows only one focused copy field rather than the former group/page copy catalog', () => {
    const block = DEFAULT_SITE_CONTENT_BLOCKS.find((item) => item.slug === 'landing.hero.headline')!;
    const html = renderToStaticMarkup(createElement(PublicSiteCopyLiveEditor, {
      block,
      busy: false,
      onDirtyChange: vi.fn(),
      onPublish: vi.fn(),
      publicationEnvironment: 'preview',
    }));
    expect(html).toContain(block.label);
    expect(html).toContain('Publish to Preview');
    expect(html).not.toContain('Shared header & footer');
    expect(html).not.toContain('Landing page');
  });

  it('keeps the canonical media slot on its rendered image, not an alternative catalog id', () => {
    const html = renderToStaticMarkup(createElement(ResponsiveSiteMediaImage, {
      media: getDefaultSiteMedia('landing.hero'),
      width: 640,
      height: 320,
    }));
    expect(html).toContain('data-site-media-slot="landing.hero"');
    expect(html).toContain('alt=');
  });
  it('marks visible header navigation and primary CTA as selected Owner labels without moving their links', () => {
    const html = renderToStaticMarkup(createElement(PublicSiteHeader, {
      businessIdentity: { brandName: 'CardForge' },
      siteConfiguration: { ...DEFAULT_PUBLIC_SITE_CONFIGURATION, updatedAt: '2026-10-09T00:00:00Z' },
    }));
    expect(html).toContain('data-site-navigation-id="about"');
    expect(html).toContain('data-site-navigation-id="plans"');
    expect(html).toContain('data-site-configuration-field="primaryCtaLabel"');
    expect(html).toContain('href="/about"');
    const hero = renderToStaticMarkup(createElement(OutcomeHero, {
      headline: 'Build', body: 'Design complete Sets.', support: 'Create',
      primaryActionHref: '/account', primaryActionLabel: 'Open your Desk',
    }));
    expect(hero).toContain('data-site-configuration-field="primaryCtaLabel"');
    expect(hero).toContain('href="/account"');
  });

  it('reuses the one focused field editor for visible Owner configuration labels', () => {
    const html = renderToStaticMarkup(createElement(PublicSiteFocusedTextEditor, {
      label: 'Primary action label',
      value: 'Open your Desk',
      maxLength: 80,
      busy: false,
      onPublish: vi.fn(),
      onDirtyChange: vi.fn(),
      publicationEnvironment: 'preview',
    }));
    expect(html).toContain('Primary action label');
    expect(html).toContain('Open your Desk');
    expect(html).toContain('Publish to Preview');
  });

});
