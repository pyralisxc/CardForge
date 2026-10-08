import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

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
  },
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
  publishSiteContentBlockRevision: async (...args: unknown[]) => {
    state.updateContent(...args);
    return state.content;
  },
  publishPublicSiteConfigurationRevision: async (...args: unknown[]) => {
    state.updateConfiguration(...args);
    return {
      settings: state.configuration,
      updatedAt: '2026-10-08T00:01:00.000Z',
    };
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
  publishOwnerSiteContentBlock,
} from '@/features/owner/server/ownerSiteCommands';

beforeEach(() => {
  vi.clearAllMocks();
  state.failTag = false;
  state.failPath = false;
  state.activityRecorded = true;
});

describe('Owner site commands', () => {
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
      input: state.configuration,
      expectedUpdatedAt: '2026-10-08T00:00:00.000Z',
    });

    expect(result.settings).toEqual(state.configuration);
    expect(result.updatedAt).toBe('2026-10-08T00:01:00.000Z');
    expect(result.receipt).toMatchObject({
      committed: true,
      refreshComplete: true,
      activityRecorded: false,
      retryable: false,
      nextAction: 'none',
    });
    expect(state.updateConfiguration).toHaveBeenCalledWith(
      state.configuration,
      '2026-10-08T00:00:00.000Z',
    );
    expect(state.revalidateConfiguration).toHaveBeenCalledOnce();
    expect(state.revalidatePath).toHaveBeenCalledTimes(4);
  });
});