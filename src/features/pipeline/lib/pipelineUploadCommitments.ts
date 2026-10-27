import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { PipelineStoreError } from './pipelineStoreError';

export const isReservedPipelineUploadPath = (value: string): boolean =>
  /^pipeline-owned-v1\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/source\.(?:png|jpg|webp|cfsvg|woff2?|ttf|otf|cardforge)$/u.test(value);
export const isPipelineUploadToken = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(value);

type UploadCommand = 'cardforge_reserve_pipeline_upload' | 'cardforge_prepare_pipeline_upload_submission'
  | 'cardforge_commit_pipeline_upload_submission' | 'cardforge_claim_pipeline_upload_cleanup'
  | 'cardforge_finalize_pipeline_upload_cleanup';

/** Native lineage authority, not a retry loop. Unreadable outcomes retain bytes. */
export async function runPipelineUploadCommand(command: UploadCommand, args: Record<string, unknown>): Promise<unknown> {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new PipelineStoreError('Pipeline upload ownership is unavailable.', 503);
  let result;
  try { result = await supabase.rpc(command, args); } catch {
    throw new PipelineStoreError('The upload operation could not be confirmed. Its source has been retained.', 503);
  }
  if (result.error) {
    const reason = result.error.message;
    if (reason === 'pipeline_upload_not_permitted') throw new PipelineStoreError('This source belongs to another Contributor.', 403);
    if (reason === 'pipeline_upload_submission_uncertain') {
      throw new PipelineStoreError('Submission is still running or its outcome is uncertain. Keep this upload for reconciliation.', 503);
    }
    if (['pipeline_upload_legacy_uncertainty', 'pipeline_upload_identity_conflict', 'pipeline_upload_prior_commitment',
      'pipeline_upload_cleanup_committed', 'pipeline_upload_cleanup_blocked', 'pipeline_upload_history_retained'].includes(reason)) {
      throw new PipelineStoreError('This source has an existing or unverified ownership/cleanup commitment. It cannot be reused or removed as unfinished.', 409);
    }
    throw new PipelineStoreError('Pipeline upload ownership is temporarily unavailable. Keep this upload for reconciliation.', 503);
  }
  if (result.data === null || result.data === undefined) throw new PipelineStoreError('The upload receipt could not be confirmed. Its source has been retained.', 503);
  return result.data;
}
