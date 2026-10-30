import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicSiteConfiguration } from '@/features/public-site/model/siteConfiguration';
import type { PublicSitePage } from '@/features/public-site/model/sitePages';

vi.mock('server-only', () => ({}));
vi.mock('@/features/legal/server', () => ({ publishLegalDocument: vi.fn(), revalidateLegalDocumentCache: vi.fn() }));
vi.mock('@/features/roadmap/server', () => ({ updateRoadmapSettings: vi.fn(), updateRoadmapAdminItemStatus: vi.fn(), saveWebsiteRelease:vi.fn() }));
vi.mock('@/features/business-identity/server', () => ({ updateBusinessIdentity: vi.fn(), revalidatePublicIdentityCache: vi.fn() }));
vi.mock('@/features/experience-settings/server', () => ({ updateExperienceSettings: vi.fn(), revalidateExperienceSettingsCache: vi.fn() }));

const state = vi.hoisted(() => ({
  failTag: false,
  failPath: false,
  activityRecorded: true,
  content: {
    slug: 'landing.hero.headline',
    body: 'Published copy',
    updatedAt: '2026-10-08T00:00:00.000Z',
    group: 'landing',
    section: 'Hero',
    label: 'Headline',
    kind: 'short',
    maxLength: 180,
  },
  configuration: {
    updatedAt: '2026-10-08T00:00:00.000Z',
    announcementEnabled: false,
    announcementMessage: '',
    primaryCtaLabel: 'Open your Desk',
    primaryCtaHref: '/account',
    supportOfferVisible: true,
    homepageTitle: 'Build Complete Card Sets',
    homepageDescription: 'Fixture',
    searchKeywords: ['cards'],
    watermarkPreviewOpacity: 20,
    watermarkShareOpacity: 20,
    watermarkWidthPercent: 60,
    primaryNavigation: [
      { id: 'about', label: 'About', href: '/about', visible: true },
      { id: 'plans', label: 'Plans', href: '/plans', visible: true },
      { id: 'roadmap', label: 'Roadmap', href: '/roadmap', visible: true },
      { id: 'account', label: 'Desk', href: '/account', visible: true },
    ],
    homepageSections: [
      { id: 'showcase', visible: true, showcaseExamples: [] },
      { id: 'workflow', visible: true },
      { id: 'access', visible: true },
      { id: 'founder', visible: true },
      { id: 'final_cta', visible: true },
    ],
  } as PublicSiteConfiguration,
  updateContent: vi.fn(),
  updateConfiguration: vi.fn(),
  revalidateContent: vi.fn(),
  revalidateConfiguration: vi.fn(),
  revalidatePath: vi.fn(),
  recordActivity: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => {
    state.revalidatePath(...args);
    if (state.failPath) throw new Error('path refresh failed');
  },
}));

vi.mock('@/features/public-site/server', () => ({
  getPublicSiteConfiguration: async () => state.configuration,
  PublicSiteConfigurationStoreError: class extends Error {},
  updateFounderProfile: vi.fn(), revalidateFounderProfile: vi.fn(),
  publishSiteContentBlockRevision: async (...args: unknown[]) => {
    state.updateContent(...args);
    return state.content;
  },
  updatePublicSiteConfiguration: async (...args: unknown[]) => {
    state.updateConfiguration(...args);
    return state.configuration;
  },
  updatePublicSiteVisibleField: async (...args: unknown[]) => {
    state.updateConfiguration(...args);
    return state.configuration;
  },
  revalidateSiteContentCache: () => {
    state.revalidateContent();
    if (state.failTag) throw new Error('content refresh failed');
  },
  revalidatePublicSiteConfiguration: () => {
    state.revalidateConfiguration();
    if (state.failTag) throw new Error('configuration refresh failed');
  },
}));

vi.mock('@/features/owner/server/ownerActivityStore', () => ({
  recordOwnerActivity: async (...args: unknown[]) => {
    state.recordActivity(...args);
    return state.activityRecorded;
  },
}));

import {
  publishOwnerSiteConfiguration,
  publishOwnerSiteConfigurationField,
  publishOwnerSiteConfigurationPatch,
  publishOwnerSiteContentBlock,
  publishOwnerSitePage,
} from '@/features/owner/server/ownerSiteCommands';

beforeEach(() => {
  vi.clearAllMocks();
  state.failTag = false;
  state.failPath = false;
  state.activityRecorded = true;
  state.configuration.pages = [];
});

describe('Owner site commands', () => {
  it('merges a bounded settings patch while preserving untouched settings and the initiating revision', async () => {
    await publishOwnerSiteConfigurationPatch({ actor: { userId: 'owner', email: null },
      patch: { homepageTitle: 'New title' }, expectedUpdatedAt: '2026-10-07T00:00:00Z' });
    expect(state.updateConfiguration).toHaveBeenCalledExactlyOnceWith({ ...state.configuration,
      homepageTitle: 'New title', updatedAt: '2026-10-07T00:00:00Z' });
  });
  it.each([{ updatedAt: 'fake' }, { stripePrice: 1 }, {}])('rejects non-presentation patch %j without writing', async (patch) => {
    await expect(publishOwnerSiteConfigurationPatch({ actor: { userId: 'owner', email: null }, patch,
      expectedUpdatedAt: state.configuration.updatedAt! })).rejects.toThrow();
    expect(state.updateConfiguration).not.toHaveBeenCalled();
  });
  it('returns a committed live-copy receipt without rereading provider state', async () => {
    const result = await publishOwnerSiteContentBlock({
      actor: { userId: 'owner-1', email: 'owner@example.com' },
      input: {
        slug: state.content.slug,
        body: 'Published copy',
        expectedUpdatedAt: '2026-10-07T23:59:00.000Z',
      },
    });

    expect(result.siteContentBlock).toEqual(state.content);
    expect(result.receipt).toMatchObject({
      committed: true,
      refreshComplete: true,
      refreshFailures: [],
      activityRecorded: true,
      retryable: false,
      nextAction: 'none',
    });
    expect(state.updateContent).toHaveBeenCalledWith({
      slug: state.content.slug,
      body: 'Published copy',
      expectedUpdatedAt: '2026-10-07T23:59:00.000Z',
    });
    expect(state.revalidateContent).toHaveBeenCalledOnce();
    expect(state.recordActivity).toHaveBeenCalledWith(expect.objectContaining({
      action: 'site.copy.publish',
      targetId: state.content.slug,
    }));
  });

  it('keeps a committed copy publish non-retryable when cache/path refresh fails', async () => {
    state.failTag = true;
    state.failPath = true;

    const result = await publishOwnerSiteContentBlock({
      actor: { userId: 'owner-1', email: null },
      input: {
        slug: state.content.slug,
        body: 'Published copy',
        expectedUpdatedAt: '2026-10-07T23:59:00.000Z',
      },
    });

    expect(result.receipt).toMatchObject({
      committed: true,
      refreshComplete: false,
      retryable: false,
      nextAction: 'reload',
    });
    expect(result.receipt.refreshFailures).toEqual(['site-content-cache', 'public-layout']);
    expect(result.receipt.message).toMatch(/was published.*reload/i);
    expect(state.recordActivity).toHaveBeenCalledWith(expect.objectContaining({
      metadata: {
        expectedUpdatedAt: '2026-10-07T23:59:00.000Z',
        committedUpdatedAt: state.content.updatedAt,
        refreshComplete: false,
        refreshFailures: ['site-content-cache', 'public-layout'],
      },
    }));
  });

  it('publishes site configuration through the same receipt contract', async () => {
    state.activityRecorded = false;

    const result = await publishOwnerSiteConfiguration({
      actor: { userId: 'owner-1', email: 'owner@example.com' },
      input: { ...state.configuration },
    });

    expect(result.settings).toEqual(state.configuration);
    expect(result.receipt).toMatchObject({
      committed: true,
      refreshComplete: true,
      activityRecorded: false,
      retryable: false,
      nextAction: 'none',
    });
    expect(state.updateConfiguration).toHaveBeenCalledOnce();
    expect(state.revalidateConfiguration).toHaveBeenCalledOnce();
    expect(state.revalidatePath).toHaveBeenCalledWith('/[slug]', 'page');
    expect(state.revalidatePath).toHaveBeenCalledWith('/sitemap.xml');
  });
  it('publishes a visible Owner label through the original settings authority and receipt', async () => {
    const input = { field: 'navigationLabel' as const, navigationId: 'plans', value: 'Membership', expectedUpdatedAt: state.configuration.updatedAt! };
    const result = await publishOwnerSiteConfigurationField({
      actor: { userId: 'owner-1', email: 'owner@example.com' },
      input,
    });
    expect(result.settings).toEqual(state.configuration);
    expect(result.receipt).toMatchObject({ committed: true, retryable: false });
    expect(state.updateConfiguration).toHaveBeenCalledWith(input);
    expect(state.recordActivity).toHaveBeenCalledWith(expect.objectContaining({
      action: 'site.configuration.update',
      metadata: expect.objectContaining({ updatedField: 'navigation.plans' }),
    }));
  });

});

describe('focused first-party page publication', () => {
  const page: PublicSitePage = { id: 'page-guide', slug: 'guide', title: 'Guide',
    description: 'A complete guide to creating and exporting your first card Set.', keywords: ['guide'], published: false,
    sections: [{ id: 'custom-guide', kind: 'custom', visible: true, design: { layout: 'stack', tone: 'raised', spacing: 'balanced', align: 'start' },
      blocks: [{ id: 'block-guide', kind: 'heading', text: 'Welcome' }] }],
  };
  it('preserves the homepage, unrelated settings and other pages when saving one page', async () => {
    const sibling = { ...page, id: 'page-sibling' as const, slug: 'sibling', title: 'Sibling' };
    state.configuration.pages = [sibling];
    await publishOwnerSitePage({ actor: { userId: 'owner', email: null }, pageId: page.id, page, expectedUpdatedAt: 'initiating-revision' });
    expect(state.updateConfiguration).toHaveBeenCalledExactlyOnceWith({ ...state.configuration, pages: [sibling, page], updatedAt: 'initiating-revision' });
  });
  it('removes only the selected page and its native navigation projection', async () => {
    state.configuration.pages = [page];
    state.configuration.primaryNavigation.push({ id: page.id, href: '/guide', label: 'Guide', visible: true });
    const untouched = state.configuration.primaryNavigation.filter((item) => item.id !== page.id);
    await publishOwnerSitePage({ actor: { userId: 'owner', email: null }, pageId: page.id, page: null, expectedUpdatedAt: 'initiating-revision' });
    expect(state.updateConfiguration).toHaveBeenCalledExactlyOnceWith({ ...state.configuration, pages: [], primaryNavigation: untouched, updatedAt: 'initiating-revision' });
    state.configuration.primaryNavigation = untouched;
  });
});


it('reports a working note save as committed and unreleased, including refresh warnings',async()=>{
 const native=vi.mocked((await import('@/features/roadmap/server')).saveWebsiteRelease);
 native.mockResolvedValue({id:'release-row',version:'0.0.1',notes:{improvements:[],fixes:[],knownLimits:[]},sourceSha:null,candidateSha:null,shippedAt:null,updatedAt:'2026-10-30T00:00:00Z',mutationKind:'working-saved'});
 state.failPath=true;
 const result=await (await import('@/features/owner/server/ownerSiteCommands')).publishOwnerWebsiteRelease({actor:{userId:'owner',email:null},input:{version:'0.0.1'}});
 expect(result.receipt).toMatchObject({committed:true,refreshComplete:false,retryable:false,nextAction:'reload'});
 expect(result.receipt.message).toContain('remains unreleased');
 expect(result.receipt.message).not.toContain('was published');
 expect(native).toHaveBeenCalledWith({version:'0.0.1'},'owner');
});
