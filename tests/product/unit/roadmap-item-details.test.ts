import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ values: {} as Record<string, unknown>, filters: {} as Record<string, unknown>, match: true }));
vi.mock('@/features/roadmap/server/roadmapSettingsStore', () => ({ getRoadmapSettings: async () => ({ maxRoadmapSuggestionLength: 200 }) }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({
  getSupabaseServerConfigStatus: () => ({ configured: true }),
  getSupabaseServerClient: () => ({ from: (table: string) => {
    if (table !== 'cardforge_roadmap_items') throw new Error('unexpected table ' + table);
    const q = {
      update: (values: Record<string, unknown>) => { state.values = values; return q; },
      eq: (key: string, value: unknown) => { state.filters[key] = value; return q; },
      is: (key: string, value: unknown) => { state.filters[key] = value; return q; },
      select: () => q,
      maybeSingle: async () => ({ data: state.match ? { id: 'item', title: state.values.title, description: state.values.description,
        item_type: state.filters.item_type, status: 'planned', source: 'user', visible_month: state.values.visible_month,
        monthly_cost_cents: state.values.monthly_cost_cents ?? null, expense_provider: state.values.expense_provider ?? null,
        expense_plan: state.values.expense_plan ?? null, expense_source_url: state.values.expense_source_url ?? null,
        expense_verified_at: state.values.expense_verified_at ?? null, shipped_at: null, updated_at: '2026-11-27T00:00:01Z' } : null, error: null }),
    };
    return q;
  } }),
}));
import { updateRoadmapItemDetails } from '@/features/roadmap/server/roadmapAdminStore';
const common = { itemId: 'item', editKind: 'correction', expectedUpdatedAt: '2026-11-27T00:00:00Z', itemType: 'feature', title: 'Clearer wording', description: 'A correction', visibleMonth: '2026-11' };
beforeEach(() => { state.values = {}; state.filters = {}; state.match = true; });
it('updates only details at the expected revision, leaving votes and release records untouched', async () => {
  const result = await updateRoadmapItemDetails(common);
  expect(result.title).toBe('Clearer wording');
  expect(state.values).toEqual({ title: 'Clearer wording', description: 'A correction', visible_month: '2026-11' });
  expect(state.filters).toMatchObject({ id: 'item', item_type: 'feature', updated_at: common.expectedUpdatedAt, release_version: null });
  state.match = false;
  await expect(updateRoadmapItemDetails(common)).rejects.toMatchObject({ status: 409 });
});
it('requires complete auditable fields before writing an expense correction', async () => {
  const expense = { ...common, itemType: 'roi_checkpoint', monthlyCostCents: 2000, expenseProvider: 'Vercel', expensePlan: 'Pro',
    expenseSourceUrl: 'https://vercel.com/pricing', expenseVerifiedAt: '2026-01-01', expenseState: 'current' };
  await updateRoadmapItemDetails(expense);
  expect(state.values).toMatchObject({ monthly_cost_cents: 2000, expense_provider: 'Vercel', expense_plan: 'Pro' });
  state.values = {};
  await expect(updateRoadmapItemDetails({ ...expense, expenseSourceUrl: 'http://vercel.com' })).rejects.toMatchObject({ status: 400 });
  expect(state.values).toEqual({});
});
