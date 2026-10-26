import { getCurrentOwnerAccess } from '@/features/owner/server';
import { readExactCandidateReview } from '@/features/pipeline/server';
import { exactCandidateIdentitySchema } from '@/features/pipeline/lib/exactCandidateReview';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const owner = await getCurrentOwnerAccess();
  if (!owner.isOwner || !owner.userId) return createApiErrorResponse(403, 'owner_access_required', 'Owner review access required.');
  let body: unknown;
  try { body = await request.json(); }
  catch { return createApiErrorResponse(400, 'candidate_invalid', 'Provide an exact candidate identity.'); }
  const parsed = exactCandidateIdentitySchema.safeParse(body);
  if (!parsed.success) return createApiErrorResponse(400, 'candidate_invalid', 'Provide exact submission, lineage, revision and source digest pins.');
  try { return createNoStoreJsonResponse(await readExactCandidateReview(parsed.data)); }
  catch (error) {
    const status = error && typeof error === 'object' && 'status' in error
      ? Number(error.status) : 503;
    return createApiErrorResponse(status === 404 || status === 409 ? status : 503,
      status === 404 ? 'candidate_not_found' : status === 409 ? 'candidate_conflict' : 'candidate_unavailable',
      status === 409 ? 'The exact candidate changed. Refresh its identity before rendering.' : 'Candidate review is unavailable.');
  }
}
