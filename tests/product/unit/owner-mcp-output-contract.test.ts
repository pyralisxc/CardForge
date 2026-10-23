import type { StandardSchemaV1 } from '@modelcontextprotocol/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_PUBLIC_SITE_CONFIGURATION } from '@/features/public-site/model/siteConfiguration';
import { createSiteContentMap, DEFAULT_SITE_CONTENT_BLOCKS } from '@/features/public-site/model/siteContent';
import { describeAgentBoundaryFailure } from '@/shared/boundaryFailure';
import { getBillingConfigStatus } from '@/features/billing/lib/billing';
import type { McpOwnerAccess } from '@/features/owner/server/mcpOwnerAccess';
import { registerOwnerReadTools } from '@/features/owner/server/mcpOwnerTools';
import { ownerSiteFieldPublishInputSchema } from '@/features/owner/server/mcpOwnerSchemas';

vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ publish: vi.fn(), publishField: vi.fn(), publishConfiguration: vi.fn(), publishPresentation: vi.fn(), readFields: vi.fn(), readCopy: vi.fn(), readiness: vi.fn(), site: vi.fn(), access: vi.fn(), liveEdition: vi.fn(), savedOperation: vi.fn(), saveRevision: vi.fn(), activateRevision: vi.fn() }));
vi.mock('@/features/public-site/server/websiteEditionStore', () => ({
  readLiveWebsiteRevision: mocks.liveEdition,
  readSavedWebsiteOperation: mocks.savedOperation,
  readWebsiteRevisionIdentity: vi.fn().mockResolvedValue({ editionId: 'edition-1', ordinal: 2 }),
  saveWebsiteRevision: mocks.saveRevision,
  activateWebsiteRevision: mocks.activateRevision,
  listWebsiteEditions: vi.fn().mockResolvedValue([]),
  listWebsiteRevisions: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/features/legal/server', () => ({ getLegalDocuments: mocks.site }));
vi.mock('@/features/roadmap/server', () => ({ getRoadmapSettings: mocks.site, getRoadmapAdminItems: mocks.site }));
vi.mock('@/features/owner/server/ownerMediaCommands', () => ({ publishOwnerSiteMedia: mocks.publishPresentation, restoreOwnerSiteMedia: mocks.publishPresentation }));
vi.mock('@/features/public-site/server', async () => ({
  ...(await import('@/features/public-site/model/homepageComposition')),
  ...(await import('@/features/public-site/model/sitePages')),
  ...(await import('@/features/public-site/model/homepageShowcaseStages')),
  createSiteContentMap: (await import('@/features/public-site/model/siteContent')).createSiteContentMap,
  getSiteContentBlocks: mocks.readCopy,
  getPublicSiteConfiguration: mocks.readFields, getFounderProfile: mocks.site, getSiteMedia: mocks.site,
  completeSiteMediaForSections: (assets: unknown[]) => assets,
  SiteMediaStoreError: class extends Error {},
  PublicSiteConfigurationStoreError: class extends Error {
    constructor(message: string, public readonly status = 500) { super(message); }
  },
}));
vi.mock('@/features/business-identity/server', () => ({ getBusinessIdentity: mocks.site }));
vi.mock('@/features/experience-settings/server', () => ({ getExperienceSettings: mocks.site }));
vi.mock('@/features/analytics/server', () => ({ getOwnerAnalyticsSnapshot: mocks.site }));
vi.mock('@/features/mcp-usage/server', () => ({ getOwnerMcpUsageDashboard: mocks.site,
  observeMcpToolExecution: ({ execute }: { execute: () => Promise<unknown> }) => execute(),
}));
vi.mock('@/features/owner/server/ownerActivityStore', () => ({ getOwnerActivity: vi.fn() }));
vi.mock('@/features/owner/lib/ownerOperationsStore', () => ({ getOwnerSiteControlPayload: mocks.site, getOwnerOperationsOverviewPayload: mocks.site }));
vi.mock('@/features/owner/server/ownerSiteCommands', () => ({ publishOwnerSiteContentBlock: mocks.publish, publishOwnerSiteConfigurationField: mocks.publishField, publishOwnerSiteConfigurationPatch: mocks.publishConfiguration, publishOwnerSitePage: mocks.publishPresentation, publishOwnerBusinessIdentity: mocks.publishPresentation, publishOwnerFounderProfile: mocks.publishPresentation, publishOwnerExperienceSettings: mocks.publishPresentation, publishOwnerLegalDocument: mocks.publishPresentation, publishOwnerRoadmapSettings: mocks.publishPresentation, publishOwnerRoadmapStatus: mocks.publishPresentation }));
vi.mock('@/features/owner/server/ownerIntegrationStatus', () => ({ getOwnerIntegrationStatus: mocks.readiness }));

type RegisteredTool = {
  schema: StandardSchemaV1;
  handler: (input: Record<string, unknown>) => Promise<{ structuredContent?: Record<string, unknown>; content?: Array<{ type: string; text?: string }>; _meta?: Record<string, unknown> }>;
};
const tools = new Map<string, RegisteredTool>();
const block = {
  slug: 'shell.footer.independent', group: 'shell', section: 'Footer', label: 'Independent',
  body: 'Published copy', kind: 'short', maxLength: 180, updatedAt: '2026-10-11T00:00:00Z',
};
const settings = {
  updatedAt: '2026-10-12T00:00:00Z', primaryCtaLabel: 'Open Studio', primaryCtaHref: '/studio',
  announcementEnabled: false, announcementMessage: 'Announcement',
  primaryNavigation: [{ id: 'plans', label: 'Plans', href: '/plans', visible: true }],
  homepageTitle: 'Preserved title', homepageDescription: 'Preserved description',
};

afterEach(() => vi.unstubAllEnvs());

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('VERCEL_ENV', 'preview');
  mocks.access.mockResolvedValue({ user: { id: 'owner', emailAddresses: ['owner@example.com'], privateMetadata: {} }, email: 'owner@example.com', isOwner: true });
  mocks.readCopy.mockResolvedValue(DEFAULT_SITE_CONTENT_BLOCKS);
  mocks.liveEdition.mockResolvedValue({revisionId:null,generation:0});
  tools.clear();
  registerOwnerReadTools({
    server: {
      registerTool: (name: string, options: { outputSchema: StandardSchemaV1 }, handler: RegisteredTool['handler']) => {
        tools.set(name, { schema: options.outputSchema, handler });
      },
    } as unknown as Parameters<typeof registerOwnerReadTools>[0]['server'],
    getAccess: async () => await mocks.access() as McpOwnerAccess,
    toolError: (error) => ({ isError: true, content: [{ type: 'text', text: String(error) }],
      _meta: { 'cardforge/boundaryFailure': describeAgentBoundaryFailure(error) } }),
  });
});

async function invoke(name: string, input: Record<string, unknown> = {}) {
  const tool = tools.get(name)!;
  const result = await tool.handler(input);
  expect(result.structuredContent).toBeDefined();
  expect(await tool.schema['~standard'].validate(result.structuredContent)).not.toHaveProperty('issues');
  return result.structuredContent!;
}

describe('Owner MCP registered output contracts', () => {

  it.each(['get_owner_site_snapshot','get_owner_site_configuration','get_owner_site_media'])
    ('refuses stale legacy %s after activation without reading flat data', async (name) => {
      mocks.liveEdition.mockResolvedValue({ revisionId: 'live-revision', generation: 3 });
      const result = await tools.get(name)!.handler({});
      expect(result).toMatchObject({isError:true});
      expect(JSON.stringify(result)).toContain('owner_website_revision');
      expect(mocks.site).not.toHaveBeenCalled();
      expect(mocks.readFields).not.toHaveBeenCalled();
    });

  it('returns the existing Save operation ID readback and does not activate', async () => {
    mocks.savedOperation.mockResolvedValue('revision-2');
    const result = await invoke('owner_website_save_operation_status', {operationId:'11111111-1111-4111-8111-111111111111'});
    expect(result).toMatchObject({action:'save-operation-readback', revisionId:'revision-2', identity:{editionId:'edition-1', ordinal:2}});
    expect(mocks.activateRevision).not.toHaveBeenCalled();
    mocks.savedOperation.mockResolvedValue(null);
    const missing = await invoke('owner_website_save_operation_status', {operationId:'22222222-2222-4222-8222-222222222222'});
    expect(missing.revisionId).toBeNull();
  });

  it('keeps Save distinct from activation and rejects non-owner before either operation', async () => {
    mocks.saveRevision.mockResolvedValue('revision-2');
    const input = {editionId:'edition-1',expectedRevisionId:null,operationId:'11111111-1111-4111-8111-111111111111',manifest:{}};
    const saved = await invoke('owner_website_save_revision',input);
    expect(saved).toMatchObject({action:'save-draft',published:false,revisionId:'revision-2'});
    expect(mocks.activateRevision).not.toHaveBeenCalled();
    mocks.access.mockRejectedValue(new Error('Owner permission required'));
    expect(await tools.get('owner_website_save_revision')!.handler(input)).toMatchObject({isError:true});
    expect(await tools.get('owner_website_activate_revision')!.handler({revisionId:'revision-2',expectedGeneration:1,operationId:input.operationId,urlDisposition:{}})).toMatchObject({isError:true});
    expect(mocks.saveRevision).toHaveBeenCalledTimes(1);
    expect(mocks.activateRevision).not.toHaveBeenCalled();
  });

  it.each([['get_owner_workspace_health', 'overview'], ['get_owner_analytics', 'analytics'], ['get_owner_mcp_usage', 'mcpUsage']])('reads %s through its native browser reader', async (name, area) => {
    mocks.site.mockResolvedValue({ warnings: ['Unavailable metric'], observationOnly: true, databaseMetrics: null });
    expect(await invoke(name)).toMatchObject({ environment: 'preview', area, value: { warnings: ['Unavailable metric'], databaseMetrics: null } });
    expect(mocks.site).toHaveBeenCalledTimes(1);
  });
  it.each(['get_owner_workspace_health', 'get_owner_analytics', 'get_owner_mcp_usage'])('prevents a non-owner from reading %s', async (name) => {
    mocks.access.mockRejectedValue(new Error('Owner permission required'));
    expect(await tools.get(name)!.handler({})).toMatchObject({ isError: true });
    expect(mocks.site).not.toHaveBeenCalled();
  });

  it.each(['roadmapSettings', 'roadmapStatus', 'legal'])('routes %s through the canonical governance command', async (area) => {
    const receipt = { committed: true, refreshComplete: true, refreshFailures: [], activityRecorded: true, retryable: false, nextAction: 'none', message: 'Published.' };
    mocks.publishPresentation.mockResolvedValue({ value: { updatedAt: 'actual-revision' }, receipt });
    expect(await invoke('publish_owner_presentation', { area, values: { title: 'Fixture' }, expectedUpdatedAt: settings.updatedAt, expectedIdentityVersion: 2, expectedDocumentVersion: 3 })).toMatchObject({ area, value: { updatedAt: 'actual-revision' }, receipt });
    expect(mocks.publishPresentation).toHaveBeenCalledTimes(1);
  });
  it.each(['publish_owner_site_media', 'restore_owner_site_media'])('preserves actual media and terminal receipts from %s', async (name) => {
    const receipt = { committed: true, refreshComplete: false, refreshFailures: ['media-cache'], activityRecorded: false, retryable: false, nextAction: 'reload', message: 'Committed; reload.' };
    mocks.publishPresentation.mockResolvedValue({ value: { slot: 'landing.hero', updatedAt: 'actual-revision' }, receipt });
    expect(await invoke(name, { slot: 'landing.hero', alt: 'Fixture', presentation: {}, expectedUpdatedAt: settings.updatedAt })).toMatchObject({ environment: 'preview', livePublication: false, media: { updatedAt: 'actual-revision' }, receipt });
  });
  it.each(['get_owner_presentation_editor', 'publish_owner_presentation', 'get_owner_site_media', 'publish_owner_site_media', 'restore_owner_site_media'])('requires Owner authority before %s touches native state', async (name) => {
    mocks.access.mockRejectedValue(new Error('Owner permission required'));
    const result = await tools.get(name)!.handler({ area: 'legal', slot: 'landing.hero' });
    expect(result).toMatchObject({ isError: true });
    expect(mocks.publishPresentation).not.toHaveBeenCalled();
    expect(mocks.site).not.toHaveBeenCalled();
  });

  it('reads Owner walkthrough stages and summarizes managed image sources without disclosing storage paths', async () => {
    mocks.readFields.mockResolvedValue({ ...DEFAULT_PUBLIC_SITE_CONFIGURATION, updatedAt: settings.updatedAt });
    mocks.site.mockResolvedValue([{ slot: 'landing.showcase.layout', label: 'Template', alt: 'Studio', defaultSrc: '/fallback.png', storagePath: null }]);
    const result = await invoke('get_owner_homepage_showcase');
    expect(result).toMatchObject({ environment: 'preview', settingsRevision: settings.updatedAt, legacyCopy: true,
      stages: [{ id: 'templates' }, { id: 'make' }, { id: 'review' }],
    });
    expect(result.media).toEqual(expect.arrayContaining([
      expect.objectContaining({ slot: 'landing.showcase.layout', source: 'bundled-fallback' }),
    ]));
    expect(JSON.stringify(result)).not.toContain('storagePath');
  });

  it('reads the exact published legacy stage and per-view copy rather than static defaults', async () => {
    mocks.readFields.mockResolvedValue({ ...DEFAULT_PUBLIC_SITE_CONFIGURATION, updatedAt: settings.updatedAt });
    mocks.site.mockResolvedValue([]);
    const content = { ...createSiteContentMap(DEFAULT_SITE_CONTENT_BLOCKS),
      'landing.showcase.stage.templates': 'Authored Templates',
      'landing.showcase.stage.make': 'Authored generation',
      'landing.showcase.stage.review': 'Authored review',
      'landing.showcase.generator.single': 'S'.repeat(80),
      'landing.showcase.generator.bulk': 'B'.repeat(80),
    };
    mocks.readCopy.mockResolvedValue(DEFAULT_SITE_CONTENT_BLOCKS.map((block) => ({ ...block, body: content[block.slug] })));
    const result = await invoke('get_owner_homepage_showcase');
    expect(result.stages).toMatchObject([
      { label: 'Authored Templates' },
      { label: 'Authored generation', views: [{ label: 'S'.repeat(80) }, { label: 'B'.repeat(80) }] },
      { label: 'Authored review' },
    ]);
  });

  it.each([
    ['publish_owner_homepage_showcase', { stages: [] }],
    ['publish_owner_homepage_section', { operation: 'insert', sectionId: 'custom-invalid', section: {} }],
    ['publish_owner_homepage_section', { operation: 'remove', sectionId: 'showcase' }],
    ['publish_owner_homepage_section', { operation: 'move', sectionId: 'hero', direction: 'up' }],
  ])('preserves invalid-input boundary meaning in focused command %s', async (name, input) => {
    mocks.readFields.mockResolvedValue({ ...DEFAULT_PUBLIC_SITE_CONFIGURATION, updatedAt: settings.updatedAt });
    const result = await tools.get(name as string)!.handler({ ...input, expectedUpdatedAt: settings.updatedAt });
    expect(result).toMatchObject({ isError: true,
      _meta: { 'cardforge/boundaryFailure': { status: 400, kind: 'invalid', retryable: false } },
    });
    expect(mocks.publishConfiguration).not.toHaveBeenCalled();
  });

  it('saves just the walkthrough through the native revision-safe site configuration command', async () => {
    const before = { ...DEFAULT_PUBLIC_SITE_CONFIGURATION, updatedAt: settings.updatedAt };
    mocks.readFields.mockResolvedValue(before);
    const receipt = { committed: true, refreshComplete: true, refreshFailures: [], activityRecorded: true,
      retryable: false, nextAction: 'none', message: 'Published.' };
    const stages = [{ id: 'desk', label: 'Your Desk', kind: 'screenshots',
      views: [{ label: 'Desk view', mediaSlot: 'landing.showcase.layout' }] }];
    const after = { ...before, homepageSections: before.homepageSections.map((section) => (
      section.id === 'showcase' ? { ...section, showcaseStages: stages } : section
    )) };
    mocks.publishConfiguration.mockResolvedValue({ settings: after, receipt });
    const result = await invoke('publish_owner_homepage_showcase', { stages, expectedUpdatedAt: settings.updatedAt });
    expect(result).toMatchObject({ environment: 'preview', livePublication: false, stages, updatedAt: settings.updatedAt, receipt });
    expect(mocks.publishConfiguration).toHaveBeenCalledExactlyOnceWith({
      actor: { userId: 'owner', email: 'owner@example.com' }, expectedUpdatedAt: settings.updatedAt,
      patch: { homepageSections: after.homepageSections },
    });
    const beforeShowcase = DEFAULT_PUBLIC_SITE_CONFIGURATION.homepageSections.find((section) => section.id === 'showcase');
    const afterShowcase = after.homepageSections.find((section) => section.id === 'showcase');
    expect(afterShowcase && 'showcaseExamples' in afterShowcase ? afterShowcase.showcaseExamples : undefined)
      .toEqual(beforeShowcase?.showcaseExamples);
  });

  it.each(['get_owner_homepage_showcase', 'publish_owner_homepage_showcase'])('denies non-Owners before reading or saving %s', async (name) => {
    mocks.access.mockRejectedValue(new Error('Owner permission required'));
    expect(await tools.get(name)!.handler({ stages: [], expectedUpdatedAt: settings.updatedAt })).toMatchObject({ isError: true });
    expect(mocks.readFields).not.toHaveBeenCalled();
    expect(mocks.publishConfiguration).not.toHaveBeenCalled();
  });

  it('describes reusable homepage sections without changing existing site content', async () => {
    const before = { ...DEFAULT_PUBLIC_SITE_CONFIGURATION, updatedAt: settings.updatedAt };
    mocks.readFields.mockResolvedValue(before);
    const design = await invoke('get_owner_homepage_design');
    expect(design).toMatchObject({ environment: 'preview', settingsRevision: settings.updatedAt,
      sections: expect.arrayContaining([expect.objectContaining({ id: 'showcase' }), expect.objectContaining({ id: 'final_cta' })]),
      imageSlots: expect.arrayContaining(['landing.showcase.layout', 'landing.hero']),
    });
  });

  it('inserts a new bounded content section while preserving the real homepage and exact revision', async () => {
    const before = { ...DEFAULT_PUBLIC_SITE_CONFIGURATION, updatedAt: settings.updatedAt };
    mocks.readFields.mockResolvedValue(before);
    const section = { id: 'custom-desk', kind: 'custom', visible: true,
      design: { layout: 'split', tone: 'raised', spacing: 'balanced', align: 'center' },
      blocks: [
        { id: 'heading', kind: 'heading', text: 'Welcome to your Desk' },
        { id: 'action', kind: 'button', text: 'Open your Desk', href: '/account' },
      ] };
    const resultSections = [...before.homepageSections.slice(0, -1), section, before.homepageSections.at(-1)!];
    const receipt = { committed: true, refreshComplete: true, refreshFailures: [], activityRecorded: true,
      retryable: false, nextAction: 'none', message: 'Published.' };
    mocks.publishConfiguration.mockResolvedValue({ settings: { ...before, homepageSections: resultSections }, receipt });
    const result = await invoke('publish_owner_homepage_section', {
      operation: 'insert', sectionId: section.id, section, expectedUpdatedAt: settings.updatedAt,
    });
    expect(result).toMatchObject({ livePublication: false, environment: 'preview', sections: resultSections, receipt });
    expect(mocks.publishConfiguration).toHaveBeenCalledExactlyOnceWith({
      actor: { userId: 'owner', email: 'owner@example.com' }, expectedUpdatedAt: settings.updatedAt,
      patch: { homepageSections: resultSections },
    });
  });

  it('rejects arbitrary executable custom elements rather than attempting publication', async () => {
    mocks.readFields.mockResolvedValue({ ...DEFAULT_PUBLIC_SITE_CONFIGURATION, updatedAt: settings.updatedAt });
    const result = await tools.get('publish_owner_homepage_section')!.handler({
      operation: 'insert', sectionId: 'custom-unsafe', expectedUpdatedAt: settings.updatedAt,
      section: { id: 'custom-unsafe', kind: 'custom', visible: true,
        design: { layout: 'stack', tone: 'raised', spacing: 'balanced', align: 'start' },
        blocks: [{ id: 'bad', kind: 'html', text: '<script>alert(1)</script>' }] },
    });
    expect(result).toMatchObject({ isError: true });
    expect(mocks.publishConfiguration).not.toHaveBeenCalled();
  });

  it('replaces one existing block without overwriting sibling blocks or other sections', async () => {
    const contentSection = { id: 'custom-desk', kind: 'custom', visible: true,
      design: { layout: 'stack', tone: 'charcoal', spacing: 'balanced', align: 'start' },
      blocks: [{ id: 'heading', kind: 'heading', text: 'Old' },
        { id: 'button', kind: 'button', text: 'Open Desk', href: '/account' }] };
    const before = { ...DEFAULT_PUBLIC_SITE_CONFIGURATION, updatedAt: settings.updatedAt,
      homepageSections: [...DEFAULT_PUBLIC_SITE_CONFIGURATION.homepageSections, contentSection] };
    mocks.readFields.mockResolvedValue(before);
    const receipt = { committed: true, refreshComplete: true, refreshFailures: [], activityRecorded: true,
      retryable: false, nextAction: 'none', message: 'Saved.' };
    const expectedSections = [...before.homepageSections.slice(0, -1),
      { ...contentSection, blocks: [{ id: 'heading', kind: 'heading', text: 'Your Desk' }, contentSection.blocks[1]] }];
    mocks.publishConfiguration.mockResolvedValue({ settings: { ...before, homepageSections: expectedSections }, receipt });
    await invoke('publish_owner_homepage_block', {
      sectionId: 'custom-desk', blockId: 'heading',
      block: { id: 'heading', kind: 'heading', text: 'Your Desk' },
      expectedUpdatedAt: settings.updatedAt,
    });
    expect(mocks.publishConfiguration).toHaveBeenCalledExactlyOnceWith({
      actor: { userId: 'owner', email: 'owner@example.com' }, expectedUpdatedAt: settings.updatedAt,
      patch: { homepageSections: expectedSections },
    });
  });

  it.each(['get_owner_homepage_design', 'publish_owner_homepage_section', 'publish_owner_homepage_block'])(
    'denies non-owners before touching native state with %s', async (name) => {
      mocks.access.mockRejectedValue(new Error('Owner permission required'));
      expect(await tools.get(name)!.handler({ sectionId: 'custom-desk', expectedUpdatedAt: settings.updatedAt })).toMatchObject({ isError: true });
      expect(mocks.readFields).not.toHaveBeenCalled();
      expect(mocks.publishConfiguration).not.toHaveBeenCalled();
    },
  );

  it('reads complete settings and publishes partial changes with a canonical receipt', async () => {
    const full = { ...DEFAULT_PUBLIC_SITE_CONFIGURATION, updatedAt: settings.updatedAt };
    mocks.readFields.mockResolvedValue(full);
    expect(await invoke('get_owner_site_configuration')).toMatchObject({ settings: full });
    const receipt = { committed: true, refreshComplete: false, refreshFailures: ['homepage'], activityRecorded: true,
      retryable: false, nextAction: 'reload', message: 'Saved; reload.' };
    mocks.publishConfiguration.mockResolvedValue({ settings: full, receipt });
    const input = { patch: { primaryCtaHref: '/about' }, expectedUpdatedAt: settings.updatedAt };
    expect(await invoke('publish_owner_site_configuration', input)).toMatchObject({ livePublication: false, receipt });
    expect(mocks.publishConfiguration).toHaveBeenCalledExactlyOnceWith({ actor: { userId: 'owner', email: 'owner@example.com' }, ...input });
  });
  it('routes one page through the canonical command and preserves its complete truthful receipt schema', async () => {
    const full = { ...DEFAULT_PUBLIC_SITE_CONFIGURATION, updatedAt: settings.updatedAt };
    const receipt = { committed: true, refreshComplete: false, refreshFailures: ['public-pages'], activityRecorded: true,
      retryable: false, nextAction: 'reload', message: 'Saved for Owner editing, not public; reload.' };
    mocks.publishPresentation.mockResolvedValue({ settings: full, receipt });
    const input = { pageId: 'page-guide', operation: 'remove', expectedUpdatedAt: settings.updatedAt };
    expect(await invoke('publish_owner_site_page', input)).toMatchObject({ settings: full, receipt, livePublication: false });
    expect(mocks.publishPresentation).toHaveBeenCalledExactlyOnceWith({ actor: { userId: 'owner', email: 'owner@example.com' },
      pageId: 'page-guide', page: null, expectedUpdatedAt: settings.updatedAt });
  });
  it.each(['identity', 'founder', 'experience'])('uses the native %s publication and terminal receipt', async (area) => {
    const receipt = { committed: true, refreshComplete: true, refreshFailures: [], activityRecorded: true,
      retryable: false, nextAction: 'none', message: 'Published.' };
    mocks.publishPresentation.mockResolvedValue({ value: { updatedAt: settings.updatedAt }, receipt });
    const input = { area, values: { presentationContrast: 'high' }, ...(area === 'identity' ? { expectedIdentityVersion: 1 } : { expectedUpdatedAt: settings.updatedAt }) };
    expect(await invoke('publish_owner_presentation', input)).toMatchObject({ area, receipt, livePublication: false });
    expect(mocks.publishPresentation).toHaveBeenCalledTimes(1);
  });
  it.each(['get_owner_site_configuration', 'publish_owner_site_configuration', 'publish_owner_site_page', 'get_owner_presentation_editor', 'publish_owner_presentation'])('fails closed for %s', async (name) => {
    mocks.access.mockRejectedValue(new Error('Owner access required'));
    expect(await tools.get(name)!.handler({ area: 'identity', values: {} })).toMatchObject({ isError: true });
    expect(mocks.publishConfiguration).not.toHaveBeenCalled();
    expect(mocks.publishPresentation).not.toHaveBeenCalled();
  });
  it('accepts an empty announcement while requiring nonempty CTA and navigation labels', async () => {
    expect(await ownerSiteFieldPublishInputSchema['~standard'].validate({ field: 'announcementMessage', value: '', expectedUpdatedAt: settings.updatedAt })).not.toHaveProperty('issues');
    expect(await ownerSiteFieldPublishInputSchema['~standard'].validate({ field: 'primaryCtaLabel', value: '', expectedUpdatedAt: settings.updatedAt })).toHaveProperty('issues');
  });
  it('reads exact editable settings revision and contextual destinations without leaking internal fields', async () => {
    mocks.readFields.mockResolvedValue(settings);
    const result = await invoke('get_owner_site_fields');
    expect(result).toMatchObject({ environment: 'preview', settings: {
      updatedAt: settings.updatedAt, primaryCtaHref: '/studio', announcementEnabled: false,
      navigation: [{ id: 'plans', href: '/plans', visible: true }],
    } });
    expect(result.settings).not.toHaveProperty('homepageTitle');
    expect(mocks.publishField).not.toHaveBeenCalled();
  });

  it.each(['primaryCtaLabel', 'navigationLabel', 'announcementMessage'] as const)('delegates %s publication to the native browser command with exact actor/revision', async (field) => {
    const input = { field, value: 'Updated label', expectedUpdatedAt: settings.updatedAt,
      ...(field === 'navigationLabel' ? { navigationId: 'plans' } : {}) };
    const receipt = { committed: true, refreshComplete: true, refreshFailures: [], activityRecorded: true,
      retryable: false, nextAction: 'none', message: 'Published.' };
    mocks.publishField.mockResolvedValue({ settings: { ...settings, updatedAt: '2026-10-12T01:00:00Z' }, receipt });
    const result = await invoke('publish_owner_site_field', input);
    expect(mocks.publishField).toHaveBeenCalledExactlyOnceWith({ actor: { userId: 'owner', email: 'owner@example.com' }, input });
    expect(result).toMatchObject({ environment: 'preview', livePublication: false, receipt,
      settings: { updatedAt: '2026-10-12T01:00:00Z', primaryCtaHref: '/studio' } });
  });

  it('retains a non-retryable committed receipt after incomplete refresh and reports live Production accurately', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    const receipt = { committed: true, refreshComplete: false, refreshFailures: ['homepage'], activityRecorded: false,
      retryable: false, nextAction: 'reload', message: 'Saved; reload before further publication.' };
    mocks.publishField.mockResolvedValue({ settings, receipt });
    const result = await invoke('publish_owner_site_field', { field: 'primaryCtaLabel', value: 'Changed', expectedUpdatedAt: settings.updatedAt });
    expect(result).toMatchObject({ environment: 'production', livePublication: true, receipt });
  });

  it('propagates a native conflict without inventing a success or repeating publication', async () => {
    mocks.publishField.mockRejectedValue(new Error('Site settings changed; reload.'));
    const result = await tools.get('publish_owner_site_field')!.handler({ field: 'primaryCtaLabel', value: 'Changed', expectedUpdatedAt: settings.updatedAt });
    expect(result).toMatchObject({ isError: true });
    expect(result.structuredContent).toBeUndefined();
    expect(mocks.publishField).toHaveBeenCalledTimes(1);
  });

  it.each(['get_owner_site_fields', 'publish_owner_site_field'])('does not reach state readers/writers when %s loses Owner authorization', async (name) => {
    mocks.access.mockRejectedValue(new Error('CardForge Owner access is required.'));
    const result = await tools.get(name)!.handler({ field: 'primaryCtaLabel', value: 'Changed', expectedUpdatedAt: settings.updatedAt });
    expect(result).toMatchObject({ isError: true });
    expect(mocks.site).not.toHaveBeenCalled();
    expect(mocks.readFields).not.toHaveBeenCalled();
    expect(mocks.publishField).not.toHaveBeenCalled();
  });

  it.each([
    { field: 'navigationLabel', value: 'Label', expectedUpdatedAt: settings.updatedAt },
    { field: 'navigationLabel', navigationId: 'unknown', value: 'Label', expectedUpdatedAt: settings.updatedAt },
    { field: 'primaryCtaLabel', navigationId: 'plans', value: 'Label', expectedUpdatedAt: settings.updatedAt },
    { field: 'primaryCtaLabel', value: 'Label', expectedUpdatedAt: null },
    { field: 'primaryCtaHref', value: '/elsewhere', expectedUpdatedAt: settings.updatedAt },
  ])('rejects unsupported or ambiguous publication input %#', async (input) => {
    expect(await ownerSiteFieldPublishInputSchema['~standard'].validate(input)).toHaveProperty('issues');
  });

  it.each(['clerk_private_metadata', 'environment'])('reports server-resolved caller and %s authority without exposing metadata', async (source) => {
    vi.stubEnv('CARDFORGE_OWNER_ACCOUNT_EMAILS', source === 'environment' ? 'actual@example.com' : 'different@example.com');
    mocks.access.mockResolvedValue({ user: { id: 'actual-user', emailAddresses: ['actual@example.com'],
      privateMetadata: source === 'clerk_private_metadata' ? { cardforgeRole: 'owner', unrelatedSecret: 'do-not-disclose' } : {} },
    email: 'actual@example.com', isOwner: true });
    mocks.site.mockResolvedValue({
      businessIdentity: { identityVersion: 1, brandName: 'CardForge', legalOperatorName: 'Operator', websiteUrl: 'https://example.com', supportEmail: 'help@example.com' },
      siteConfiguration: { homepageTitle: 'Home', homepageDescription: 'Description', announcementEnabled: false,
        announcementMessage: '', primaryCtaLabel: 'Open', primaryCtaHref: '/studio', primaryNavigation: [], homepageSections: [] },
      siteContentBlocks: [], siteMedia: [], legalDocuments: [], roadmapItems: [],
      founderProfile: { heroHeadline: 'Founder', introduction: '', priorities: [], updatedAt: null },
    });
    const tool = tools.get('get_owner_site_snapshot')!;
    const result = await tool.handler({});
    expect(await tool.schema['~standard'].validate(result.structuredContent)).not.toHaveProperty('issues');
    expect(result.content?.[0].text).toContain('actual@example.com (actual-user)');
    expect(result.content?.[0].text).toContain('Owner authority: ' + source);
    expect(JSON.stringify(result)).not.toContain('do-not-disclose');
  });
  it.each([true, false])('reports a committed publication when refreshComplete=%s', async (refreshComplete) => {
    const receipt = {
      committed: true, refreshComplete, refreshFailures: refreshComplete ? [] : ['content'],
      activityRecorded: true, retryable: false, nextAction: refreshComplete ? 'none' : 'reload',
      message: 'Copy was committed.',
    };
    mocks.publish.mockResolvedValue({ siteContentBlock: block, receipt });
    const result = await invoke('publish_owner_site_copy', {
      slug: block.slug, body: block.body, expectedUpdatedAt: null,
    });
    expect(result).toMatchObject({ environment: 'preview', livePublication: false, receipt });
    expect(result.siteContentBlock).toMatchObject({ slug: block.slug, body: block.body, updatedAt: block.updatedAt });
    expect(mocks.publish).toHaveBeenCalledTimes(1);
  });

  it('projects native billing readiness into the advertised contract without losing missing configuration', async () => {
    const billing = getBillingConfigStatus({});
    mocks.readiness.mockReturnValue({
      site: { publicAppUrl: 'https://example.com', configuredPublicAppUrl: null, usingLocalFallback: false,
        sitemapUrl: 'https://example.com/sitemap.xml', robotsUrl: 'https://example.com/robots.txt' },
      authConfigured: true, canonicalOwnerConfigured: true, billing,
      supabase: { configured: false, missing: ['SUPABASE_URL'] }, analytics: {},
      email: { contactMode: 'mailto', resendConfigured: false, fromConfigured: false, replyToConfigured: false, missing: [] },
      connectedServices: [],
    });
    const result = await invoke('get_owner_provider_readiness');
    const projected = result.billing as { missing: string[] };
    expect(projected.missing).toContain('STRIPE_DESIGNER_PASS_PRICE_ID');
    expect(projected.missing).toContain('STRIPE_CREATOR_PASS_PRICE_ID');
    expect(projected.missing).toContain('STRIPE_SUPPORT_MONTHLY_1_PRICE_ID');
    expect(projected.missing.filter((key) => key === 'STRIPE_SECRET_KEY')).toHaveLength(1);
  });
});
