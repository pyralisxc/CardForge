import type { StandardSchemaV1 } from '@modelcontextprotocol/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getBillingConfigStatus } from '@/features/billing/lib/billing';
import type { McpOwnerAccess } from '@/features/owner/server/mcpOwnerAccess';
import { registerOwnerReadTools } from '@/features/owner/server/mcpOwnerTools';

const mocks = vi.hoisted(() => ({ publish: vi.fn(), readiness: vi.fn(), site: vi.fn(), access: vi.fn() }));
vi.mock('@/features/mcp-usage/server', () => ({
  observeMcpToolExecution: ({ execute }: { execute: () => Promise<unknown> }) => execute(),
}));
vi.mock('@/features/owner/server/ownerActivityStore', () => ({ getOwnerActivity: vi.fn() }));
vi.mock('@/features/owner/lib/ownerOperationsStore', () => ({ getOwnerSiteControlPayload: mocks.site }));
vi.mock('@/features/owner/server/ownerSiteCommands', () => ({ publishOwnerSiteContentBlock: mocks.publish }));
vi.mock('@/features/owner/server/ownerIntegrationStatus', () => ({ getOwnerIntegrationStatus: mocks.readiness }));

type RegisteredTool = {
  schema: StandardSchemaV1;
  handler: (input: Record<string, unknown>) => Promise<{ structuredContent?: Record<string, unknown>; content?: Array<{ type: string; text?: string }> }>;
};
const tools = new Map<string, RegisteredTool>();
const block = {
  slug: 'shell.footer.independent', group: 'shell', section: 'Footer', label: 'Independent',
  body: 'Published copy', kind: 'short', maxLength: 180, updatedAt: '2026-10-11T00:00:00Z',
};

afterEach(() => vi.unstubAllEnvs());

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('VERCEL_ENV', 'preview');
  mocks.access.mockResolvedValue({ user: { id: 'owner', emailAddresses: ['owner@example.com'], privateMetadata: {} }, email: 'owner@example.com', isOwner: true });
  tools.clear();
  registerOwnerReadTools({
    server: {
      registerTool: (name: string, options: { outputSchema: StandardSchemaV1 }, handler: RegisteredTool['handler']) => {
        tools.set(name, { schema: options.outputSchema, handler });
      },
    } as unknown as Parameters<typeof registerOwnerReadTools>[0]['server'],
    getAccess: async () => await mocks.access() as McpOwnerAccess,
    toolError: (error) => ({ isError: true, content: [{ type: 'text', text: String(error) }] }),
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
