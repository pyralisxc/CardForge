import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement, ReactNode } from 'react';

const hooks = vi.hoisted(() => ({ cells: [] as unknown[], cursor: 0 }));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      const index = hooks.cursor++;
      if (!(index in hooks.cells)) hooks.cells[index] = typeof initial === 'function' ? initial() : initial;
      return [hooks.cells[index], (next: unknown) => {
        hooks.cells[index] = typeof next === 'function' ? next(hooks.cells[index]) : next;
      }];
    },
    useRef: (initial: unknown) => {
      const index = hooks.cursor++;
      if (!(index in hooks.cells)) hooks.cells[index] = { current: initial };
      return hooks.cells[index];
    },
    useEffect: (effect: () => unknown) => { effect(); },
  };
});
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/features/owner/components/OwnerHomepageShowcasePanel', () => ({ OwnerHomepageShowcasePanel: () => null }));
vi.mock('@/features/public-site/client', async () => await import('@/features/public-site/model/ownerPublicationEnvironment')); 

import { PublicSiteFocusedTextEditor, savePublicSiteContentBlock, SiteContentPublicationError } from '@/features/public-site/components/PublicSiteCopyLiveEditor';
import { OwnerSiteConfigurationPanel } from '@/features/owner/components/OwnerSiteConfigurationPanel';
import { DEFAULT_PUBLIC_SITE_CONFIGURATION } from '@/features/public-site/model/siteConfiguration';

// Exercise the real component handlers with deterministic hook state; no simulated DOM or provider identity.
function render<T>(component: (props: T) => ReactElement, props: T) {
  hooks.cursor = 0;
  return component(props);
}
type Node = ReactElement<Record<string, unknown>>;
function nodes(root: ReactNode): Node[] {
  if (Array.isArray(root)) return root.flatMap(nodes);
  if (!root || typeof root !== 'object' || !('props' in root)) return [];
  const node = root as Node;
  return [node, ...nodes(node.props.children as ReactNode)];
}
function textOf(root: ReactNode): string {
  if (Array.isArray(root)) return root.map(textOf).join('');
  if (typeof root === 'string' || typeof root === 'number') return String(root);
  if (root && typeof root === 'object' && 'props' in root) return textOf((root as Node).props.children as ReactNode);
  return '';
}
function button(root: ReactNode, text: string) {
  return nodes(root).find((node) => typeof node.props.onClick === 'function' && textOf(node) === text)!;
}
async function click(node: Node) {
  await (node.props.onClick as () => unknown)();
  await new Promise((resolve) => setTimeout(resolve, 0));
}
function input(node: Node, value: string) { (node.props.onChange as (event: unknown) => void)({ target: { value } }); }
const configuration = { ...DEFAULT_PUBLIC_SITE_CONFIGURATION, updatedAt: '2026-10-13T00:00:00Z' };

beforeEach(() => {
  hooks.cells = [];
  hooks.cursor = 0;
  vi.unstubAllGlobals();
  vi.stubGlobal('window', { confirm: vi.fn(() => false) });
});

describe('focused Owner field validation', () => {
  it.each([true, false])('allows clearing only when the field explicitly allows empty text (%s)', (allowEmpty) => {
    const props = { label: 'Field', value: 'Original', maxLength: 240, allowEmpty, busy: false, publicationEnvironment: 'preview' as const, onPublish: vi.fn(), onDirtyChange: vi.fn() };
    let tree = render(PublicSiteFocusedTextEditor, props);
    input(nodes(tree).find((node) => node.type === 'input')!, '');
    tree = render(PublicSiteFocusedTextEditor, props);
    expect(button(tree, 'Publish to Preview').props.disabled).toBe(!allowEmpty);
  });
  it('blocks typing during publication and reports a remaining normalized draft when publication finishes', () => {
    const report = vi.fn();
    const props = { label: 'Field', value: 'Original', maxLength: 80, busy: false, publicationEnvironment: 'preview' as const, onPublish: vi.fn(), onDirtyChange: report };
    let tree = render(PublicSiteFocusedTextEditor, props);
    input(nodes(tree).find((node) => node.type === 'input')!, ' Original ');
    tree = render(PublicSiteFocusedTextEditor, { ...props, busy: true });
    expect(nodes(tree).find((node) => node.type === 'input')!.props.disabled).toBe(true);
    tree = render(PublicSiteFocusedTextEditor, props);
    expect(report).toHaveBeenLastCalledWith(true);
    expect(nodes(tree).find((node) => node.type === 'input')!.props.value).toBe(' Original ');
  });
  it('preserves the draft when a current-value readback changes the published baseline', () => {
    const props = { label: 'Field', value: 'Original', maxLength: 80, busy: false, publicationEnvironment: 'preview' as const, onPublish: vi.fn(), onDirtyChange: vi.fn() };
    let tree = render(PublicSiteFocusedTextEditor, props);
    input(nodes(tree).find((node) => node.type === 'input')!, 'My draft');
    tree = render(PublicSiteFocusedTextEditor, { ...props, value: 'Published elsewhere' });
    expect(nodes(tree).find((node) => node.type === 'input')!.props.value).toBe('My draft');
    expect(textOf(tree)).toContain('Current published value: Published elsewhere');
  });
});

describe('copy publication boundary', () => {
  it.each([409, 500])('requires current-state readback after status %s', async (status) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'Rejected' } }), { status })));
    await expect(savePublicSiteContentBlock({ slug: 'landing.hero.headline', body: 'Draft', updatedAt: configuration.updatedAt })).rejects.toMatchObject({ needsReadback: true });
  });
  it('does not assert non-commit when the successful response body is lost', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => { throw new TypeError('Lost response'); } })));
    await expect(savePublicSiteContentBlock({ slug: 'landing.hero.headline', body: 'Draft', updatedAt: configuration.updatedAt })).rejects.toBeInstanceOf(SiteContentPublicationError);
    await expect(savePublicSiteContentBlock({ slug: 'landing.hero.headline', body: 'Draft', updatedAt: configuration.updatedAt })).rejects.toMatchObject({ needsReadback: true, message: expect.stringContaining('unconfirmed') });
  });
});

describe('Owner site settings recovery', () => {
  it('treats a malformed successful response as uncertain, without applying it to the draft', async () => {
    const onSettingsChange = vi.fn();
    const props = { settings: configuration, publicationEnvironment: 'preview' as const, onSettingsChange };
    let tree = render(OwnerSiteConfigurationPanel, props);
    input(nodes(tree).find((node) => node.type === 'textarea' && node.props.maxLength === 240)!, 'Keep my draft');
    tree = render(OwnerSiteConfigurationPanel, props);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ settings: configuration, receipt: {} }))));
    await click(button(tree, 'Publish to Preview'));
    tree = render(OwnerSiteConfigurationPanel, props);
    expect(onSettingsChange).not.toHaveBeenCalled();
    expect(textOf(tree)).toContain('publication result is unconfirmed');
    expect(nodes(tree).find((node) => node.type === 'textarea' && node.props.maxLength === 240)!.props.value).toBe('Keep my draft');
    expect(button(tree, 'Publish to Preview').props.disabled).toBe(true);
  });
  it('reports dirty/saving state, blocks repeats, and keeps the draft through failed or declined readback', async () => {
    const report = vi.fn();
    const onSettingsChange = vi.fn();
    const props = { settings: configuration, publicationEnvironment: 'preview' as const, onSettingsChange, onEditorStateChange: report };
    let tree = render(OwnerSiteConfigurationPanel, props);
    input(nodes(tree).find((node) => node.type === 'textarea' && node.props.maxLength === 240)!, 'My announcement draft');
    tree = render(OwnerSiteConfigurationPanel, props);
    expect(report).toHaveBeenLastCalledWith({ dirty: true, saving: false });
    let fail!: (error: Error) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise((_resolve, reject) => { fail = reject; })));
    const pending = click(button(tree, 'Publish to Preview'));
    tree = render(OwnerSiteConfigurationPanel, props);
    expect(report).toHaveBeenLastCalledWith({ dirty: true, saving: true });
    expect(nodes(tree).find((node) => node.type === 'fieldset')!.props.disabled).toBe(true);
    expect(button(tree, 'Publishing to Preview…').props.disabled).toBe(true);
    fail(new TypeError('Response lost after commit'));
    await pending;
    tree = render(OwnerSiteConfigurationPanel, props);
    expect(textOf(tree)).toContain('publication result is unconfirmed');
    expect(button(tree, 'Publish to Preview').props.disabled).toBe(true);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Read unavailable'); }));
    await click(button(tree, 'Reload current settings'));
    tree = render(OwnerSiteConfigurationPanel, props);
    expect(nodes(tree).find((node) => node.type === 'textarea' && node.props.maxLength === 240)!.props.value).toBe('My announcement draft');
    const current = { ...configuration, updatedAt: '2026-10-13T01:00:00Z', announcementMessage: 'Committed remotely' };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ siteControls: { siteConfiguration: current } }))));
    await click(button(tree, 'Reload current settings'));
    tree = render(OwnerSiteConfigurationPanel, props);
    expect(onSettingsChange).not.toHaveBeenCalled();
    expect(nodes(tree).find((node) => node.type === 'textarea' && node.props.maxLength === 240)!.props.value).toBe('My announcement draft');
    vi.mocked(window.confirm).mockReturnValue(true);
    await click(button(tree, 'Reload current settings'));
    tree = render(OwnerSiteConfigurationPanel, { ...props, settings: current });
    expect(onSettingsChange).toHaveBeenLastCalledWith(current);
    expect(nodes(tree).find((node) => node.type === 'textarea' && node.props.maxLength === 240)!.props.value).toBe('Committed remotely');
    expect(textOf(tree)).not.toContain('Reload current settings');
  });
});
