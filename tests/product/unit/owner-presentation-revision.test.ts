import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FOUNDER_PROFILE } from '@/features/public-site/model/founderProfile';
import { DEFAULT_ROADMAP_SETTINGS } from '@/features/roadmap/model/roadmap';
import { DEFAULT_EXPERIENCE_SETTINGS } from '@/features/experience-settings/model/experienceSettings';

const state = vi.hoisted(() => ({ result: { data: null as unknown, error: null as unknown },
  insertResult: { data: null as unknown, error: null as unknown }, eq: vi.fn(), is: vi.fn(), update: vi.fn(), insert: vi.fn() }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({
  getSupabaseServerConfigStatus: () => ({ configured: true }),
  getSupabaseServerClient: () => {
    const query = { eq: (...args: unknown[]) => { state.eq(...args); return query; },
      is: (...args: unknown[]) => { state.is(...args); return query; }, select: () => query,
      maybeSingle: async () => state.result, limit: async () => state.result,
      update: (...args: unknown[]) => { state.update(...args); return query; },
      insert: (...args: unknown[]) => { state.insert(...args); return { select: () => ({ maybeSingle: async () => state.insertResult }) }; } };
    return { from: () => query };
  },
}));
import { updateFounderProfile } from '@/features/public-site/server/founderProfileStore';
import { updateRoadmapSettings } from '@/features/roadmap/server/roadmapSettingsStore';
import { updateRoadmapAdminItemStatus } from '@/features/roadmap/server/roadmapAdminStore';
import { getExperienceSettings, updateExperienceSettings } from '@/features/experience-settings/server/experienceSettingsStore';

const revision = '2026-10-14T00:00:00Z';
const { updatedAt: _updatedAt, ...founder } = DEFAULT_FOUNDER_PROFILE;
beforeEach(() => { vi.clearAllMocks(); state.result = { data: null, error: null }; state.insertResult = { data: null, error: null }; });
describe('Owner presentation concurrency', () => {
  it('rejects incomplete roadmap replacement before writing defaults', async () => {
    await expect(updateRoadmapSettings({ updatedAt: revision, maxActiveUserRoadmapItems: 30 })).rejects.toMatchObject({ status: 400 });
    expect(state.update).not.toHaveBeenCalled();
  });
  it('guards roadmap settings and official status with the initiating revision', async () => {
    state.result.data = [];
    await expect(updateRoadmapSettings({ ...DEFAULT_ROADMAP_SETTINGS, updatedAt: revision })).rejects.toMatchObject({ status: 409 });
    expect(state.eq).toHaveBeenCalledWith('updated_at', revision);
    state.result.data = null;
    await expect(updateRoadmapAdminItemStatus({ itemId: 'official-fixture', status: 'testing', expectedUpdatedAt: revision })).rejects.toMatchObject({ status: 409 });
    expect(state.eq).toHaveBeenCalledWith('source', 'official');
  });
  it('returns the committed roadmap row rather than rereading all items', async () => {
    state.result.data = { id: 'official-fixture', title: 'Fixture', status: 'testing', source: 'official', updated_at: '2026-10-14T00:00:03Z' };
    expect(await updateRoadmapAdminItemStatus({ itemId: 'official-fixture', status: 'testing', expectedUpdatedAt: revision })).toMatchObject({ status: 'testing', updatedAt: '2026-10-14T00:00:03Z' });
  });
  it('rejects a stale founder write without creating or overwriting a profile', async () => {
    await expect(updateFounderProfile(founder, revision)).rejects.toMatchObject({ status: 409 });
    expect(state.eq).toHaveBeenCalledWith('updated_at', revision);
    expect(state.insert).not.toHaveBeenCalled();
  });
  it('creates a missing default-backed profile once and rejects concurrent creation', async () => {
    state.insertResult = { data: null, error: { code: '23505' } };
    await expect(updateFounderProfile(founder, null)).rejects.toMatchObject({ status: 409 });
    expect(state.is).toHaveBeenCalledWith('updated_at', null);
    expect(state.insert).toHaveBeenCalledTimes(1);
  });
  it('returns the actual database founder revision after commit', async () => {
    state.result.data = { updated_at: '2026-10-14T00:00:01Z' };
    expect(await updateFounderProfile(founder, revision)).toMatchObject({ heroHeadline: founder.heroHeadline, updatedAt: '2026-10-14T00:00:01Z' });
  });
  it('refuses missing experience revision before writing', async () => {
    await expect(updateExperienceSettings({ ...DEFAULT_EXPERIENCE_SETTINGS })).rejects.toMatchObject({ status: 409 });
    expect(state.update).not.toHaveBeenCalled();
  });
  it('rejects stale experience edits and never treats a read failure as defaults', async () => {
    state.result.data = [];
    await expect(updateExperienceSettings({ ...DEFAULT_EXPERIENCE_SETTINGS, updatedAt: revision })).rejects.toMatchObject({ status: 409 });
    expect(state.eq).toHaveBeenCalledWith('updated_at', revision);
    state.result.error = { message: 'database unavailable' };
    await expect(getExperienceSettings()).rejects.toMatchObject({ status: 503 });
  });
  it('returns the committed experience values and shared-row revision', async () => {
    state.result.data = [{ updated_at: '2026-10-14T00:00:02Z', presentation_contrast: 'high' }];
    expect(await updateExperienceSettings({ ...DEFAULT_EXPERIENCE_SETTINGS, updatedAt: revision, presentationContrast: 'high' }))
      .toMatchObject({ presentationContrast: 'high', updatedAt: '2026-10-14T00:00:02Z' });
  });
});
