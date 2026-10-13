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
    useMemo: (factory: () => unknown) => factory(),
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
import { OwnerBusinessIdentityPanel } from '@/features/business-identity/components/OwnerBusinessIdentityPanel';
import { DEFAULT_BUSINESS_IDENTITY } from '@/features/business-identity/model/businessIdentity';
import { OwnerFounderProfilePanel } from '@/features/owner/components/OwnerFounderProfilePanel';
import { DEFAULT_FOUNDER_PROFILE } from '@/features/public-site/model/founderProfile';
import { OwnerExperienceControlsPanel } from '@/features/experience-settings/components/OwnerExperienceControlsPanel';
import { DEFAULT_EXPERIENCE_SETTINGS } from '@/features/experience-settings/model/experienceSettings';
import { combineEditorDraftStates, useEditorDraft } from '@/components/ui/use-editor-draft';
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


describe('Owner multi-panel draft lifecycle', () => {
  it('keeps another editor dirty or busy when a clean editor reports its state', () => {
    expect(combineEditorDraftStates({ business: { dirty: true, saving: false }, founder: { dirty: false, saving: false } })).toEqual({ dirty: true, saving: false });
    expect(combineEditorDraftStates({ business: { dirty: false, saving: false }, founder: { dirty: true, saving: true } })).toEqual({ dirty: true, saving: true });
    expect(combineEditorDraftStates({})).toEqual({ dirty: false, saving: false });
  });

  it('retains a dirty draft and its original baseline across incoming values, then accepts a confirmed result', () => {
    const DraftHarness = (initial: { value: string; revision: number }) => { hooks.cursor = 0; return useEditorDraft(initial); };
    let form = DraftHarness({ value: 'Original', revision: 1 });
    form.setDraft({ value: 'My draft', revision: 1 });
    form = DraftHarness({ value: 'Newer published value', revision: 2 });
    expect(form.draft).toEqual({ value: 'My draft', revision: 1 });
    expect(form.baseline.revision).toBe(1);
    form.acceptPublished({ value: 'Confirmed', revision: 3 });
    form = DraftHarness({ value: 'Confirmed', revision: 3 });
    expect(form.dirty).toBe(false);
    expect(form.baseline.revision).toBe(3);
  });

  it('does not replace a confirmed result with unchanged stale parent props', () => {
    const DraftHarness = (initial: string) => { hooks.cursor = 0; return useEditorDraft(initial); };
    const form = DraftHarness('Original');
    form.acceptPublished('Confirmed');
    DraftHarness('Original');
    expect(DraftHarness('Original').draft).toBe('Confirmed');
  });

  it('does not replace a confirmed result with an incoming value already observed while dirty', () => {
    const DraftHarness = (initial: string) => { hooks.cursor = 0; return useEditorDraft(initial); };
    let form = DraftHarness('A');
    form.setDraft('My draft');
    form = DraftHarness('B');
    expect(form.baseline).toBe('A');
    form.acceptPublished('C');
    DraftHarness('B');
    expect(DraftHarness('B').draft).toBe('C');
  });

  it('updates clean drafts from refreshed native settings', () => {
    const DraftHarness = (initial: string) => { hooks.cursor = 0; return useEditorDraft(initial); };
    DraftHarness('Original');
    DraftHarness('Updated');
    expect(DraftHarness('Updated').draft).toBe('Updated');
  });

  it('reports identity edits and uses the draft’s original identity version after unrelated refreshes', async () => {
    const report = vi.fn();
    const saved = { ...DEFAULT_BUSINESS_IDENTITY, brandName: 'My draft brand', identityVersion: 2 };
    const onSave = vi.fn(async () => saved);
    const props = { businessIdentity: DEFAULT_BUSINESS_IDENTITY, onSave, onEditorStateChange: report };
    let tree = render(OwnerBusinessIdentityPanel, props);
    const field = nodes(tree).find((node) => node.props.label === 'Brand name')!;
    (field.props.onChange as (value: string) => void)('My draft brand');
    tree = render(OwnerBusinessIdentityPanel, { ...props, businessIdentity: { ...DEFAULT_BUSINESS_IDENTITY, identityVersion: 8, brandName: 'Other edit' } });
    expect(report).toHaveBeenLastCalledWith({ dirty: true, saving: false });
    expect(nodes(tree).find((node) => node.props.label === 'Brand name')!.props.value).toBe('My draft brand');
    await click(button(tree, 'Save business identity'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ brandName: 'My draft brand' }), DEFAULT_BUSINESS_IDENTITY.identityVersion);
    render(OwnerBusinessIdentityPanel, { ...props, businessIdentity: saved });
    expect(report).toHaveBeenLastCalledWith({ dirty: false, saving: false });
  });

  it('preserves Founder draft text when another domain updates the operations payload', () => {
    const report = vi.fn();
    const props = { operationsPayload: { founderProfile: DEFAULT_FOUNDER_PROFILE }, onOperationsChange: vi.fn(), onEditorStateChange: report };
    let tree = render(OwnerFounderProfilePanel, props);
    const field = nodes(tree).find((node) => node.props.label === 'Hero headline')!;
    (field.props.onChange as (value: string) => void)('Unpublished story');
    const refreshed = { ...props, operationsPayload: { founderProfile: { ...DEFAULT_FOUNDER_PROFILE, updatedAt: 'New revision' } } };
    render(OwnerFounderProfilePanel, refreshed);
    tree = render(OwnerFounderProfilePanel, refreshed);
    expect(nodes(tree).find((node) => node.props.label === 'Hero headline')!.props.value).toBe('Unpublished story');
    expect(report).toHaveBeenLastCalledWith({ dirty: true, saving: false });
  });

  it('reports Experience edits and disables controls during publication', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ templates: { defaults: [] } }))));
    const report = vi.fn();
    const props = { settings: DEFAULT_EXPERIENCE_SETTINGS, onSettingsChange: vi.fn(), onEditorStateChange: report };
    let tree = render(OwnerExperienceControlsPanel, props);
    input(nodes(tree).find((node) => node.type === 'select' && node.props.value === 'standard')!, 'high');
    tree = render(OwnerExperienceControlsPanel, props);
    expect(report).toHaveBeenLastCalledWith({ dirty: true, saving: false });
    let rejectSave!: (error: Error) => void;
    vi.stubGlobal('fetch', vi.fn((url: string) => url === '/api/catalog/studio-bootstrap'
      ? Promise.resolve(new Response(JSON.stringify({ templates: { defaults: [] } })))
      : new Promise((_resolve, reject) => { rejectSave = reject; }))); 
    const pending = click(button(tree, 'Save experience controls'));
    tree = render(OwnerExperienceControlsPanel, props);
    expect(report).toHaveBeenLastCalledWith({ dirty: true, saving: true });
    expect(nodes(tree).filter((node) => node.type === 'fieldset').every((node) => node.props.disabled)).toBe(true);
    rejectSave(new Error('Unavailable'));
    await pending;
  });
});
