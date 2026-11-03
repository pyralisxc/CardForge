import { AccountToolAccessError } from '@/features/account/server';
import { PipelineRegistryCommandError } from '@/features/pipeline/server';
import { getCurrentOwnerAccess, getOwnerPipelineStudioRouting, saveOwnerPipelineStudioRouting } from '@/features/owner/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
export const dynamic = 'force-dynamic';
const failure = (error: unknown) => {
  const status = error instanceof PipelineRegistryCommandError || error instanceof AccountToolAccessError ? error.status : error instanceof SyntaxError ? 400 : 503;
  return createApiErrorResponse(status, status === 403 ? 'owner_access_required' : status === 400 ? 'owner_request_invalid' : 'pipeline_unavailable', error instanceof PipelineRegistryCommandError || error instanceof AccountToolAccessError ? error.message : 'Studio placement outcome is unconfirmed. Read the exact asset before any further write.', { retryable: false, nextAction: 'Read exact asset routing; do not replay automatically or infer commit from matching state.' });
};
export async function GET(request: Request) {
  try {
    const owner = await getCurrentOwnerAccess(); if (!owner.isOwner || !owner.userId) return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required for the Studio Map.');
    const params = new URL(request.url).searchParams;
    const input: Record<string, unknown> = {};
    for (const name of ['assetId','destination','query','page','pageSize']) if (params.has(name)) input[name] = name === 'page' || name === 'pageSize' ? Number(params.get(name)) : params.get(name);
    return createNoStoreJsonResponse(await getOwnerPipelineStudioRouting(owner.userId, input));
  } catch (error) { return failure(error); }
}
export async function PUT(request: Request) {
  try {
    const owner = await getCurrentOwnerAccess(); if (!owner.isOwner || !owner.userId) return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required for the Studio Map.');
    const result = await saveOwnerPipelineStudioRouting(owner.userId, await request.json());
    if (result.receipt.outcome === 'uncertain') {
      const unavailable = createApiErrorResponse(503, 'pipeline_unavailable', result.receipt.warnings.join(' '), { retryable: false, nextAction: 'Read exact asset routing; do not replay automatically.' });
      return createNoStoreJsonResponse({ ...(await unavailable.json()), ...result }, { status: 503, headers: unavailable.headers });
    }
    return createNoStoreJsonResponse({ ok: true, ...result });
  } catch (error) { return failure(error); }
}
