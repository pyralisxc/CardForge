import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ access: vi.fn(), db: vi.fn(), remove: vi.fn(), activity: vi.fn(), refresh: vi.fn() }));
vi.mock('@/features/account/server', () => ({ getAccountToolAccessForUserId: m.access }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: m.db }));
vi.mock('@/features/owner/server', () => ({ recordOwnerActivity: m.activity }));
vi.mock('@/features/pipeline/server/ownerRevisionDeletion', () => ({ deleteOneTrashedPipelineRevision: m.remove, RevisionDeleteError: class extends Error { constructor(public status: 409 | 503, message: string) { super(message); } } }));
vi.mock('@/features/pipeline/server/catalogCache', () => ({ revalidateCardForgeCatalog: m.refresh }));
import { RevisionDeleteError } from '@/features/pipeline/server/ownerRevisionDeletion';
import { deleteOwnerRevision, inspectOwnerRevisionDeletion } from '@/features/pipeline/server/ownerRevisionDeletionTools';
const id = '550e8400-e29b-41d4-a716-446655440000';
const lineage = '550e8400-e29b-41d4-a716-446655440001';
const input = { submissionId: id, name: 'Synthetic exact revision', storagePath: 'synthetic/source.png' };
const initial = { id, name: input.name, lineage_id: lineage, status: 'archived', source_storage_path: input.storagePath, source_storage_bucket: 'cardforge-contributor-assets', trashed_at: '2026-10-30T00:00:00Z', published_at: null, retention_hold: false, purge_state: null, purge_claim_token: null, purge_claimed_at: null, owner_purge_requested_at: null, contributor_lifecycle_state: null, revision_publication_retained: false };
function database(row: unknown = initial, overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = { cardforge_contributor_asset_submissions: row, cardforge_asset_registry: [], cardforge_pipeline_publication_events: [], cardforge_pipeline_asset_lineages: { id: lineage, catalog_trashed_at: null, purge_state: null }, ...overrides };
  const from = vi.fn((table: string) => { const q = { select: vi.fn(() => q), eq: vi.fn(() => q), limit: vi.fn(async () => ({ data: values[table], error: null })), maybeSingle: vi.fn(async () => ({ data: values[table], error: null })) }; return q; });
  m.db.mockReturnValue({ from }); return from;
}
beforeEach(() => { vi.resetAllMocks(); m.access.mockResolvedValue({ isOwner: true, email: 'owner@example.invalid' }); database(); });
describe('exact Owner deletion discovery and command', () => {
  it('denies a non-Owner before any state read or destructive command', async () => {
    m.access.mockResolvedValue({ isOwner: false });
    await expect(inspectOwnerRevisionDeletion('other', id)).rejects.toMatchObject({ status: 403 });
    await expect(deleteOwnerRevision('other', input)).rejects.toMatchObject({ status: 403 });
    expect(m.db).not.toHaveBeenCalled(); expect(m.remove).not.toHaveBeenCalled();
  });
  it('returns exact observed name/path without claiming or deleting', async () => {
    expect(await inspectOwnerRevisionDeletion('owner', id)).toEqual({ submissionId: id, present: true, eligible: true, reasons: [], confirmation: input });
    expect(m.remove).not.toHaveBeenCalled();
  });
  it.each([
    [{ published_at: '2026-10-01T00:00:00Z' }, 'publication_history_retained'],
    [{ contributor_lifecycle_state: 'retired' }, 'publication_history_retained'],
    [{ revision_publication_retained: true }, 'publication_history_retained'],
    [{ status: 'voting' }, 'not_trashed_archived_revision'], [{ retention_hold: true }, 'retention_hold'],
    [{ purge_claim_token: 'retained-attempt' }, 'destructive_attempt_requires_reconciliation'],
    [{ source_storage_bucket: null }, 'source_identity_incomplete'],
  ])('keeps existing blocked state in discovery', async (patch, reason) => {
    database({ ...initial, ...patch });
    expect(await inspectOwnerRevisionDeletion('owner', id)).toMatchObject({ eligible: false, reasons: [reason] });
  });
  it('keeps registry and historical publication references blocked, and missing rows unconfirmed', async () => {
    for (const table of ['cardforge_asset_registry', 'cardforge_pipeline_publication_events']) {
      database(initial, { [table]: [{ id }] }); expect(await inspectOwnerRevisionDeletion('owner', id)).toMatchObject({ eligible: false, reasons: ['publication_history_retained'] });
    }
    database(null); expect(await inspectOwnerRevisionDeletion('owner', id)).toMatchObject({ present: false, eligible: false, reasons: ['revision_absent'] });
  });
  it('validates exact input and never accepts caller eligibility or a generic path deletion', async () => {
    for (const value of [{ ...input, submissionId: 'not-uuid' }, { ...input, eligible: true }, { storagePath: input.storagePath }]) await expect(deleteOwnerRevision('owner', value)).rejects.toMatchObject({ status: 400 });
    expect(m.remove).not.toHaveBeenCalled();
  });
  it('uses native exact claim and returns a committed receipt', async () => {
    expect(await deleteOwnerRevision('owner', input)).toEqual({ submissionId: id, deleted: true, outcome: 'committed', warnings: [] });
    expect(m.remove).toHaveBeenCalledExactlyOnceWith(input);
  });
  it('preserves changed state or uncertain native outcomes and never records false success', async () => {
    for (const status of [409, 503]) {
      m.remove.mockRejectedValueOnce(new RevisionDeleteError(status as 409 | 503, 'unconfirmed'));
      await expect(deleteOwnerRevision('owner', input)).rejects.toMatchObject({ status });
    }
    expect(m.activity).not.toHaveBeenCalled(); expect(m.refresh).not.toHaveBeenCalled();
  });
});

it('rejects malformed or unavailable discovery instead of reporting an eligible row', async () => {
  database({ id }); await expect(inspectOwnerRevisionDeletion('owner', id)).rejects.toMatchObject({ status: 503 });
  m.db.mockReturnValue(null); await expect(inspectOwnerRevisionDeletion('owner', id)).rejects.toMatchObject({ status: 503 });
});

it('retains catalog-lineage and prior-worker fences in discovery', async () => {
  for (const patch of [{ catalog_trashed_at: '2026-10-30T00:00:00Z' }, { purge_state: 'pending' }]) {
    database(initial, { cardforge_pipeline_asset_lineages: { id: lineage, catalog_trashed_at: null, purge_state: null, ...patch } });
    expect(await inspectOwnerRevisionDeletion('owner', id)).toMatchObject({ eligible: false, reasons: ['catalog_recovery_or_worker_active'] });
  }
});
it('classifies unknown transport loss as uncertain and keeps refresh failures committed', async () => {
  m.remove.mockRejectedValueOnce(new Error('response lost'));
  await expect(deleteOwnerRevision('owner', input)).rejects.toMatchObject({ status: 503 });
  expect(m.activity).not.toHaveBeenCalled();
  m.refresh.mockImplementationOnce(() => { throw new Error('refresh unavailable'); });
  expect(await deleteOwnerRevision('owner', input)).toMatchObject({ deleted: true, outcome: 'committed', warnings: ['catalog_refresh_unavailable'] });
});
