import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_PUBLIC_SITE_CONFIGURATION } from '@/features/public-site/model/siteConfiguration';
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
      const query = {
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

  it('refuses missing revisions, unsupported navigation ids, blank and overlong labels', async () => {
    await expect(updatePublicSiteVisibleField({
      field: 'primaryCtaLabel', value: 'Create', expectedUpdatedAt: null,
    })).rejects.toMatchObject({ status: 409 });
    await expect(updatePublicSiteVisibleField({
      field: 'navigationLabel', navigationId: 'billing', value: 'Billing', expectedUpdatedAt: rev1,
    })).rejects.toMatchObject({ status: 400 });
    await expect(updatePublicSiteVisibleField({
      field: 'announcementMessage', value: ' ', expectedUpdatedAt: rev1,
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
