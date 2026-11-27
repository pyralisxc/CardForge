import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ settingsReads: 0, failAt: 0, writes: [] as string[], count: 0, minVotes: 100, percent: 75, archived: false, votes: [] as {item: string; user: string}[], rows: [] as Record<string, unknown>[] }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({
  getSupabaseServerConfigStatus: () => ({ configured: true }),
  getSupabaseServerClient: () => ({ from: (table: string) => {
    let operation = '';
    const filters: Record<string, string> = {};
    const q = {
      select: (columns: string) => { operation = columns; return q; },
      eq: (key: string, value: string) => { filters[key] = value; return q; }, neq: () => q, order: () => q, in: () => q, limit: () => q,
      maybeSingle: async () => ({ data: { id: 'item', source: 'user', status: state.archived ? 'archived_negative_signal' : 'planned' }, error: null }),
      insert: async () => { state.writes.push('insert'); return { error: null }; },
      upsert: async () => { state.writes.push('vote'); return { error: null }; },
      update: () => { state.writes.push('archive'); return q; },
      delete: () => { operation = 'delete'; return q; },
      then: (resolve: (value: unknown) => unknown) => {
        if (table === 'cardforge_roadmap_votes' && operation === 'delete') {
          state.votes = state.votes.filter(v => !(v.item === filters.item_id && v.user === filters.user_id));
          state.writes.push('withdraw');
          return Promise.resolve(resolve({ error: null }));
        }
        if (table === 'cardforge_owner_settings') {
          state.settingsReads++;
          return Promise.resolve(resolve(state.settingsReads === state.failAt ? { data: null, error: { message: 'outage' } } : {
            data: [{ max_active_user_roadmap_items: 10, max_roadmap_suggestion_length: 20,
              roadmap_negative_signal_min_total_votes: state.minVotes, roadmap_negative_signal_min_downvote_percent: state.percent,
              roadmap_estimated_tax_percent: 20, roadmap_operating_reserve_percent: 20 }], error: null,
          }));
        }
        if (table === 'cardforge_roadmap_items' && operation.startsWith('id,title,')) return Promise.resolve(resolve({ data: state.rows, error: null }));
        if (table === 'cardforge_roadmap_votes' && operation === 'vote') return Promise.resolve(resolve({ data: [...Array(9).fill({ vote: 'up' }), ...Array(12).fill({ vote: 'down' })], error: null }));
        return Promise.resolve(resolve({ data: [], count: state.count, error: null }));
      },
    };
    return q;
  } }),
}));
vi.mock('@/features/billing/server', () => ({ getCurrentCreatorPassRevenue: async () => ({ available: false, activeSubscriberCount: 0, grossMonthlyRevenueCents: 0 }) }));
vi.mock('@clerk/nextjs/server', () => ({ currentUser: async () => ({ id: 'u', primaryEmailAddress: null, emailAddresses: [], publicMetadata: {}, privateMetadata: {} }) }));
vi.mock('@/infrastructure/security/abuseProtection', () => ({ consumeRateLimit: async () => ({ allowed: true }), RateLimitUnavailableError: class extends Error {} }));
import { createContributorRoadmapItem, createRoadmapSuggestion, voteRoadmapItem } from '@/features/roadmap/server/roadmapStore';
import { GET, POST } from '@/app/api/roadmap/route';
import { POST as postVote } from '@/app/api/roadmap/votes/route';

beforeEach(() => { state.settingsReads = 0; state.failAt = 0; state.writes = []; state.count = 0; state.minVotes = 100; state.percent = 75; state.archived = false; state.votes = []; state.rows = []; });
describe('roadmap policy persistence boundary', () => {
  it('does not write votes or suggestions when configured settings cannot be read', async () => {
    state.failAt = 1;
    await expect(voteRoadmapItem({ userId: 'u', itemId: 'item', vote: 'down' })).rejects.toMatchObject({ status: 503 });
    state.settingsReads = 0;
    await expect(createRoadmapSuggestion({ userId: 'u', userEmail: null, title: 'idea' })).rejects.toMatchObject({ status: 503 });
    state.settingsReads = 0;
    await expect(createContributorRoadmapItem({ userId: 'u', userEmail: null, title: 'idea' })).rejects.toMatchObject({ status: 503 });
    expect(state.writes).toEqual([]);
  });
  it('enforces actual policy and keeps the successful vote receipt if refresh fails', async () => {
    state.failAt = 2;
    const result = await voteRoadmapItem({ userId: 'u', itemId: 'item', vote: 'down' });
    expect(state.writes).toEqual(['vote']);
    expect(result.configured).toBe(false);
    expect(result.mutationWarning).toContain('Saved');
  });
  it('uses configured capacity and archive thresholds', async () => {
    state.count = 10;
    await expect(createRoadmapSuggestion({ userId: 'u', userEmail: null, title: 'idea' })).rejects.toMatchObject({ status: 409 });
    state.minVotes = 20;
    await voteRoadmapItem({ userId: 'u', itemId: 'item', vote: 'down' });
    expect(state.writes).toEqual(['vote']); // 12 of 21 is below the configured 75% threshold
  });
  it('archives when the configured threshold is reached', async () => {
    state.minVotes = 20;
    state.percent = 51;
    await voteRoadmapItem({ userId: 'u', itemId: 'item', vote: 'down' });
    expect(state.writes).toEqual(['vote', 'archive']);
  });
  it('retains a successful suggestion receipt if the display refresh fails', async () => {
    state.failAt = 2;
    const result = await createRoadmapSuggestion({ userId: 'u', userEmail: null, title: 'idea' });
    expect(state.writes).toEqual(['insert']);
    expect(result.mutationWarning).toContain('Saved');
  });
  it('returns an unavailable HTTP receipt and recovers the public board after the settings read recovers', async () => {
    state.failAt = 1;
    const request = (url: string, body: object) => new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const failed = await postVote(request('http://localhost/api/roadmap/votes', { itemId: 'item', vote: 'down' }));
    expect(failed.status).toBe(503);
    expect(state.writes).toEqual([]);
    const recovered = await GET();
    expect(recovered.status).toBe(200);
    expect(await recovered.json()).toMatchObject({ configured: true });
    state.settingsReads = 0;
    const suggestion = await POST(request('http://localhost/api/roadmap', { title: 'idea' }));
    expect(suggestion.status).toBe(503);
    expect(state.writes).toEqual([]);
  });
  it('does not expose incomplete expense details in the public board payload', async () => {
    state.rows = [{ id: 'cost', title: 'Expense', description: null, item_type: 'roi_checkpoint', status: 'planned', source: 'official', visible_month: '2026-11', monthly_cost_cents: 1234, expense_provider: 'Private draft value', expense_plan: null, expense_source_url: null, expense_verified_at: null, expense_state: 'current', shipped_at: null, created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z' }];
    const response = await GET();
    const body = await response.json();
    expect(body.items[0]).toMatchObject({ monthlyCostCents: null, expenseProvider: null, expenseState: null });
    expect(JSON.stringify(body)).not.toContain('Private draft value');
    expect(body.items[0]).not.toHaveProperty('expenseDetails');
  });
  it('withdraws only the signed-in user’s vote without reviving an archived item', async () => {
    state.archived = true;
    state.votes = [{ item: 'item', user: 'u' }, { item: 'item', user: 'another' }, { item: 'other', user: 'u' }];
    const request = new Request('http://localhost/api/roadmap/votes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId: 'item', vote: null, userId: 'another' }) });
    const response = await postVote(request);
    expect(response.status).toBe(200);
    expect(state.votes).toEqual([{ item: 'item', user: 'another' }, { item: 'other', user: 'u' }]);
    expect(state.writes).toEqual(['withdraw']);
  });
});
