import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { buildCurrentPlugin, pluginDownloadAccess, type PluginEnvironment, type PluginProduct } from '@/features/plugin-distribution/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const product = url.searchParams.get('product');
  const environment = url.searchParams.get('environment');
  if ((product !== 'studio' && product !== 'owner') || (environment !== 'preview' && environment !== 'production'))
    return createApiErrorResponse(400, 'plugin_download_invalid', 'Select a supported plugin and environment.');
  try {
    const access = await pluginDownloadAccess(product, environment);
    if (access !== 200) return createApiErrorResponse(access, access === 401 ? 'sign_in_required' : 'plugin_download_forbidden', access === 401 ? 'Sign in to access this package.' : 'Your account cannot access this package.');
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
