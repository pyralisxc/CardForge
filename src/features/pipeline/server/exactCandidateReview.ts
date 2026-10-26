import 'server-only';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { PipelineRegistryCommandError } from '../lib/pipelineRegistryCommandsError';
import { verifyExactCandidateSnapshot, type ExactCandidateIdentity } from '../lib/exactCandidateReview';
import { hydratePipelineTemplateAssetReferences } from '../lib/pipelineTemplateAssets';

/** Owner-only immutable candidate handoff; never fallback to the published catalog. */
export async function readExactCandidateReview(expected: ExactCandidateIdentity) {
  const db = getSupabaseServerClient();
  if (!db) throw new PipelineRegistryCommandError('Pipeline reviewer source is unavailable.', 503);
  const { data, error } = await db.from('cardforge_contributor_asset_submissions')
    .select('id,lineage_id,target_registry_asset_id,revision_number,base_revision_number,asset_type,status,published_at,purge_state,trashed_at,source_payload,template_review_context')
    .eq('id', expected.submissionId).maybeSingle();
  if (error) throw new PipelineRegistryCommandError('Exact candidate could not be read.', 503);
  if (!data) throw new PipelineRegistryCommandError('Exact candidate no longer exists.', 404);
  try {
    const result = verifyExactCandidateSnapshot({ submission: data, expected });
    return { ...result, template: hydratePipelineTemplateAssetReferences(result.template) };
  } catch {
    throw new PipelineRegistryCommandError('Candidate revision, base or source digest changed. Reinspect this exact submission.', 409);
  }
}
