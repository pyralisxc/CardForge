import { createHash } from 'node:crypto';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { parseJsonBodyWithLimit } from '@/infrastructure/http/apiValidation';

/** Public facts only: never return a tombstone, private URL, or prepared intent. */
export async function handleCompletedPublicDeletions(request: Request) {
  const body = await parseJsonBodyWithLimit(request, 128 * 1024);
  if (!body.ok) return createApiErrorResponse(body.code === 'payload_too_large' ? 413 : 400, body.code, body.message);
  const urls = (body.data as { urls?: unknown } | null)?.urls;
  if (!Array.isArray(urls) || urls.length > 256 || urls.some((url) => typeof url !== 'string' || url.length > 4096)) {
    return createApiErrorResponse(400, 'pipeline_request_invalid', 'Supply at most 256 asset URLs.');
  }
  const supabase = getSupabaseServerClient();
  const base = process.env.SUPABASE_URL?.replace(/\/$/u, '');
  if (!supabase || !base) return createApiErrorResponse(503, 'pipeline_unavailable', 'Deletion evidence is unavailable.');
  // A matching path on an external host is not a managed object we deleted.
  const managed = [...new Set(urls as string[])].filter((url) => url.startsWith(`${base}/storage/v1/object/public/`));
  if (!managed.length) return createNoStoreJsonResponse({ deletedUrls: [] });
  const byHash = new Map(managed.map((url) => [createHash('sha256').update(url).digest('hex'), url]));
  const { data, error } = await supabase.rpc('cardforge_completed_public_deletions', { p_fingerprints: [...byHash.keys()] });
  if (error || !Array.isArray(data)) return createApiErrorResponse(503, 'pipeline_unavailable', 'Deletion evidence is unavailable.');
  return createNoStoreJsonResponse({ deletedUrls: data.flatMap((hash: unknown) => typeof hash === 'string' && byHash.has(hash) ? [byHash.get(hash)!] : []) });
}
