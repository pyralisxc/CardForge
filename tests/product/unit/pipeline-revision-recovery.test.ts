import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ access: vi.fn(), contribution: vi.fn(), db: vi.fn(), rpc: vi.fn() }));
vi.mock('@/features/account/server', () => ({ getAccountToolAccessForUserId: m.access }));
vi.mock('@/features/contributor-access/server', () => ({ getContributorCapabilities: m.contribution,
  hasContributionScope: (scopes: string[], scope: string) => scopes.includes(scope) }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: m.db }));
import { readRevisionRecovery, changeRevisionRecovery } from '@/features/pipeline/server/revisionRecovery';
import { revisionRecoveryCommandSchema } from '@/features/pipeline/lib/revisionRecoveryContract';

const id = '550e8400-e29b-41d4-a716-446655440000';
const state = { scope: 'revision' as const, submissionId: id, lineageId: '550e8400-e29b-41d4-a716-446655440001',
  revisionNumber: 2, registrySubmissionId: '550e8400-e29b-41d4-a716-446655440002', revisionHighWater: 4, recoveryVersion: '2',
  status: 'archived' as const, updatedAt: '2026-10-31T17:00:00+00:00', trashedAt: '2026-10-31T17:00:00+00:00',
  purgeAfter: '2026-11-30T17:00:00+00:00', held: false };
const snapshot = { name: 'Exact retained history', state, retentionDays: 30, trashActor: 'contributor', trashReasons: ['revision_already_trashed'],
  restoreReasons: [], canHold: false, publicationRetained: true };
beforeEach(() => {
  vi.resetAllMocks();
  m.access.mockResolvedValue({ isOwner: false, user: { id: 'native-account-id' } });
  m.contribution.mockResolvedValue({ active: true, scopes: ['assets.submit'] });
  m.db.mockReturnValue({ rpc: m.rpc }); m.rpc.mockResolvedValue({ data: snapshot, error: null });
});
describe('exact revision recovery boundaries', () => {
  it('resolves authoritative account identity and leaves exact ownership to the native row check', async () => {
    expect(await readRevisionRecovery('oauth-session', id)).toEqual(snapshot);
    expect(m.rpc).toHaveBeenCalledExactlyOnceWith('cardforge_read_revision_recovery', {
      p_submission_id: id, p_actor_user_id: 'native-account-id', p_is_owner: false,
    });
  });
  it('rejects inactive or unscoped contributors before private reads', async () => {
    for (const capabilities of [{ active: false, scopes: ['assets.submit'] }, { active: true, scopes: [] }]) {
      m.contribution.mockResolvedValue(capabilities);
      await expect(readRevisionRecovery('other', id)).rejects.toMatchObject({ status: 403 });
    }
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it('allows Owner recovery across contributor accounts and forbids Contributor holds', async () => {
    await expect(changeRevisionRecovery('contributor', { action: 'hold', expected: state, held: true })).rejects.toMatchObject({ status: 403 });
    expect(m.rpc).not.toHaveBeenCalled();
    m.access.mockResolvedValue({ isOwner: true, user: { id: 'native-owner' } });
    m.rpc.mockResolvedValue({ data: { ...snapshot, state: { ...state, recoveryVersion: '3', held: true }, canHold: true }, error: null });
    await changeRevisionRecovery('owner', { action: 'hold', expected: state, held: true });
    expect(m.rpc).toHaveBeenCalledExactlyOnceWith('cardforge_change_revision_recovery', {
      p_actor_user_id: 'native-owner', p_is_owner: true, p_action: 'hold', p_expected: state, p_held: true,
    });
  });
  it('retains immutable archived history and a newer current pointer on restore', async () => {
    m.rpc.mockResolvedValue({ data: { ...snapshot, state: { ...state, recoveryVersion: '3', trashedAt: null, purgeAfter: null } }, error: null });
    expect(await changeRevisionRecovery('session', { action: 'restore', expected: state })).toMatchObject({ state: {
      status: 'archived', registrySubmissionId: state.registrySubmissionId, revisionHighWater: 4, trashedAt: null,
    } });
    expect(m.rpc).toHaveBeenCalledOnce();
  });
  it.each([
    ['revision_recovery_not_permitted', 403], ['revision_recovery_not_found', 404],
    ['revision_recovery_state_changed', 409], ['revision_recovery_blocked', 409],
    ['revision_recovery_already_claimed', 409], ['revision_recovery_inventory_unavailable', 503],
    ['transport lost', 503],
  ])('preserves %s as a distinct boundary without retry', async (message, status) => {
    m.rpc.mockResolvedValue({ data: null, error: { message } });
    await expect(changeRevisionRecovery('session', { action: 'restore', expected: state })).rejects.toMatchObject({ status });
    expect(m.rpc).toHaveBeenCalledOnce();
  });
  it('does not confirm malformed receipts, republishing, or changed lineage/current identity', async () => {
    for (const result of [null, { ...snapshot, state: { ...state, status: 'published', trashedAt: null } },
      { ...snapshot, state: { ...state, registrySubmissionId: null, trashedAt: null } },
      { ...snapshot, state: { ...state, revisionHighWater: 5, trashedAt: null } }]) {
      m.rpc.mockResolvedValue({ data: result, error: null });
      await expect(changeRevisionRecovery('session', { action: 'restore', expected: state })).rejects.toMatchObject({ status: 503 });
    }
  });
  it('accepts no caller actor, dependency proof, lineage action or wrong Trash epoch shape', () => {
    const input = { action: 'restore', expected: state };
    expect(revisionRecoveryCommandSchema.safeParse(input).success).toBe(true);
    for (const invalid of [{ ...input, isOwner: true }, { ...input, dependenciesClear: true },
      { ...input, expected: { ...state, scope: 'lineage' } }, { ...input, expected: { ...state, trashedAt: null } }]) {
      expect(revisionRecoveryCommandSchema.safeParse(invalid).success).toBe(false);
    }
  });
});
