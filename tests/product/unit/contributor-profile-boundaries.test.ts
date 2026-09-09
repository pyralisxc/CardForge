import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ configured: true, error: null as unknown, rows: [] as unknown[], count: 0 }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: () => {
  if (!state.configured) return null;
  const query = {
    select: () => query, eq: () => query, limit: () => query, upsert: () => query, order: () => query, range: () => query,
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: state.rows, count: state.count, error: state.error }).then(resolve),
  };
  return { from: () => query };
} }));

import {
  countActiveContributors, fetchContributorProfileRow, fetchContributorProfileRows,
  getContributorProfileCapabilities, getContributorProfileIdentity,
  getUniqueActiveContributorProfileReferenceByEmail, upsertContributorProfile,
} from '@/features/contributor-access/server/profileStore';

const readers = [
  () => countActiveContributors(), () => fetchContributorProfileRows(),
  () => fetchContributorProfileRow('user_one'), () => getContributorProfileCapabilities('user_one'),
  () => getContributorProfileIdentity('user_one'),
  () => getUniqueActiveContributorProfileReferenceByEmail('one@example.test'),
  () => upsertContributorProfile({ contributorId: 'user_one', email: 'one@example.test' }),
];
beforeEach(() => { state.configured = true; state.error = null; state.rows = []; state.count = 0; });
describe('Contributor provider boundaries', () => {
  it.each(readers.map((read, index) => ({ read, index })))('does not substitute empty or inactive data for missing configuration ($index)', async ({ read }) => {
    state.configured = false;
    await expect(read()).rejects.toMatchObject({ status: 503 });
  });
  it.each(readers.map((read, index) => ({ read, index })))('preserves database failures as unavailable ($index)', async ({ read }) => {
    state.error = { message: 'fixture timeout' };
    await expect(read()).rejects.toMatchObject({ status: 503 });
  });
  it('still distinguishes an absent profile from provider failure', async () => {
    await expect(fetchContributorProfileRow('user_one')).resolves.toBeNull();
    await expect(getContributorProfileCapabilities('user_one')).resolves.toEqual({ status: 'inactive', canDraftCampaigns: false });
    await expect(fetchContributorProfileRows()).resolves.toEqual([]);
  });
});
