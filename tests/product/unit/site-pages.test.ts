import { describe, expect, it } from 'vitest';
import { DEFAULT_PUBLIC_SITE_CONFIGURATION, getPublicHeaderPresentation, hydratePublicSiteConfiguration, normalizePublicSiteConfigurationInput, projectPublicSiteConfiguration } from '@/features/public-site/model/siteConfiguration';
import { RESERVED_SITE_PAGE_SLUGS, validatePublicSitePages, type PublicSitePage } from '@/features/public-site/model/sitePages';

const page = (patch: Partial<PublicSitePage> = {}): PublicSitePage => ({
  id: 'page-guide', slug: 'getting-started', title: 'Getting started',
  description: 'A complete introduction to creating and exporting your first set of cards.',
  keywords: ['cards'], published: false,
  sections: [{ id: 'custom-guide', kind: 'custom', visible: true,
    design: { layout: 'split', tone: 'charcoal', spacing: 'balanced', align: 'start' },
    blocks: [{ id: 'block-intro', kind: 'heading', text: 'Start here' },
      { id: 'block-action', kind: 'button', text: 'Open Desk', href: '/account' }] }], ...patch,
});
const configure = (pages: PublicSitePage[]) => normalizePublicSiteConfigurationInput({
  ...DEFAULT_PUBLIC_SITE_CONFIGURATION, pages,
  primaryNavigation: [...DEFAULT_PUBLIC_SITE_CONFIGURATION.primaryNavigation,
    ...pages.map((item) => ({ id: item.id, label: item.title, href: '/ignored-input', visible: true }))],
});

describe('first-party site pages', () => {
  it('preserves legacy presentation and places the newly selectable hero in its existing position', () => {
    const legacy = hydratePublicSiteConfiguration({ homepage_sections: [{ id: 'workflow', visible: false }, { id: 'showcase', visible: true }] });
    expect(legacy.pages).toEqual([]);
    expect(legacy.homepageSections.map((item) => item.id).slice(0, 3)).toEqual(['hero', 'workflow', 'showcase']);
    expect(legacy.homepageSections.find((item) => item.id === 'workflow')?.visible).toBe(false);
  });

  it('never projects unpublished authored content or navigation into public client props', () => {
    const settings = configure([page()]);
    expect(settings.pages?.[0]?.published).toBe(false);
    expect(settings.primaryNavigation.at(-1)?.visible).toBe(true);
    expect(getPublicHeaderPresentation(settings).visibleNavigation.map((item) => item.id)).not.toContain('page-guide');
    const publicValue = projectPublicSiteConfiguration(settings);
    expect(publicValue.pages).toEqual([]);
    expect(JSON.stringify(publicValue)).not.toContain('Start here');
    expect(publicValue.primaryNavigation.map((item) => item.id)).not.toContain('page-guide');
    expect(settings.pages?.[0]?.sections[0]?.blocks[0]?.text).toBe('Start here');
  });

  it('binds public navigation to the exact stable page identity and current slug, not a caller-supplied URL', () => {
    const settings = configure([page({ published: true, slug: 'card-guide' })]);
    expect(getPublicHeaderPresentation(settings).visibleNavigation.at(-1)).toMatchObject({ id: 'page-guide', href: '/card-guide' });
    expect(projectPublicSiteConfiguration(settings).pages).toEqual(settings.pages);
    expect(hydratePublicSiteConfiguration({ site_pages: settings.pages, primary_navigation: settings.primaryNavigation }).pages).toEqual(settings.pages);
  });

  it.each([...RESERVED_SITE_PAGE_SLUGS, '../account', 'api/x', '//other', 'UPPER', 'bad%2fpath'])('refuses reserved or unsafe page route %s', (slug) => {
    expect(() => validatePublicSitePages([page({ slug })])).toThrow();
  });

  it('rejects duplicate identities, duplicate paths, dangling navigation, corrupt stored content and executable blocks rather than dropping authored data', () => {
    expect(() => validatePublicSitePages([page(), page({ slug: 'other' })])).toThrow();
    expect(() => validatePublicSitePages([page(), page({ id: 'page-other' })])).toThrow();
    expect(() => hydratePublicSiteConfiguration({ site_pages: [{ id: 'page-broken' }] })).toThrow();
    expect(() => normalizePublicSiteConfigurationInput({ ...configure([]), primaryNavigation: [{ id: 'page-missing', label: 'Missing', href: '/account', visible: true }] })).toThrow(/Navigation/);
    const bad = page();
    (bad.sections[0]!.blocks[0] as unknown as Record<string, unknown>).kind = 'html';
    expect(() => validatePublicSitePages([bad])).toThrow();
  });

  it('uses the canonical trusted vocabulary, safe links and public media without arbitrary style or renderer payloads', () => {
    const bad = page();
    bad.sections[0]!.blocks.push({ id: 'block-external', kind: 'button', text: 'Unsafe', href: 'javascript:alert(1)' });
    expect(() => validatePublicSitePages([bad])).toThrow();
    const styled = page();
    Object.assign(styled.sections[0]!.design, { css: 'position:fixed' });
    expect(() => validatePublicSitePages([styled])).toThrow();
  });
});

describe('cross-client website settings budget', () => {
  const populated = (name: string): PublicSitePage => page({ id: `page-${name}`, slug: name,
    sections: Array.from({ length: 12 }, (_, section) => ({
      id: `custom-${name}-${section}`, kind: 'custom', visible: true,
      design: { layout: 'stack', tone: 'raised', spacing: 'balanced', align: 'start' },
      blocks: Array.from({ length: 12 }, (_, block) => ({ id: `block-${name}-${section}-${block}`, kind: 'text', text: 'x'.repeat(1500) })),
    })),
  });
  it('rejects an aggregate MCP state that would make browser read/edit/save impossible even when every individual block is valid', () => {
    const pages = [populated('one'), populated('two')];
    expect(validatePublicSitePages(pages)).toHaveLength(2);
    expect(() => configure(pages)).toThrow(/editable-content budget/);
  });
  it('keeps valid near-budget canonical readback editable through the native browser body boundary', async () => {
    const { parseJsonBodyWithLimit } = await import('@/infrastructure/http/apiValidation');
    const content = populated('one');
    const settings = configure([content]);
    const readback = { ...settings, updatedAt: '2026-10-17T09:22:00.123456+00:00' };
    const request = new Request('https://preview.example/api/owner/site-configuration', { method: 'PUT', body: JSON.stringify(readback) });
    expect((await parseJsonBodyWithLimit(request)).ok).toBe(true);
    expect(() => normalizePublicSiteConfigurationInput(readback)).not.toThrow();
    expect(settings.pages?.[0]?.sections[0]?.blocks[0]?.text).toHaveLength(1500);
  });
});
