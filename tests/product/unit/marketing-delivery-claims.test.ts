import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  database: { from: vi.fn(), rpc: vi.fn() },
  publish: vi.fn(),
  configuration: { configured: true, publishingEnabled: true },
}));
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: () => mocks.database }));
vi.mock('@/features/analytics/server', () => ({ buildOrganicCampaignUrl: () => '' }));
vi.mock('@/features/marketing-content/server', () => ({
  getMarketingContentPackage: async () => ({
    id: 'campaign', version: 2, status: 'approved', marketingCampaignId: 'tracking', destinationUrl: '',
    variants: [{ service: 'facebook', text: 'Approved content', attachments: [] }],
  }),
  getPublicCampaignMediaUrl: vi.fn(),
}));
vi.mock('@/features/social-publishing/server', () => ({ publishToMeta: mocks.publish }));
vi.mock('@/features/marketing-distribution/server/metaConnection', () => ({ getMetaConfiguration: () => mocks.configuration }));
vi.mock('@/features/marketing-distribution/server/marketingTokenCrypto', () => ({ decryptMarketingToken: () => 'fixture-token' }));

import { dispatchDueMarketingDeliveries } from '@/features/marketing-distribution/server/dispatcher';

describe('marketing delivery claim ownership', () => {
  let job: Record<string, unknown>;
  let databaseUnavailable: boolean;
  let connectionUnavailable: boolean;
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.configuration.publishingEnabled = true;
    databaseUnavailable = false;
    connectionUnavailable = false;
    job = { id: 'job', campaign_id: 'campaign', approved_campaign_version: 2, destination_id: 'destination', provider_channel_id: 'page', service: 'facebook', attempt_count: 1, status: 'publishing', claim_token: 'worker-original' };
    mocks.database.rpc.mockImplementation(async () => ({ data: [{ ...job }], error: null }));
    mocks.publish.mockResolvedValue({ providerPostId: 'post-123', publicationUrl: 'https://example.test/post-123' });
    mocks.database.from.mockImplementation((table: string) => {
      const filters = new Map<string, unknown>();
      let update: Record<string, unknown> | undefined;
      const query = {
        select: () => query,
        update: (values: Record<string, unknown>) => { update = values; return query; },
        eq: (key: string, value: unknown) => { filters.set(key, value); return query; },
        not: () => query,
        limit: () => query,
        then: (resolve: (value: unknown) => unknown) => {
          if (table === 'cardforge_social_publish_jobs' && update) {
            if (databaseUnavailable) return resolve({ data: null, error: { message: 'Unavailable' } });
            if ([...filters].every(([key, value]) => job[key] === value)) {
              Object.assign(job, update);
              return resolve({ data: [{ id: job.id }], error: null });
            }
            return resolve({ data: [], error: null });
          }
          if (table === 'cardforge_marketing_destinations') return resolve({ data: [{ id: 'destination', connection_id: 'connection', external_account_id: 'page', service: 'facebook' }], error: null });
          if (table === 'cardforge_marketing_connections') return resolve(connectionUnavailable
            ? { data: null, error: { message: 'Unavailable' } }
            : { data: [{ status: 'active' }], error: null });
          if (table === 'cardforge_marketing_campaigns') return resolve({ data: [{ utm_campaign: 'campaign' }], error: null });
          if (table === 'cardforge_social_publish_jobs' && filters.has('claim_token')) {
            return resolve({ data: [...filters].every(([key, value]) => job[key] === value) ? [{ id: job.id }] : [], error: null });
          }
          if (table === 'cardforge_social_campaigns' && !update) return resolve({ data: [{ id: 'campaign' }], error: null });
          return resolve({ data: [], error: null });
        },
      };
      return query;
    });
  });

  it('finalizes an owned claim and clears it', async () => {
    expect(await dispatchDueMarketingDeliveries()).toMatchObject({ results: [{ status: 'published' }] });
    expect(job).toMatchObject({ status: 'published', claim_token: null, provider_post_id: 'post-123' });
  });

  it.each(['cancelled', 'unknown', 'reclaimed'])('does not overwrite %s work after a delayed provider response', async (state) => {
    mocks.publish.mockImplementation(async () => {
      job.status = state === 'reclaimed' ? 'publishing' : state;
      job.claim_token = state === 'reclaimed' ? 'worker-new' : null;
      return { providerPostId: 'post-123', publicationUrl: 'https://example.test/post-123' };
    });
    const result = await dispatchDueMarketingDeliveries();
    expect(job.status).toBe(state === 'reclaimed' ? 'publishing' : state);
    expect(job.claim_token).toBe(state === 'reclaimed' ? 'worker-new' : null);
    expect(result.results[0]).toMatchObject({ status: 'unknown', providerPostId: 'post-123', publicationUrl: 'https://example.test/post-123' });
    expect(mocks.publish).toHaveBeenCalledOnce();
  });

  it('retains the provider receipt when both finalization attempts are unavailable', async () => {
    mocks.publish.mockImplementation(async () => {
      databaseUnavailable = true;
      return { providerPostId: 'post-123', publicationUrl: 'https://example.test/post-123' };
    });
    expect(await dispatchDueMarketingDeliveries()).toMatchObject({ results: [{ status: 'unknown', providerPostId: 'post-123' }] });
    expect(mocks.publish).toHaveBeenCalledOnce();
    expect(job.status).toBe('publishing');
  });

  it('keeps unavailable credentials distinct from a disconnected account', async () => {
    connectionUnavailable = true;
    await dispatchDueMarketingDeliveries();
    expect(job.error_message).toContain('could not be read');
    expect(job.error_message).not.toContain('reconnect');
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('does not claim or publish while disabled', async () => {
    mocks.configuration.publishingEnabled = false;
    await expect(dispatchDueMarketingDeliveries()).rejects.toThrow('not enabled');
    expect(mocks.database.rpc).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('requires owner review after an ambiguous provider response', async () => {
    mocks.publish.mockRejectedValue(new TypeError('Network connection lost'));
    expect(await dispatchDueMarketingDeliveries()).toMatchObject({ results: [{ status: 'unknown' }] });
    expect(job).toMatchObject({ status: 'unknown', next_attempt_at: null });
    expect(mocks.publish).toHaveBeenCalledOnce();
  });

  it('does not silently publish to a changed destination account', async () => {
    job.provider_channel_id = 'previous-page';
    await dispatchDueMarketingDeliveries();
    expect(job.error_message).toContain('destination changed');
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it.each([null, 1])('requires review for a missing or superseded approval revision (%s)', async (revision) => {
    job.approved_campaign_version = revision;
    expect(await dispatchDueMarketingDeliveries()).toMatchObject({ results: [{ status: 'unknown' }] });
    expect(job).toMatchObject({ status: 'unknown', next_attempt_at: null });
    expect(job.error_message).toContain('exact approved revision');
    expect(mocks.publish).not.toHaveBeenCalled();
  });
});
