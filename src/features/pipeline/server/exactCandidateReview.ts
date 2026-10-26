import 'server-only';
import { createHash } from 'node:crypto';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { PipelineRegistryCommandError } from '../lib/pipelineRegistryCommandsError';
import { verifyExactCandidateSnapshot, verifyExactCandidatePublishedBase, type ExactCandidateIdentity } from '../lib/exactCandidateReview';
import { PIPELINE_STORAGE_BUCKET } from '../lib/pipelineUploadPolicy';
import { embedExactCandidateAssets } from './exactCandidateAssets';

/** Owner route only; no catalog fallback, writes, tokens or persisted render cache. */
export async function readExactCandidateReview(expected: ExactCandidateIdentity) {
  const db = getSupabaseServerClient();
  if (!db) throw new PipelineRegistryCommandError('Pipeline reviewer source is unavailable.', 503);
  async function readPinned() {
    const { data, error } = await db!.from('cardforge_contributor_asset_submissions')
      .select('id,lineage_id,target_registry_asset_id,revision_number,base_revision_number,asset_type,status,published_at,purge_state,trashed_at,source_payload,template_review_context')
      .eq('id', expected.submissionId).maybeSingle();
    if (error) throw new PipelineRegistryCommandError('Exact candidate could not be read.', 503);
    if (!data) throw new PipelineRegistryCommandError('Exact candidate no longer exists.', 404);
    const result = verifyExactCandidateSnapshot({ submission: data, expected });
    const base = await db!.rpc('cardforge_read_template_review_base', { p_asset_id: expected.assetId });
    if (base.error) throw new PipelineRegistryCommandError('Published base is unavailable.', 503);
    verifyExactCandidatePublishedBase(expected, base.data?.expectedBase);
    return result;
  }
  try {
    const result = await readPinned();
    const template = await embedExactCandidateAssets(result.template, async hash => {
      const { data, error } = await db.storage.from(PIPELINE_STORAGE_BUCKET).download(`template-assets/${hash}.webp`);
      if (error || !data) throw new Error('candidate_asset_unavailable');
      return new Uint8Array(await data.arrayBuffer());
    });
    await readPinned(); // Reject a changed candidate/base during hydration.
    return { ...result, template, hydratedSha256: createHash('sha256').update(JSON.stringify(template)).digest('hex') };
  } catch (error) {
    if (error instanceof PipelineRegistryCommandError) throw error;
    throw new PipelineRegistryCommandError('Exact candidate, base or media cannot be verified. Reinspect this submission; unsupported dependencies must be resolved before export.', 409);
  }
}
