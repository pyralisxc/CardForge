import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createSiteContentMap, DEFAULT_SITE_CONTENT_BLOCKS } from '@/features/public-site/model/siteContent';
import {
  HOMEPAGE_SHOWCASE_SCREENSHOT_SLOTS,
  MAX_HOMEPAGE_STAGE_VIEWS,
  parseHomepageShowcaseStages,
  type HomepageShowcaseStage,
} from '@/features/public-site/model/homepageShowcaseStages';

const state = vi.hoisted(() => ({ content: {} as Record<string, string> }));
vi.mock('@/features/public-site/client', async () => ({
  ...(await import('@/features/public-site/model/homepageShowcaseStages')),
  useSiteContent: () => state.content,
}));

import { OwnerHomepageStagesPanel } from '@/features/owner/components/OwnerHomepageStagesPanel';

type Node = ReactElement<Record<string, unknown>>;
function nodes(root: ReactNode): Node[] {
  if (Array.isArray(root)) return root.flatMap(nodes);
  if (!root || typeof root !== 'object' || !('props' in root)) return [];
  const node = root as Node;
  return [node, ...nodes(node.props.children as ReactNode)];
}
function text(root: ReactNode): string {
  if (Array.isArray(root)) return root.map(text).join('');
  if (typeof root === 'string' || typeof root === 'number') return String(root);
  return root && typeof root === 'object' && 'props' in root ? text((root as Node).props.children as ReactNode) : '';
}

describe('Owner homepage walkthrough editing', () => {
  it('adds only publishable screenshot views and stops at the canonical per-stage cap', () => {
    state.content = createSiteContentMap(DEFAULT_SITE_CONTENT_BLOCKS);
    let stages: HomepageShowcaseStage[] = [{ id: 'screenshots', label: 'Screenshots', kind: 'screenshots',
      views: HOMEPAGE_SHOWCASE_SCREENSHOT_SLOTS.slice(0, MAX_HOMEPAGE_STAGE_VIEWS - 1)
        .map((mediaSlot) => ({ label: mediaSlot, mediaSlot })),
    }];
    const onChange = vi.fn((next: HomepageShowcaseStage[]) => { stages = next; });
    const render = () => OwnerHomepageStagesPanel({ stages, onChange });
    const addButton = (tree: ReactNode) => nodes(tree).find((node) => text(node) === 'Add another screenshot view')!;

    let add = addButton(render());
    expect(add.props.disabled).toBe(false);
    (add.props.onClick as () => void)();
    expect(stages[0]?.views).toHaveLength(MAX_HOMEPAGE_STAGE_VIEWS);
    expect(parseHomepageShowcaseStages(stages)).not.toBeNull();
    add = addButton(render());
    expect(add.props.disabled).toBe(true);
    onChange.mockClear();
    (add.props.onClick as () => void)();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reorders legacy stages without replacing any published stage or screenshot-view label', () => {
    state.content = { ...createSiteContentMap(DEFAULT_SITE_CONTENT_BLOCKS),
      'landing.showcase.stage.templates': 'My authored Templates',
      'landing.showcase.stage.make': 'My authored generation',
      'landing.showcase.stage.review': 'My authored review',
      'landing.showcase.generator.single': 'S'.repeat(80),
      'landing.showcase.generator.bulk': 'B'.repeat(80),
    };
    const onChange = vi.fn();
    const tree = OwnerHomepageStagesPanel({ onChange });
    const move = nodes(tree).find((node) => node.props['aria-label'] === 'Move stage 2 up')!;
    (move.props.onClick as () => void)();
    const stages = onChange.mock.calls[0]![0] as HomepageShowcaseStage[];
    expect(stages.map(({ label }) => label)).toEqual([
      'My authored generation', 'My authored Templates', 'My authored review',
    ]);
    expect(stages[0]?.views?.map(({ label }) => label)).toEqual(['S'.repeat(80), 'B'.repeat(80)]);
    expect(parseHomepageShowcaseStages(stages)).not.toBeNull();
  });
});
