import { beforeEach, describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: () => ({ rpc: f.rpc, from: f.from }) }));
import { getSharedPipelineTrashPage } from '@/features/pipeline/lib/pipelineLibraryStore';
const id = '10000000-0000-4000-8000-000000000001';
const metadata = { catalogTrashedAt: null, catalogPurgeAfter: null, catalogRetentionHold: false, catalogSubmissionId: null, id, lineageId: '20000000-0000-4000-8000-000000000001', assetType: 'icons', name: 'Shared Trash', description: 'Shared description', status: 'archived', revisionNumber: 1, trashedAt: '2026-11-01T00:00:00Z', purgeAfter: '2026-12-01T00:00:00Z', trashActorRole: 'owner', trashPreviousStatus: 'published', publicationRetained: true, positiveVotes: 1, negativeVotes: 2, ownedByViewer: true };
beforeEach(() => { vi.resetAllMocks(); f.rpc.mockResolvedValue({ data: [{ submission_id: id, total_count: 1, shared_metadata: metadata }], error: null }); f.from.mockImplementation(() => { throw new Error('Shared discovery must not load private submission payloads'); }); });
describe('shared Trash native metadata projection', () => {
 it('uses the atomic native metadata and exact paging without private payload hydration', async () => {
  const result = await getSharedPipelineTrashPage('free-viewer', { page: 2, pageSize: 12 });
  expect(f.rpc).toHaveBeenCalledWith('cardforge_list_contributor_asset_submission_ids', expect.objectContaining({ p_current_user_id: 'free-viewer', p_scope: 'shared', p_trash_state: 'trashed', p_page: 2, p_page_size: 12 }));
  expect(result.items).toEqual([metadata]); expect(f.from).not.toHaveBeenCalled();
  expect(result).toMatchObject({ total: 1, page: 2, pageSize: 12 });
 });
 it.each([{ ...metadata, source_payload: { private: true } }, { ...metadata, id: '10000000-0000-4000-8000-000000000002' }, { ...metadata, status: 'draft' }, { ...metadata, trashPreviousStatus: null, publicationRetained: false }])('refuses incompatible, private or unproven metadata', async invalid => {
  f.rpc.mockResolvedValue({ data: [{ submission_id: id, total_count: 1, shared_metadata: invalid }], error: null });
  await expect(getSharedPipelineTrashPage('free-viewer')).rejects.toMatchObject({ status: 503 }); expect(f.from).not.toHaveBeenCalled();
 });
 it('accepts a sanitized legacy publication observation without origin or a private timestamp field', async () => {
  const legacy = { ...metadata, publicationRetained: true, trashPreviousStatus: null, trashActorRole: null };
  f.rpc.mockResolvedValue({ data: [{ submission_id: id, total_count: 1, shared_metadata: legacy }], error: null });
  expect((await getSharedPipelineTrashPage('free-viewer')).items).toEqual([legacy]);
  expect(f.from).not.toHaveBeenCalled();
 });
 it('accepts catalog-only Trash without inventing revision Trash or a restore grant', async () => {
  const catalog = { ...metadata, status: 'published', trashedAt: null, purgeAfter: null, trashActorRole: null, trashPreviousStatus: null,
   catalogTrashedAt: metadata.trashedAt, catalogPurgeAfter: metadata.purgeAfter, catalogRetentionHold: false, catalogSubmissionId: id };
  f.rpc.mockResolvedValue({ data: [{ submission_id: id, total_count: 1, shared_metadata: catalog }], error: null });
  expect((await getSharedPipelineTrashPage('free-viewer')).items).toEqual([catalog]);
  expect(f.from).not.toHaveBeenCalled();
  const submitted = { ...catalog, status: 'submitted', publicationRetained: false };
  f.rpc.mockResolvedValue({ data: [{ submission_id: id, total_count: 1, shared_metadata: submitted }], error: null });
  expect((await getSharedPipelineTrashPage('free-viewer')).items).toEqual([submitted]);
 });
 it('retains count on an empty requested page and distinguishes unavailable output from empty', async () => {
  f.rpc.mockResolvedValue({ data: [{ submission_id: null, total_count: 1, shared_metadata: null }], error: null });
  expect(await getSharedPipelineTrashPage('free-viewer', { page: 99 })).toEqual({ items: [], total: 1, page: 99, pageSize: 12 });
  f.rpc.mockResolvedValue({ data: [], error: null }); await expect(getSharedPipelineTrashPage('free-viewer')).rejects.toMatchObject({ status: 503 });
 });
});
