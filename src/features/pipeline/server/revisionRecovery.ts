import { z } from 'zod';
import { getAccountToolAccessForUserId } from '@/features/account/server';
import { getContributorCapabilities, readContributorCapabilities, hasContributionScope } from '@/features/contributor-access/server';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { PipelineRegistryCommandError } from '../lib/pipelineRegistryCommandsError';
import { revisionRecoveryCommandSchema, revisionRecoverySnapshotSchema } from '../lib/revisionRecoveryContract';
import { RevisionRecoveryError } from '../lib/revisionRecoveryError';

async function actorDatabase(actorUserId: string, ensureContribution = false) {
  const access = await getAccountToolAccessForUserId(actorUserId);
  if (!access.isOwner) {
    const contribution = await (ensureContribution ? getContributorCapabilities(access) : readContributorCapabilities(access));
    if (!contribution.active || !hasContributionScope(contribution.scopes, 'assets.submit')) {
      throw new PipelineRegistryCommandError('Active Contributor access is required.', 403, 'revision_recovery_not_permitted');
    }
  }
  const db = getSupabaseServerClient();
  if (!db) throw unavailable();
  return { db, isOwner: access.isOwner, actorUserId: access.user.id };
}

function unavailable() {
  return new RevisionRecoveryError('Revision recovery is unavailable. Read its state before another action.', 503, 'revision_recovery_unavailable');
}
function nativeError(error: { message?: string; code?: string }) {
  const code = error.message?.match(/revision_recovery_(?:not_permitted|not_found|state_changed|blocked|already_claimed|inventory_unavailable)/)?.[0];
  const status = code === 'revision_recovery_not_permitted' ? 403 : code === 'revision_recovery_not_found' ? 404
    : code === 'revision_recovery_inventory_unavailable' || !code ? 503 : 409;
  return new RevisionRecoveryError(code ? `Revision recovery blocked: ${code}. Refresh its exact state.`
    : 'Revision recovery outcome is unconfirmed. Read its state before another action.', status, code ?? 'revision_recovery_unavailable');
}
function receipt(data: unknown, submissionId: string) {
  const result = revisionRecoverySnapshotSchema.safeParse(data);
  if (!result.success || result.data.state.submissionId !== submissionId) throw unavailable();
  return result.data;
}

export async function readRevisionRecovery(actorUserId: string, submissionId: string) {
  if (!z.string().uuid().safeParse(submissionId).success) {
    throw new PipelineRegistryCommandError('Choose an exact revision UUID.', 400, 'revision_recovery_invalid');
  }
  const actor = await actorDatabase(actorUserId);
  const { data, error } = await actor.db.rpc('cardforge_read_revision_recovery', {
    p_submission_id: submissionId, p_actor_user_id: actor.actorUserId, p_is_owner: actor.isOwner,
  });
  if (error) throw nativeError(error);
  return receipt(data, submissionId);
}

export async function changeRevisionRecovery(actorUserId: string, input: unknown) {
  const parsed = revisionRecoveryCommandSchema.safeParse(input);
  if (!parsed.success) throw new PipelineRegistryCommandError('Provide the exact observed revision state.', 400, 'revision_recovery_invalid');
  const actor = await actorDatabase(actorUserId, true);
  if (parsed.data.action === 'hold' && !actor.isOwner) {
    throw new PipelineRegistryCommandError('Owner access is required to change a retention hold.', 403, 'revision_recovery_not_permitted');
  }
  const { action, expected } = parsed.data;
  let response;
  try { response = await actor.db.rpc('cardforge_change_revision_recovery', {
    p_actor_user_id: actor.actorUserId, p_is_owner: actor.isOwner, p_action: action,
    p_expected: expected, p_held: action === 'hold' ? parsed.data.held : null,
  }); } catch { throw unavailable(); }
  const { data, error } = response;
  if (error) throw nativeError(error);
  const result = receipt(data, expected.submissionId);
  if (result.state.lineageId !== expected.lineageId || result.state.revisionNumber !== expected.revisionNumber
    || result.state.registrySubmissionId !== expected.registrySubmissionId || result.state.revisionHighWater !== expected.revisionHighWater
    || BigInt(result.state.recoveryVersion) <= BigInt(expected.recoveryVersion)
    || (action === 'trash' && !result.state.trashedAt)
    || (action === 'restore' && (result.state.trashedAt !== null || result.state.status !== 'archived'))
    || (action === 'hold' && (result.state.held !== parsed.data.held || result.state.trashedAt !== expected.trashedAt))) throw unavailable();
  return result;
}
