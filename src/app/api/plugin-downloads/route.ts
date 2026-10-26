import { getCurrentOwnerAccess } from '@/features/owner/server';
import { getCurrentContributorAccess } from '@/features/contributor-access/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { buildCurrentPlugin, type PluginEnvironment, type PluginProduct } from '@/features/plugin-distribution/server/pluginReleases';
import { mayDownloadPlugin } from '@/features/plugin-distribution/model/downloadPolicy';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function authorized(product: PluginProduct, environment: PluginEnvironment) {
  if (mayDownloadPlugin(product, environment, false, false)) return true;
  const owner = await getCurrentOwnerAccess();
  if (mayDownloadPlugin(product, environment, Boolean(owner.isOwner && owner.userId), false)) return true;
  if (product === 'owner') return false;
  try { await getCurrentContributorAccess(); return mayDownloadPlugin(product, environment, false, true); }
  catch (error) {
    if (error && typeof error === 'object' && 'status' in error && (error.status === 401 || error.status === 403)) return false;
    throw error;
  }
}
export async function GET(request: Request) {
  const url = new URL(request.url);
  const product = url.searchParams.get('product');
  const environment = url.searchParams.get('environment');
  if ((product !== 'studio' && product !== 'owner') || (environment !== 'preview' && environment !== 'production'))
    return createApiErrorResponse(400, 'plugin_download_invalid', 'Select a supported plugin and environment.');
  try {
    if (!await authorized(product, environment)) return createApiErrorResponse(403, 'plugin_download_forbidden', 'Your account cannot access this package.');
    const release = await buildCurrentPlugin(product, environment);
    const { bytes, ...detail } = release;
    const wantsBytes = url.searchParams.get('download') === '1';
    if (!wantsBytes) return createNoStoreJsonResponse({ latest: detail, previous: [] });
    // Exact checksum guards changing deployments and prohibits disguised old-release downloads.
    if (url.searchParams.get('sha256') !== release.checksum)
      return createApiErrorResponse(409, 'plugin_release_changed', 'This package has changed. Reload the latest release.');
    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="' + release.filename + '"',
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
        'X-Checksum-SHA256': release.checksum,
      },
    });
  } catch {
    return createApiErrorResponse(503, 'plugin_release_unavailable', 'Verified plugin artifact is unavailable.');
  }
}
