import { z } from 'zod';
import { getAccountToolAccessForUserId } from '@/features/account/server';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { catalogTrashCommandSchema, catalogTrashSnapshotSchema } from '../lib/catalogTrashContract';
import { PipelineRegistryCommandError } from '../lib/pipelineRegistryCommandsError';


async function ownerDatabase(actorUserId: string) {
  // actorUserId must come from the HTTP/Studio OAuth session, never request JSON.
  const access = await getAccountToolAccessForUserId(actorUserId);
  if (!access.isOwner) throw new PipelineRegistryCommandError('Owner access is required.', 403, 'catalog_trash_not_permitted');
  const db = getSupabaseServerClient();
  if (!db) throw new PipelineRegistryCommandError('Catalog recovery is unavailable.', 503, 'catalog_trash_unavailable');
  return db;
}

function nativeError(error: { message?: string; code?: string }) {
  const code = error.message?.match(/catalog_trash_(?:identity_changed|already_claimed|dependency_blocked|held|not_found|state_changed|window_elapsed|inventory_unavailable)/)?.[0];
  const status = code === 'catalog_trash_not_found' ? 404
    : code === 'catalog_trash_inventory_unavailable' || !code ? 503 : 409;
  return new PipelineRegistryCommandError(
    code ? `Catalog recovery blocked: ${code}. Refresh the exact catalog state.`
      : 'Catalog recovery could not be confirmed. Read its state before retrying.',
    status, code ?? 'catalog_trash_unavailable',
  );
}

export async function readCatalogTrash(actorUserId: string, submissionId: string) {
  const db = await ownerDatabase(actorUserId);
  if (!z.string().uuid().safeParse(submissionId).success) {
    throw new PipelineRegistryCommandError('Choose an exact Pipeline submission.', 400, 'catalog_trash_invalid');
  }
  const {data, error} = await db.rpc('cardforge_read_catalog_trash', {p_submission_id:submissionId});
  if (error) throw nativeError(error);
  const result = catalogTrashSnapshotSchema.safeParse(data);
  if (!result.success || result.data.state.identity.submissionId !== submissionId) {
    throw new PipelineRegistryCommandError('Catalog recovery state is unavailable.', 503, 'catalog_trash_unavailable');
  }
  return result.data;
}

export async function changeCatalogTrash(actorUserId: string, input: unknown) {
  const db = await ownerDatabase(actorUserId);
  const command = catalogTrashCommandSchema.safeParse(input);
  if (!command.success) throw new PipelineRegistryCommandError('Provide the exact observed catalog recovery state.', 400, 'catalog_trash_invalid');
  const {action, expected} = command.data;
  // The native command owns dependency checks, retention policy and locks. A
  // successful JavaScript preflight is deliberately not sent as mutation proof.
  const {data, error} = await db.rpc('cardforge_change_catalog_trash', {
    p_actor_user_id:actorUserId, p_action:action, p_expected:expected,
    p_held:action === 'hold' ? command.data.held : null,
  });
  if (error) throw nativeError(error);
  const receipt = catalogTrashSnapshotSchema.safeParse(data);
  const identity = receipt.success ? receipt.data.state.identity : null;
  if (!receipt.success || !identity ||
    Object.keys(expected.identity).some(key => identity[key as keyof typeof identity] !== expected.identity[key as keyof typeof identity]) ||
    (action === 'trash' && !receipt.data.state.trashedAt) ||
    (action === 'restore' && receipt.data.state.trashedAt !== null) ||
    (action === 'hold' && (receipt.data.state.held !== command.data.held ||
      receipt.data.state.trashedAt !== expected.trashedAt || receipt.data.state.purgeAfter !== expected.purgeAfter))) {
    throw new PipelineRegistryCommandError('Catalog recovery result is unconfirmed. Read its state before retrying.', 503, 'catalog_trash_unconfirmed');
  }
  return receipt.data;
}
