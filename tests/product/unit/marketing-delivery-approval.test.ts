import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ from: vi.fn(), upsert: vi.fn() }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: () => ({ from: mocks.from }) }));
vi.mock('@/features/marketing-distribution/server/metaConnection', () => ({ getMetaConfiguration: vi.fn() }));
import { queueMarketingDelivery } from '@/features/marketing-distribution/server/store';

describe('marketing delivery approval snapshot', () => {
  let existing: { approved_campaign_version: number | null } | null;
  beforeEach(() => {
    vi.clearAllMocks();
    existing = null;
    mocks.from.mockImplementation((table: string) => {
      let inserting = false;
      const query = {
        select: () => query,
        eq: () => query,
        limit: () => query,
        upsert: (values: unknown) => { mocks.upsert(values); inserting = true; return query; },
        then: (resolve: (value: unknown) => unknown) => {
          if (table === 'cardforge_social_campaigns') return resolve({ data: [{ id: 'content', status: 'approved', version: 4, variants: [{ service: 'facebook' }] }], error: null });
          if (table === 'cardforge_marketing_destinations') return resolve({ data: [{ id: 'destination', service: 'facebook', provider: 'meta', publishing_mode: 'automatic', external_account_id: 'page', active: true }], error: null });
          return resolve({ data: inserting && existing ? [] : [{ id: 'job', status: 'scheduled', ...existing }], error: null });
        },
      };
      return query;
    });
  });

  it('captures the exact approved version and destination together', async () => {
    await queueMarketingDelivery({ contentId: 'content', destinationId: 'destination' });
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ approved_campaign_version: 4, provider_channel_id: 'page' }));
  });

  it.each([null, 3])('does not claim an existing mismatched approval (%s) is newly queued', async (version) => {
    existing = { approved_campaign_version: version };
    await expect(queueMarketingDelivery({ contentId: 'content', destinationId: 'destination' })).rejects.toMatchObject({ status: 409 });
  });

  it('returns an already queued exact approval without changing it', async () => {
    existing = { approved_campaign_version: 4 };
    await expect(queueMarketingDelivery({ contentId: 'content', destinationId: 'destination' })).resolves.toEqual({ id: 'job', status: 'scheduled' });
  });
});
