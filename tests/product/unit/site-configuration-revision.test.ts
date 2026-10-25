import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_PUBLIC_SITE_CONFIGURATION, hydratePublicSiteConfiguration, MAX_SITE_CONFIGURATION_BYTES } from '@/features/public-site/model/siteConfiguration';
import {
  getPublicSiteConfiguration,
  updatePublicSiteConfiguration,
  updatePublicSiteVisibleField,
} from '@/features/public-site/server/siteConfigurationStore';

const rev1 = '2026-10-09T07:00:00.123456+00:00';
const rev2 = '2026-10-09T07:01:00.234567+00:00';

const db = vi.hoisted(() => ({
  row: {} as Record<string, unknown>,
  previousUpdate: null as Record<string, unknown> | null,
  updates: 0,
  calls: 0,
}));

vi.mock('@/infrastructure/database/supabaseServer', () => ({
  getSupabaseServerConfigStatus: () => ({ configured: true }),
  getSupabaseServerClient: () => ({
    from: (name: string) => {
      if (name !== 'cardforge_owner_settings') throw new Error('Wrong table');
      db.calls++;
      let mutation: Record<string, unknown> | null = null;
      const filters = new Map<string, unknown>();
      type Query = {
        select: (fields: string) => Query;
        update: (patch: Record<string, unknown>) => Query;
        eq: (field: string, value: unknown) => Query;
        limit: (count: number) => Promise<{ data: Record<string, unknown>[]; error: null }>;
      };
      const query: Query = {
        select: (_fields: string) => query,
        update: (patch: Record<string, unknown>) => { mutation = patch; return query; },
        eq: (field: string, value: unknown) => { filters.set(field, value); return query; },
        limit: async (_count: number) => {
          if (mutation) {
            if (filters.get('id') !== db.row.id || filters.get('updated_at') !== db.row.updated_at) {
              return { data: [], error: null };
            }
            db.previousUpdate = { ...mutation };
            db.updates++;
            db.row = { ...db.row, ...mutation, updated_at: rev2 };
            return { data: [{ ...db.row }], error: null };
          }
          return { data: filters.get('id') === db.row.id ? [{ ...db.row }] : [], error: null };
        },
      };
      return query;
    },
  }),
}));

const sampleRow = (): Record<string, unknown> => ({
  id: 'cardforge',
  updated_at: rev1,
  announcement_enabled: false,
  announcement_message: '',
  primary_cta_label: 'Open your Desk',
  primary_cta_href: '/account',
  support_offer_visible: true,
  homepage_title: 'Build Complete Card Sets',
  homepage_description: 'A coherent original suite of browser card design tools and complete Sets.',
  search_keywords: ['card design'],
  watermark_preview_opacity: 24,
  watermark_share_opacity: 28,
  watermark_width_percent: 68,
  primary_navigation: [
    { id: 'about', label: 'About', href: '/about', visible: true },
    { id: 'plans', label: 'Plans', href: '/plans', visible: true },
    { id: 'roadmap', label: 'Roadmap', href: '/roadmap', visible: false },
  ],
  homepage_sections: [{ id: 'showcase', visible: true }],
});

beforeEach(() => {
  db.row = sampleRow();
  db.previousUpdate = null;
  db.updates = 0;
  db.calls = 0;
});

describe('exact-revision canonical Owner site configuration', () => {
  it('projects the authoritative settings revision without treating it as an editable field', async () => {
    expect((await getPublicSiteConfiguration()).updatedAt).toBe(rev1);
    expect(db.row.updated_at).toBe(rev1);
  });

  it('writes only the selected CTA column and returns the committed revision', async () => {
    const result = await updatePublicSiteVisibleField({
      field: 'primaryCtaLabel', value: 'Create a Set', expectedUpdatedAt: rev1,
    });
    expect(result.primaryCtaLabel).toBe('Create a Set');
    expect(result.updatedAt).toBe(rev2);
    expect(db.previousUpdate).toEqual({ primary_cta_label: 'Create a Set' });
    expect(db.row.primary_cta_href).toBe('/account');
    expect(db.updates).toBe(1);
  });

  it('rejects stale focused and full-form writes without mutating the current settings', async () => {
    db.row.updated_at = rev2;
    const current = structuredClone(db.row);
    await expect(updatePublicSiteVisibleField({
      field: 'primaryCtaLabel', value: 'Stale', expectedUpdatedAt: rev1,
    })).rejects.toMatchObject({ status: 409 });
    const whole = { ...DEFAULT_PUBLIC_SITE_CONFIGURATION, homepageSections: undefined, updatedAt: rev1 };
    await expect(updatePublicSiteConfiguration(whole)).rejects.toMatchObject({ status: 409 });
    expect(db.row).toEqual(current);
    expect(db.updates).toBe(0);
  });

  it('preserves existing navigation order, routes, visibility and sibling labels', async () => {
    const before = structuredClone(db.row.primary_navigation);
    const updated = await updatePublicSiteVisibleField({
      field: 'navigationLabel', navigationId: 'plans', value: 'Membership', expectedUpdatedAt: rev1,
    });
    expect(updated.updatedAt).toBe(rev2);
    const expected = (before as Array<Record<string, unknown>>).map((item) =>
      item.id === 'plans' ? { ...item, label: 'Membership' } : item);
    expect(db.previousUpdate).toEqual({ primary_navigation: expected });
    expect(db.row.primary_navigation).toEqual(expected);
    expect(db.row.primary_cta_href).toBe('/account');
  });

  it('allows announcement text to be cleared without enabling it or changing other settings', async () => {
    db.row.announcement_message = 'Temporary announcement';
    const before = structuredClone(db.row);
    const result = await updatePublicSiteVisibleField({ field: 'announcementMessage', value: ' ', expectedUpdatedAt: rev1 });
    expect(result.announcementMessage).toBe('');
    expect(result.announcementEnabled).toBe(false);
    expect(db.previousUpdate).toEqual({ announcement_message: '' });
    expect(db.row).toEqual({ ...before, announcement_message: '', updated_at: rev2 });
  });

  it('edits a navigation item supplied by the canonical default projection without replacing existing authored items', async () => {
    db.row.primary_navigation = (db.row.primary_navigation as Array<Record<string, unknown>>).filter((item) => item.id !== 'plans');
    const before = structuredClone(db.row.primary_navigation);
    const projected = (await getPublicSiteConfiguration()).primaryNavigation.find((item) => item.id === 'plans')!;
    const displayed = (await getPublicSiteConfiguration()).primaryNavigation;
    expect(projected.label).toBe('Plans');
    const result = await updatePublicSiteVisibleField({ field: 'navigationLabel', navigationId: 'plans', value: 'Membership', expectedUpdatedAt: rev1 });
    expect(result.primaryNavigation.find((item) => item.id === 'plans')?.label).toBe('Membership');
    const existingIds = new Set((before as Array<Record<string, unknown>>).map((item) => item.id));
    expect(db.row.primary_navigation).toEqual([...(before as unknown[]), ...displayed.filter((item) => !existingIds.has(item.id)).map((item) => item.id === 'plans' ? { ...item, label: 'Membership' } : item)]);
    expect(db.previousUpdate).toEqual({ primary_navigation: db.row.primary_navigation });
    expect(db.row.primary_cta_href).toBe('/account');
  });

  it.each(['plans', 'roadmap', 'account'])('preserves effective order when editing projected %s with multiple missing items', async (navigationId) => {
    const authored = { id: 'about', label: 'Our story', href: '/about', visible: false, provenance: 'preserve-me' };
    db.row.primary_navigation = [authored];
    const before = (await getPublicSiteConfiguration()).primaryNavigation;
    const result = await updatePublicSiteVisibleField({ field: 'navigationLabel', navigationId, value: 'New label', expectedUpdatedAt: rev1 });
    expect(result.primaryNavigation).toEqual(before.map((item) => item.id === navigationId ? { ...item, label: 'New label' } : item));
    expect((db.row.primary_navigation as unknown[])[0]).toEqual(authored);
    expect(db.row.announcement_enabled).toBe(false);
    expect(db.updates).toBe(1);
  });

  it('refuses missing revisions, unsupported navigation ids, blank and overlong labels', async () => {
    await expect(updatePublicSiteVisibleField({
      field: 'primaryCtaLabel', value: 'Create', expectedUpdatedAt: null,
    })).rejects.toMatchObject({ status: 409 });
    await expect(updatePublicSiteVisibleField({
      field: 'navigationLabel', navigationId: 'billing', value: 'Billing', expectedUpdatedAt: rev1,
    })).rejects.toMatchObject({ status: 400 });
    await expect(updatePublicSiteVisibleField({
      field: 'primaryCtaLabel', value: ' ', expectedUpdatedAt: rev1,
    })).rejects.toMatchObject({ status: 400 });
    await expect(updatePublicSiteVisibleField({
      field: 'primaryCtaLabel', value: 'x'.repeat(81), expectedUpdatedAt: rev1,
    })).rejects.toMatchObject({ status: 400 });
    expect(db.updates).toBe(0);
  });

  it('prevents silent creation when the Owner settings row is absent', async () => {
    db.row.id = 'another-site';
    await expect(updatePublicSiteVisibleField({
      field: 'primaryCtaLabel', value: 'Create', expectedUpdatedAt: rev1,
    })).rejects.toMatchObject({ status: 409 });
    expect(db.updates).toBe(0);
  });
});


describe('aggregate canonical publication safety', () => {
  const section = (name: string) => ({ id: `custom-${name}`, kind: 'custom', visible: true,
    design: { layout: 'stack', tone: 'raised', spacing: 'balanced', align: 'start' },
    blocks: Array.from({ length: 12 }, (_, index) => ({ id: `block-${name}-${index}`, kind: 'text', text: 'x'.repeat(1500) })),
  });
  const page = (name: string, count: number) => ({ id: `page-${name}`, slug: name, title: 'A page',
    description: 'A complete guide to creating and exporting a first card Set.', keywords: ['guide'], published: false,
    sections: Array.from({ length: count }, (_, index) => section(`${name}-${index}`)),
  });
  it('rejects explicit null rather than deleting stored pages', async () => {
    db.row.site_pages = [page('preserve', 1)];
    const before = structuredClone(db.row);
    await expect(updatePublicSiteConfiguration({ ...DEFAULT_PUBLIC_SITE_CONFIGURATION, pages: null, updatedAt: rev1 })).rejects.toMatchObject({ status: 400 });
    expect(db.row).toEqual(before); expect(db.updates).toBe(0);
  });
  it('checks the actual merged persisted candidate for a legacy form that omits pages', async () => {
    db.row.site_pages = [page('preserve', 12)];
    const before = structuredClone(db.row);
    const legacy = { ...DEFAULT_PUBLIC_SITE_CONFIGURATION, updatedAt: rev1, pages: undefined,
      homepageSections: [...DEFAULT_PUBLIC_SITE_CONFIGURATION.homepageSections, ...Array.from({ length: 12 }, (_, index) => section(`legacy-${index}`))],
    };
    delete legacy.pages;
    await expect(updatePublicSiteConfiguration(legacy)).rejects.toMatchObject({ status: 400, message: expect.stringContaining('editable-content budget') });
    expect(db.row).toEqual(before); expect(db.updates).toBe(0);
  });
  it('applies the same post-merge budget to focused inline edits without losing authored content', async () => {
    const pages = [page('large', 12), page('tail', 1)];
    db.row.site_pages = pages;
    const size = () => new TextEncoder().encode(JSON.stringify({ ...hydratePublicSiteConfiguration(db.row), updatedAt: null })).length;
    const blocks = pages[1]!.sections[0]!.blocks;
    while (size() > MAX_SITE_CONFIGURATION_BYTES - 20) {
      const last = blocks.at(-1)!;
      const remove = Math.min(last.text.length - 1, size() - (MAX_SITE_CONFIGURATION_BYTES - 20));
      if (remove) last.text = last.text.slice(0, -remove);
      else blocks.pop();
    }
    const before = structuredClone(db.row);
    await expect(updatePublicSiteVisibleField({ field: 'primaryCtaLabel', value: 'x'.repeat(80), expectedUpdatedAt: rev1 })).rejects.toMatchObject({ status: 400, message: expect.stringContaining('editable-content budget') });
    expect(db.row).toEqual(before); expect(db.updates).toBe(0);
  });
});
