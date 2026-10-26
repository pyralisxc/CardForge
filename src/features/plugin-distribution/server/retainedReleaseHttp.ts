import 'server-only';
import { createNoStoreJsonResponse, createApiErrorResponse } from '@/infrastructure/http/apiResponses';
import { createRetainedReleaseStore } from './retainedReleaseStore';
import { listRetainedReleases, readRetainedRelease } from './retainedReleaseCommands';

type Product = 'studio' | 'owner';
type Environment = 'production' | 'preview';
const endpointFor = (product: Product, environment: Environment) =>
  (environment === 'preview' ? 'https://card-forge-git-vercel-preview-pyralis-projects.vercel.app' : 'https://cardforges.com')
  + (product === 'owner' ? '/mcp/owner' : '/mcp');

/** Must only be entered AFTER pluginDownloadAccess in the HTTP route. */
export async function handleRetainedReleaseRequest(url: URL, product: Product, environment: Environment): Promise<Response> {
  const store = createRetainedReleaseStore();
  if (url.searchParams.get('history') === '1' && !url.searchParams.has('releaseVersion')) {
    const rows = await listRetainedReleases(store, product, environment);
    return createNoStoreJsonResponse({ previous: rows.map(row => ({
      name: `cardforge-${row.product}${row.environment === 'preview' ? '-preview' : ''}`,
      version: row.packageVersion, checksum: row.checksumSha256,
      environment: row.environment, sourceSha: row.sourceSha, byteLength: row.byteLength,
      releasedAt: row.releasedAt, changes: row.changes,
    })) });
  }
  const version = url.searchParams.get('releaseVersion');
  const sha = url.searchParams.get('sha256');
  if (!version || !/^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)
      || !sha || !/^[a-f0-9]{64}$/.test(sha) || url.searchParams.get('download') !== '1') {
    return createApiErrorResponse(400, 'owner_request_invalid', 'Select an exact retained version and checksum.');
  }
  const row = await store.find(product, environment, version);
  if (!row || row.checksumSha256 !== sha) {
    return createApiErrorResponse(404, 'service_unavailable', 'The verified release is not available.');
  }
  // Historical data may be missing or altered. Never rebuild from today's source.
  const bytes = await readRetainedRelease(store, row, endpointFor(product, environment));
  const name = `cardforge-${product}${environment === 'preview' ? '-preview' : ''}`;
  return new Response(new Uint8Array(bytes), { headers: {
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="${name}-${version}.zip"`,
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'X-Checksum-SHA256': sha,
  } });
}
