import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  allowed: true,
  access: vi.fn(),
  content: vi.fn(),
  media: vi.fn(),
  configuration: vi.fn(),
  roadmap: vi.fn(),
  broadOwnerPayload: vi.fn(),
}));

vi.mock('@/features/owner/server', () => ({
  getCurrentOwnerAccess: async () => {
    state.access();
    return { isOwner: state.allowed, userId: state.allowed ? 'owner-fixture' : null };
  },
  // Old full-domain call must never occur during ordinary page editing.
  getOwnerSiteOperationsPayload: () => state.broadOwnerPayload(),
}));
vi.mock('@/features/owner/client', () => ({
  OwnerPublicSiteOperations: () => null,
}));
vi.mock('@/features/public-site/client', () => ({
  PublicSiteOwnerLiveControls: () => null,
}));
vi.mock('@/features/public-site/server', () => ({
  getPublicSiteConfiguration: async () => { state.configuration(); return { primaryCtaLabel: 'Open your Desk' }; },
  getSiteContentBlocks: async () => { state.content(); return [{ slug: 'landing.hero.headline', body: 'Build a Set' }]; },
  getSiteMedia: async () => { state.media(); return [{ slot: 'landing.hero' }]; },
  resolveOwnerPublicationEnvironment: () => 'preview',
}));
vi.mock('@/features/roadmap/server', () => ({
  getRoadmapSettings: async () => { state.roadmap(); return { published: true }; },
}));
vi.mock('@/app/_components/OwnerRoadmapRulesLiveEditor', () => ({
  OwnerRoadmapRulesLiveEditor: () => null,
}));

import { OwnerPublicSiteControlsSlot } from '@/app/_components/OwnerPublicSiteControlsSlot';

beforeEach(() => {
  state.allowed = true;
  vi.clearAllMocks();
});

describe('public-page Owner editing read boundary', () => {
  it('denies unsigned or ordinary visitors before querying private Owner content', async () => {
    state.allowed = false;
    expect(await OwnerPublicSiteControlsSlot({ currentPath: '/' })).toBeNull();
    expect(state.access).toHaveBeenCalledOnce();
    expect(state.content).not.toHaveBeenCalled();
    expect(state.media).not.toHaveBeenCalled();
    expect(state.configuration).not.toHaveBeenCalled();
    expect(state.roadmap).not.toHaveBeenCalled();
  });

  it('reads just the three canonical page-editing owners on a normal public page', async () => {
    const node = await OwnerPublicSiteControlsSlot({ currentPath: '/' });
    expect(node).not.toBeNull();
    expect(node?.props.initialBlocks).toEqual([{ slug: 'landing.hero.headline', body: 'Build a Set' }]);
    expect(node?.props.initialMedia).toEqual([{ slot: 'landing.hero' }]);
    expect(node?.props.initialSiteConfiguration).toEqual({ primaryCtaLabel: 'Open your Desk' });
    expect(node?.props.publicationEnvironment).toBe('preview');
    expect(state.content).toHaveBeenCalledOnce();
    expect(state.media).toHaveBeenCalledOnce();
    expect(state.configuration).toHaveBeenCalledOnce();
    expect(state.roadmap).not.toHaveBeenCalled();
    expect(state.broadOwnerPayload).not.toHaveBeenCalled();
  });

  it('loads Roadmap rules only in Roadmap context, without fetching broad Owner governance', async () => {
    const node = await OwnerPublicSiteControlsSlot({ currentPath: '/roadmap' });
    expect(node?.props.roadmapRulesEditor).toBeDefined();
    expect(state.roadmap).toHaveBeenCalledOnce();
    expect(state.broadOwnerPayload).not.toHaveBeenCalled();
  });
});
