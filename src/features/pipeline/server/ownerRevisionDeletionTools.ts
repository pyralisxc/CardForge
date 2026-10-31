import { z } from 'zod';
import { getAccountToolAccessForUserId } from '@/features/account/server';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { PipelineRegistryCommandError } from '../lib/pipelineRegistryCommandsError';
import { deleteOneTrashedPipelineRevision, RevisionDeleteError } from './ownerRevisionDeletion';
import { revalidateCardForgeCatalog } from './catalogCache';

export const revisionDeleteConfirmationSchema = z.object({
  submissionId: z.string().uuid(), name: z.string().min(1), storagePath: z.string().min(1).nullable(),
}).strict();
const rowSchema = z.object({
  id: z.string().uuid(), name: z.string(), lineage_id: z.string().uuid().nullable(), status: z.string(),
  source_storage_path: z.string().nullable(), source_storage_bucket: z.string().nullable(),
  trashed_at: z.string().nullable(), published_at: z.string().nullable(), retention_hold: z.boolean(),
  purge_state: z.string().nullable(), purge_claim_token: z.string().nullable(), purge_claimed_at: z.string().nullable(), owner_purge_requested_at: z.string().nullable(),
});
async function owner(actorUserId: string) {
  const access = await getAccountToolAccessForUserId(actorUserId);
  if (!access.isOwner) throw new PipelineRegistryCommandError('Owner access is required.', 403, 'owner_access_required');
  return access;
}
const unavailable = () => new PipelineRegistryCommandError('Exact revision deletion state is unavailable. Do not infer permission or retry deletion.', 503, 'revision_delete_unavailable');

// Discovery only. The native claim repeats all authoritative checks under locks;
// this observation is never accepted as deletion authority.
export async function inspectOwnerRevisionDeletion(actorUserId: string, submissionId: string) {
  await owner(actorUserId);
  if (!z.string().uuid().safeParse(submissionId).success) throw new PipelineRegistryCommandError('Choose an exact submission UUID.', 400, 'revision_delete_invalid');
  const db = getSupabaseServerClient(); if (!db) throw unavailable();
  const result = await db.from('cardforge_contributor_asset_submissions').select('id,name,lineage_id,status,source_storage_path,source_storage_bucket,trashed_at,published_at,retention_hold,purge_state,purge_claim_token,purge_claimed_at,owner_purge_requested_at').eq('id', submissionId).maybeSingle();
  if (result.error) throw unavailable();
  if (!result.data) return { submissionId, present: false, eligible: false, reasons: ['revision_absent'], confirmation: null };
  const parsed = rowSchema.safeParse(result.data); if (!parsed.success || parsed.data.id !== submissionId) throw unavailable();
  const s = parsed.data;
  const [registry, events, lineage] = await Promise.all([
    db.from('cardforge_asset_registry').select('id').eq('contributor_submission_id', submissionId).limit(1),
    db.from('cardforge_pipeline_publication_events').select('published_submission_id').eq('published_submission_id', submissionId).limit(1),
    db.from('cardforge_pipeline_asset_lineages').select('id,catalog_trashed_at,purge_state').eq('id', s.lineage_id ?? '').maybeSingle(),
  ]);
  if (registry.error || events.error || lineage.error || !Array.isArray(registry.data) || !Array.isArray(events.data)) throw unavailable();
  const l = z.object({ id: z.string().uuid(), catalog_trashed_at: z.string().nullable(), purge_state: z.string().nullable() }).safeParse(lineage.data);
  const reasons: string[] = [];
  if (!l.success || l.data.id !== s.lineage_id) reasons.push('lineage_unavailable');
  else if (l.data.catalog_trashed_at || l.data.purge_state) reasons.push('catalog_recovery_or_worker_active');
  if (s.status !== 'archived' || !s.trashed_at || !Number.isFinite(Date.parse(s.trashed_at))) reasons.push('not_trashed_archived_revision');
  if (s.published_at || registry.data.length || events.data.length) reasons.push('publication_history_retained');
  if (s.retention_hold) reasons.push('retention_hold');
  if (s.purge_state || s.purge_claim_token || s.purge_claimed_at || s.owner_purge_requested_at) reasons.push('destructive_attempt_requires_reconciliation');
  if ((s.source_storage_bucket === null) !== (s.source_storage_path === null)) reasons.push('source_identity_incomplete');
  return { submissionId, present: true, eligible: reasons.length === 0, reasons,
    confirmation: { submissionId, name: s.name, storagePath: s.source_storage_path } };
}

export async function deleteOwnerRevision(actorUserId: string, input: unknown) {
  await owner(actorUserId);
  const parsed = revisionDeleteConfirmationSchema.safeParse(input);
  if (!parsed.success) throw new PipelineRegistryCommandError('Exact submission UUID, name and storage path are required.', 400, 'revision_delete_invalid');
  // No preflight Boolean or caller-supplied eligibility reaches the native claim.
  try { await deleteOneTrashedPipelineRevision(parsed.data); } catch (error) {
    if (error instanceof RevisionDeleteError) throw error;
    throw new RevisionDeleteError(503, 'Deletion outcome is unconfirmed. Inspect retained claim and Storage state before any further action.');
  }
  const warnings: string[] = [];
  try { revalidateCardForgeCatalog(); } catch { warnings.push('catalog_refresh_unavailable'); }
  return { submissionId: parsed.data.submissionId, deleted: true as const, outcome: 'committed' as const, warnings };
}
