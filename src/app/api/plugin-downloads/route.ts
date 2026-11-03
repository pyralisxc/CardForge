import { RetainedReleaseReadError } from '@/features/plugin-distribution/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { buildCurrentPlugin, buildStudioReviewerPacket, pluginDownloadAccess } from '@/features/plugin-distribution/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const product = url.searchParams.get('product');
  const environment = url.searchParams.get('environment');
  if ((product !== 'studio' && product !== 'owner') || (environment !== 'preview' && environment !== 'production'))
    return createApiErrorResponse(400, 'owner_request_invalid', 'Select a supported plugin and environment.');
  try {
    const access = await pluginDownloadAccess(product, environment);
    if (access !== 200) return createApiErrorResponse(access, access === 401 ? 'sign_in_required' : 'account_tool_not_permitted', access === 401 ? 'Sign in to access this package.' : 'Your account cannot access this package.');
    if (url.searchParams.get('history') === '1' || url.searchParams.has('releaseVersion')) {
      // Optional retained-release path: checked by the same product/environment
      // role gate above. No upload, publication or historical reconstruction.
      const { handleRetainedReleaseRequest } = await import('@/features/plugin-distribution/server/retainedReleaseHttp');
      return await handleRetainedReleaseRequest(url, product, environment);
    }
    const release = await buildCurrentPlugin(product, environment);
    const { bytes, ...detail } = release;
    if (url.searchParams.get('packet') === '1') {
      if (product !== 'studio') return createApiErrorResponse(400, 'owner_request_invalid', 'A public reviewer packet is available only for Studio.');
      if (url.searchParams.get('version') !== release.version) return createApiErrorResponse(409, 'owner_operations_conflict', 'The package version changed. Refresh before downloading the packet.');
      const packet = await buildStudioReviewerPacket(environment, release.version);
      return new Response(packet, { headers: { 'Content-Type':'text/markdown; charset=utf-8', 'Content-Disposition': 'attachment; filename="cardforge-studio-review-' + environment + '-' + release.version + '.md"', 'Cache-Control':'private, no-store, max-age=0', 'X-Content-Type-Options':'nosniff' } });
    }
    const wantsBytes = url.searchParams.get('download') === '1';
    if (!wantsBytes) return createNoStoreJsonResponse({ latest: detail, previous: [] });
    // Exact checksum guards changing deployments and prohibits disguised old-release downloads.
    if (url.searchParams.get('sha256') !== release.checksum)
      return createApiErrorResponse(409, 'owner_operations_conflict', 'This package has changed. Reload the latest release.');
    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="' + release.filename + '"',
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
        'X-Checksum-SHA256': release.checksum,
      },
    });
  } catch (error) {
    if (error instanceof RetainedReleaseReadError && error.status === 404) return createApiErrorResponse(404, 'service_unavailable', 'The verified release is not available.');
    return createApiErrorResponse(503, 'service_unavailable', 'Verified plugin artifact is unavailable.');
  }
}
