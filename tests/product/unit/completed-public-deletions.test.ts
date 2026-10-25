import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: () => ({ rpc: mocks.rpc }) }));
import { handleCompletedPublicDeletions } from '@/features/pipeline/server/completedPublicDeletions';
const base = 'https://staging.supabase.co';
const url = `${base}/storage/v1/object/public/art/source.svg`;
const request = (urls: unknown) => new Request('http://localhost/api/catalog/completed-deletions', { method: 'POST', body: JSON.stringify({ urls }) });
beforeEach(() => { vi.stubEnv('SUPABASE_URL', base); mocks.rpc.mockReset(); });
afterEach(() => vi.unstubAllEnvs());
it('returns only requested managed public URLs backed by exact completed digests', async () => {
  const hash = createHash('sha256').update(url).digest('hex');
  mocks.rpc.mockResolvedValue({ data: [hash, 'unrequested'], error: null });
  const response = await handleCompletedPublicDeletions(request([url, 'https://external.example/original.svg', `${base}/storage/v1/object/sign/art/private.svg`]));
  expect(await response.json()).toEqual({ deletedUrls: [url] });
  expect(mocks.rpc).toHaveBeenCalledWith('cardforge_completed_public_deletions', { p_fingerprints: [hash] });
});
it('reports an unavailable evidence source without asserting deletion', async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { message: 'Unavailable' } });
  expect((await handleCompletedPublicDeletions(request([url]))).status).toBe(503);
});
it('bounds requests and does not query evidence for nonmanaged references', async () => {
  expect((await handleCompletedPublicDeletions(request(Array(257).fill(url)))).status).toBe(400);
  expect(await (await handleCompletedPublicDeletions(request(['https://external.example/art.svg']))).json()).toEqual({ deletedUrls: [] });
  expect(mocks.rpc).not.toHaveBeenCalled();
});
