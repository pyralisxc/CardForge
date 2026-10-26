import { getCurrentOwnerAccess } from '@/features/owner/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { parseJsonBodyWithLimit } from '@/infrastructure/http/apiValidation';
import { admitCurrentDeployedRelease } from '@/features/plugin-distribution/server/retainedReleaseAdmission';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Explicit Owner action only. Never called by a deploy or an ordinary download. */
export async function POST(request: Request) {
  try {
    const owner = await getCurrentOwnerAccess();
    if (!owner.isOwner || !owner.userId) return createApiErrorResponse(403,'owner_access_required','Owner access required.');
    const expectedOrigin = process.env.NEXT_PUBLIC_APP_URL;
    if (!expectedOrigin || request.headers.get('origin') !== new URL(expectedOrigin).origin)
      return createApiErrorResponse(403,'owner_access_required','Same-origin Owner request required.');
    const parsed = await parseJsonBodyWithLimit(request);
    if (!parsed.ok) return createApiErrorResponse(parsed.code==='payload_too_large'?413:400,parsed.code,parsed.message);
    const value = parsed.data as Record<string,unknown>;
    if (!value || !['studio','owner'].includes(String(value.product))
      || !['production','preview'].includes(String(value.environment))
      || typeof value.expectedSourceSha !== 'string'
      || Object.keys(value).sort().join() !== 'environment,expectedSourceSha,product')
      return createApiErrorResponse(400,'owner_request_invalid','Exact release selection required.');
    const release=await admitCurrentDeployedRelease(value.product as 'studio'|'owner',
      value.environment as 'production'|'preview', value.expectedSourceSha);
    return createNoStoreJsonResponse({ admitted: true, product: release.product,
      environment: release.environment, version: release.packageVersion,
      sha256: release.checksumSha256, sourceSha: release.sourceSha });
  } catch {
    return createApiErrorResponse(503,'service_unavailable','Verified release admission unavailable; inspect state before retry.');
  }
}
