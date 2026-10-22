import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
vi.mock('@/features/public-site/client', async () => ({ ...(await import('@/features/public-site/model/homepageComposition')) }));
import { OwnerHomepageComposerPanel } from '@/features/owner/components/OwnerHomepageComposerPanel';
import { OwnerSitePagesPanel } from '@/features/owner/components/OwnerSitePagesPanel';
import type { PublicSitePage } from '@/features/public-site/client';
import { parseHomepageCustomSection, type HomepageCustomSection } from '@/features/public-site/model/homepageComposition';
import { getOwnerSitePageContext, isOwnerSiteMediaTarget } from '@/features/public-site/model/sitePages';

type Node = ReactElement<Record<string, unknown>>;
const nodes = (root: ReactNode): Node[] => {
  if (Array.isArray(root)) return root.flatMap(nodes);
  if (!root || typeof root !== 'object' || !('props' in root)) return [];
  const node = root as Node; return [node, ...nodes(node.props.children as ReactNode)];
};
const source: HomepageCustomSection = { id: 'custom-source', kind: 'custom', visible: true,
  design: { layout: 'split', tone: 'raised', spacing: 'balanced', align: 'center' },
  blocks: [{ id: 'block-text', kind: 'heading', text: 'Reusable story' },
    { id: 'block-image', kind: 'image', mediaSlot: 'landing.composer.block-image' }],
};

describe('canonical section operations', () => {
  it('duplicates a section with new content identities while deliberately reusing public media', () => {
    const onChange = vi.fn();
    const tree = OwnerHomepageComposerPanel({ sections: [source], onChange });
    const button = nodes(tree).find((node) => node.props['aria-label'] === 'Duplicate custom-source')!;
    (button.props.onClick as () => void)();
    const result = onChange.mock.calls[0]![0] as HomepageCustomSection[];
    expect(result[0]).toEqual(source);
    expect(result[1]?.id).not.toBe(source.id);
    expect(result[1]?.blocks.map((block) => block.id)).not.toEqual(source.blocks.map((block) => block.id));
    expect(result[1]?.blocks[1]?.mediaSlot).toBe('landing.composer.block-image');
    expect(parseHomepageCustomSection(result[1])).not.toBeNull();
  });
  it('duplicates one block without changing siblings and preserves native media authority', () => {
    const onChange = vi.fn();
    const tree = OwnerHomepageComposerPanel({ sections: [source], onChange });
    const button = nodes(tree).find((node) => node.props['aria-label'] === 'Duplicate block block-image')!;
    (button.props.onClick as () => void)();
    const result = (onChange.mock.calls[0]![0] as HomepageCustomSection[])[0]!;
    expect(result.blocks.slice(0, 2)).toEqual(source.blocks);
    expect(result.blocks[2]?.id).not.toBe('block-image');
    expect(result.blocks[2]?.mediaSlot).toBe('landing.composer.block-image');
    expect(parseHomepageCustomSection(result)).not.toBeNull();
  });
});


describe('Owner live-edit route context', () => {
  const page: PublicSitePage = {
    id: 'page-guide',
    slug: 'guide',
    title: 'Guide',
    description: 'A guide for CardForge visitors.',
    keywords: ['guide'],
    published: true,
    sections: [{
      id: 'custom-guide',
      kind: 'custom',
      visible: true,
      design: { layout: 'stack', tone: 'raised', spacing: 'balanced', align: 'start' },
      blocks: [
        { id: 'block-guide-heading', kind: 'heading', text: 'Welcome' },
        { id: 'block-guide-image', kind: 'image', mediaSlot: 'landing.composer.block-guide-image' },
      ],
    }],
  };

  it('scopes authored-page editing to the page and shared shell, not homepage copy or media', () => {
    const context = getOwnerSitePageContext('/guide', [page]);
    expect(context.label).toBe('Guide');
    expect(context.authoredPage).toBe(page);
    expect(context.contentGroups).toEqual(['shell']);
    expect(context.mediaGroups).toEqual(['brand', 'landing', 'showcase']);
    expect(context.mediaSlots).toEqual(['landing.composer.block-guide-image']);
    expect(isOwnerSiteMediaTarget(context, { group: 'brand', slot: 'brand.mark' })).toBe(true);
    expect(isOwnerSiteMediaTarget(context, { group: 'landing', slot: 'landing.composer.block-guide-image' })).toBe(true);
    expect(isOwnerSiteMediaTarget(context, { group: 'landing', slot: 'landing.hero' })).toBe(false);
  });

  it('preserves code-owned route context and homepage fallback', () => {
    expect(getOwnerSitePageContext('/about', [page])).toMatchObject({
      label: 'About',
      contentGroups: ['about', 'shell'],
      mediaGroups: ['brand'],
      authoredPage: null,
    });
    expect(getOwnerSitePageContext('/', [page])).toMatchObject({
      label: 'Homepage',
      contentGroups: ['landing', 'shell', 'sharing'],
      mediaGroups: ['brand', 'landing', 'showcase'],
      authoredPage: null,
    });
  });
});

describe('first-party page editor accessibility', () => {
  it('keeps an included navigation destination aligned with the edited page path', () => {
    const page: PublicSitePage = {
      id: 'page-guide',
      slug: 'guide',
      title: 'Guide',
      description: 'A guide for CardForge visitors.',
      keywords: ['guide'],
      published: true,
      sections: [{
        id: 'custom-guide',
        kind: 'custom',
        visible: true,
        design: { layout: 'stack', tone: 'raised', spacing: 'balanced', align: 'start' },
        blocks: [{ id: 'block-guide', kind: 'heading', text: 'Welcome' }],
      }],
    };
    const navigation = [
      { id: page.id, label: 'Guide', href: '/guide', visible: true },
      { id: 'about' as const, label: 'About', href: '/about', visible: true },
    ];
    const onChange = vi.fn();
    const tree = OwnerSitePagesPanel({
      pages: [page],
      navigation,
      selectedId: page.id,
      onSelect: vi.fn(),
      onChange,
    });
    const pathInput = nodes(tree).find((node) => node.props['aria-describedby'] === 'page-path-help-page-guide');
    const changePath = pathInput?.props.onChange as (event: { target: { value: string } }) => void;

    changePath({ target: { value: 'getting-started' } });

    const [nextPages, nextNavigation] = onChange.mock.calls[0] as [PublicSitePage[], typeof navigation];
    expect(nextPages[0]?.slug).toBe('getting-started');
    expect(nextNavigation).toEqual([
      { id: page.id, label: 'Guide', href: '/getting-started', visible: true },
      { id: 'about', label: 'About', href: '/about', visible: true },
    ]);
  });

  it('associates the path rules and published-address warning with the Page path input', () => {
    const page: PublicSitePage = {
      id: 'page-guide',
      slug: 'guide',
      title: 'Guide',
      description: 'A guide for CardForge visitors.',
      keywords: ['guide'],
      published: true,
      sections: [{
        id: 'custom-guide',
        kind: 'custom',
        visible: true,
        design: { layout: 'stack', tone: 'raised', spacing: 'balanced', align: 'start' },
        blocks: [{ id: 'block-guide', kind: 'heading', text: 'Welcome' }],
      }],
    };
    const tree = OwnerSitePagesPanel({
      pages: [page],
      navigation: [],
      selectedId: page.id,
      onSelect: vi.fn(),
      onChange: vi.fn(),
    });
    const rendered = nodes(tree);
    const pathInput = rendered.find((node) => node.props['aria-describedby'] === 'page-path-help-page-guide');
    const help = rendered.find((node) => node.props.id === 'page-path-help-page-guide');

    expect(pathInput).toBeDefined();
    expect(help).toBeDefined();
    const helpText = Array.isArray(help?.props.children)
      ? help.props.children.map(String).join('')
      : String(help?.props.children ?? '');
    expect(helpText).toContain('lowercase words separated by hyphens');
    expect(helpText).toContain('Changing a published path removes its old address.');
  });
});
