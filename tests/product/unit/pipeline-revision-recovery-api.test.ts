import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ access: vi.fn(), read: vi.fn(), change: vi.fn(), refresh: vi.fn() }));
vi.mock('@/features/pipeline/server', async () => ({ ...(await import('@/features/pipeline/lib/pipelineRegistryCommandsError')),
  ...(await import('@/features/pipeline/lib/pipelineStoreError')), getCurrentPipelineRequestAccess: m.access,
  readRevisionRecovery: m.read, changeRevisionRecovery: m.change, revalidateCardForgeCatalog: m.refresh }));
vi.mock('@/features/account/server', () => ({ AccountToolAccessError: class extends Error { constructor(public status: number) { super(); } } }));
import { GET, POST } from '@/app/api/pipeline/[submissionId]/lifecycle/route';
import { PipelineStoreError } from '@/features/pipeline/lib/pipelineStoreError';
import { PipelineRegistryCommandError } from '@/features/pipeline/lib/pipelineRegistryCommandsError';
const context = { params: Promise.resolve({ submissionId: 'exact-revision' }) };
const input = { action: 'restore', expected: { submissionId: 'exact-revision' } };
const post = (body: unknown) => POST(new Request('http://localhost/lifecycle', { method: 'POST', body: JSON.stringify(body) }), context);
beforeEach(() => { vi.resetAllMocks(); m.access.mockResolvedValue({ user: { id: 'session-account' } }); });
it('uses session identity for browser reads and mutations', async () => {
  m.read.mockResolvedValue({ state: 'observed' }); m.change.mockResolvedValue({ state: 'restored' });
  expect((await GET(new Request('http://localhost'), context)).status).toBe(200);
  expect(m.read).toHaveBeenCalledExactlyOnceWith('session-account', 'exact-revision');
  expect(await (await post(input)).json()).toEqual({ state: 'restored' });
  expect(m.change).toHaveBeenCalledExactlyOnceWith('session-account', input); expect(m.refresh).toHaveBeenCalledOnce();
});
it('rejects route mismatch and malformed input before the native boundary', async () => {
  for (const body of [null, {}, { expected: { submissionId: 'other' } }]) expect((await post(body)).status).toBe(400);
  expect(m.change).not.toHaveBeenCalled();
});
it('does not convert auth, private denial, conflicts or provider failure into recovery success', async () => {
  m.access.mockRejectedValueOnce(new PipelineStoreError('Sign in', 401));
  expect((await post(input)).status).toBe(401);
  for (const status of [403, 404, 409, 503]) {
    m.change.mockRejectedValueOnce(new PipelineRegistryCommandError('blocked', status));
    expect((await post(input)).status).toBe(status);
  }
  expect(m.change).toHaveBeenCalledTimes(4); expect(m.refresh).not.toHaveBeenCalled();
});
