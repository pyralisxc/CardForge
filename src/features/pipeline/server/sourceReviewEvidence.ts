import { z } from 'zod';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { PipelineRegistryCommandError } from '../lib/pipelineRegistryCommandsError';
import { sourceReviewFactsSchema, sourceReviewSnapshotSchema } from '../lib/sourceReviewEvidence';

function fail(message: string, status = 503): never { throw new PipelineRegistryCommandError(message, status); }
function failure(message?: string): never {
  if (message?.includes('not_found')) fail('The correction revision no longer exists.', 404);
  if (message?.includes('not_permitted')) fail('Source evidence can be recorded only on an intact unpublished correction candidate.', 409);
  if (message?.includes('conflict')) fail('The candidate, published parent or source evidence changed. Your observations are preserved; read the current revision before saving.', 409);
  if (message?.includes('invalid')) fail('Provide a technical trace and mark unknown source facts as unknown.', 400);
  fail('Source evidence could not be confirmed. Keep your observations and retry the same saved request.');
}
const client = () => getSupabaseServerClient() ?? fail('Pipeline is unavailable. Your observations are unchanged.');
export async function readSourceReviewEvidence(submissionId: string) {
  if (!z.string().uuid().safeParse(submissionId).success) fail('Choose an exact correction revision.', 400);
  const { data, error } = await client().rpc('cardforge_read_source_review_evidence', { p_submission_id: submissionId });
  if (error) failure(error.message);
  const parsed = sourceReviewSnapshotSchema.safeParse(data);
  return parsed.success ? parsed.data : fail('The source-evidence snapshot could not be verified.');
}
export async function recordSourceReviewEvidence(submissionId: string, input: unknown, actorId: string) {
  const parsed = z.object({
    facts: sourceReviewFactsSchema, expectedCandidateVersion: z.string().regex(/^[a-f0-9]{32}$/u),
    expectedEvidenceVersion: z.number().int().nonnegative().max(2_147_483_647),
  }).strict().safeParse(input);
  if (!parsed.success || !z.string().uuid().safeParse(submissionId).success) fail('Provide the exact saved evidence snapshot.', 400);
  const { data, error } = await client().rpc('cardforge_record_source_review_evidence', {
    p_submission_id: submissionId, p_facts: parsed.data.facts,
    p_expected_candidate_version: parsed.data.expectedCandidateVersion,
    p_expected_evidence_version: parsed.data.expectedEvidenceVersion, p_actor_id: actorId,
  });
  if (error) failure(error.message);
  const result = sourceReviewSnapshotSchema.safeParse(data);
  return result.success ? result.data : fail('Evidence may have been recorded but its receipt could not be verified. Read this exact revision before changing the request.');
}
