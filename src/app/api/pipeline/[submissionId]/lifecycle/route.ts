import { parseJsonBodyWithLimit } from '@/infrastructure/http/apiValidation';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { AccountToolAccessError, getCurrentAccountToolAccess } from '@/features/account/server';
import { getCurrentPipelineRequestAccess, PipelineRegistryCommandError, PipelineStoreError,
  readRevisionRecovery, changeRevisionRecovery, revalidateCardForgeCatalog, REVISION_RECOVERY_NEXT_ACTION } from '@/features/pipeline/server';

export const dynamic = 'force-dynamic';
const failure = (error: unknown) => {
  const status = error instanceof PipelineRegistryCommandError || error instanceof PipelineStoreError || error instanceof AccountToolAccessError ? error.status : 503;
  return createApiErrorResponse(status, status === 401 ? 'sign_in_required' : status === 403 ? 'revision_recovery_not_permitted'
    : status === 404 ? 'revision_recovery_not_found' : status === 409 ? 'revision_recovery_conflict' : status === 400 ? 'revision_recovery_invalid' : 'revision_recovery_unavailable',
  error instanceof Error ? error.message : 'Revision recovery is unavailable. Read its state before another action.',
  status === 409 || status >= 500 ? { retryable: false, nextAction: REVISION_RECOVERY_NEXT_ACTION } : undefined);
};

export async function GET(_request: Request, { params }: { params: Promise<{ submissionId: string }> }) {
  try {
    const access = await getCurrentAccountToolAccess();
    return createNoStoreJsonResponse(await readRevisionRecovery(access.user.id, (await params).submissionId));
  } catch (error) { return failure(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ submissionId: string }> }) {
  try {
    const access = await getCurrentPipelineRequestAccess();
    const { submissionId } = await params;
    const parsed = await parseJsonBodyWithLimit(request, 16_384);
    if (!parsed.ok) return createApiErrorResponse(parsed.code === 'payload_too_large' ? 413 : 400, parsed.code, parsed.message);
    const input = parsed.data as { expected?: { submissionId?: unknown } } | null;
    if (input?.expected?.submissionId !== submissionId) return createApiErrorResponse(400, 'revision_recovery_invalid', 'Route and exact revision identities must match.');
    const result = await changeRevisionRecovery(access.user.id, input);
    revalidateCardForgeCatalog();
    return createNoStoreJsonResponse(result);
  } catch (error) { return failure(error); }
}
