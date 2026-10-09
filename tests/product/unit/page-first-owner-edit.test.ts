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

import { PublicSiteOwnerLiveControls } from '@/features/public-site/components/PublicSiteOwnerLiveControls';
import { ResponsiveSiteMediaImage } from '@/features/public-site/components/ResponsiveSiteMediaImage';
import { DEFAULT_SITE_CONTENT_BLOCKS } from '@/features/public-site/model/siteContent';
import { DEFAULT_PUBLIC_SITE_CONFIGURATION } from '@/features/public-site/model/siteConfiguration';
import { getDefaultSiteMedia } from '@/features/public-site/model/siteMedia';

describe('page-first Owner editing presentation', () => {
  it('offers one Edit page entry, with distinct non-visible settings and staging-only publication', () => {
    const html = renderToStaticMarkup(createElement(PublicSiteOwnerLiveControls, {
      currentPath: '/',
      publicationEnvironment: 'preview',
      initialBlocks: DEFAULT_SITE_CONTENT_BLOCKS,
      initialMedia: [getDefaultSiteMedia('brand.mark'), getDefaultSiteMedia('landing.hero'), getDefaultSiteMedia('brand.favicon'), getDefaultSiteMedia('brand.watermark')],
      initialSiteConfiguration: DEFAULT_PUBLIC_SITE_CONFIGURATION,
      siteOperationsEditor: createElement('span', null, 'Canonical site operations'),
    }));
    expect(html).toContain('Edit page');
    expect(html).toContain('Site settings');
    expect(html).toContain('Preview — staging only');
    expect(html).not.toContain('Edit rendered copy');
    expect(html).not.toContain('Edit Homepage');
  });

  it('marks the actual canonical media slot as the page target without a second image registry', () => {
    const media = getDefaultSiteMedia('landing.hero');
    const html = renderToStaticMarkup(createElement(ResponsiveSiteMediaImage, {
      media,
      width: 640,
      height: 320,
    }));
    expect(html).toContain('data-site-media-slot="landing.hero"');
    expect(html).toContain('alt=');
  });
});
