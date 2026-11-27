import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ value: false, filters: {} as Record<string, unknown>, write: {} as Record<string, unknown> }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: () => ({ from: () => {
  const q = {
    update: (value: Record<string, unknown>) => { state.write = value; return q; },
    eq: (key: string, value: unknown) => { state.filters[key] = value; return q; },
    select: () => q,
    limit: async () => {
      if ('can_edit_roadmap' in state.filters && state.filters.can_edit_roadmap !== state.value) return { data: [], error: null };
      if ('can_edit_roadmap' in state.write) state.value = Boolean(state.write.can_edit_roadmap);
      return { data: [{ clerk_user_id: 'person' }], error: null };
    },
  }; return q;
} }) }));
import { updateContributorProfileControl } from '@/features/contributor-access/server/profileStore';
const base = { contributorId: 'person', status: 'active' as const, canDraftCampaigns: false, monthlySubmissionLimitOverride: null, monthlyPublishedRequirementOverride: null, ownerNote: '' };
beforeEach(() => { state.value = false; state.filters = {}; state.write = {}; });
it('requires current state before granting and rejects a stale grant attempt', async () => {
  await expect(updateContributorProfileControl({ ...base, canEditRoadmap: true })).rejects.toMatchObject({ status: 409 });
  state.value = true;
  await expect(updateContributorProfileControl({ ...base, canEditRoadmap: true, expectedCanEditRoadmap: false, expectedProfileStatus: 'active' })).rejects.toMatchObject({ status: 409 });
});
it('preserves omitted grants and clears them when the profile becomes inactive', async () => {
  state.value = true;
  await updateContributorProfileControl(base);
  expect(state.value).toBe(true);
  await updateContributorProfileControl({ ...base, status: 'inactive' });
  expect(state.value).toBe(false);
});
