import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ inspect: vi.fn(), remove: vi.fn(), activity: vi.fn() }));
vi.mock('@/features/pipeline/server', () => ({ inspectOwnerRevisionDeletion: m.inspect, deleteOwnerRevision: m.remove }));
vi.mock('@/features/owner/server', () => ({ recordOwnerActivity: m.activity }));
vi.mock('@/features/mcp-usage/server', () => ({ observeMcpToolExecution: ({ execute }: { execute: () => unknown }) => execute() }));
import { registerRevisionDeletionTools } from '@/features/studio-documents/server/mcpRevisionDeletionTools';
type Options = Parameters<typeof registerRevisionDeletionTools>[0];
const callbacks = new Map<string, (input: unknown) => Promise<unknown>>();
const config = new Map<string, { annotations: { destructiveHint: boolean }; inputSchema: { '~standard': { validate: (v: unknown) => PromiseLike<{ issues?: unknown[] }> } } }>();
const getAccess = vi.fn(); const toolError = vi.fn((error: unknown) => ({ isError: true, error, content: [{ type: 'text' as const, text: String(error) }] }));
const input = { submissionId: '550e8400-e29b-41d4-a716-446655440000', name: 'Synthetic', storagePath: null };
beforeEach(() => {
  vi.resetAllMocks(); callbacks.clear(); config.clear(); getAccess.mockResolvedValue({ user: { id: 'oauth-owner' } });
  const server = { registerTool: (name: string, schema: unknown, callback: (v: unknown) => Promise<unknown>) => { config.set(name, schema as never); callbacks.set(name, callback); } };
  registerRevisionDeletionTools({ server: server as unknown as Options['server'], getAccess, toolError, publicOrigin: 'http://localhost' });
});
it('routes read-only discovery and exact deletion through authenticated shared owners', async () => {
  m.inspect.mockResolvedValue({ eligible: true, confirmation: input }); m.remove.mockResolvedValue({ outcome: 'committed', deleted: true, warnings: [] });
  await callbacks.get('get_pipeline_revision_deletion')!({ submissionId: input.submissionId });
  expect(m.inspect).toHaveBeenCalledExactlyOnceWith('oauth-owner', input.submissionId);
  expect(await callbacks.get('delete_pipeline_revision_now')!(input)).toMatchObject({ structuredContent: { outcome: 'committed', deleted: true, warnings: ['activity_record_unavailable'] } });
  expect(m.remove).toHaveBeenCalledExactlyOnceWith('oauth-owner', input);
  expect(config.get('get_pipeline_revision_deletion')!.annotations.destructiveHint).toBe(false);
  expect(config.get('delete_pipeline_revision_now')!.annotations.destructiveHint).toBe(true);
});
it('reports unconfirmed deletion without retry and preserves authorization/conflict errors', async () => {
  m.remove.mockRejectedValueOnce(Object.assign(new Error('lost response'), { status: 503 }));
  expect(await callbacks.get('delete_pipeline_revision_now')!(input)).toMatchObject({ isError: true, structuredContent: { deleted: null, outcome: 'uncertain' } });
  expect(m.remove).toHaveBeenCalledOnce();
  for (const status of [403, 409]) {
    const error = Object.assign(new Error('blocked'), { status }); m.remove.mockRejectedValueOnce(error);
    expect(await callbacks.get('delete_pipeline_revision_now')!(input)).toMatchObject({ isError: true, error, content: [{ type: 'text' as const, text: String(error) }] });
  }
});
it('requires exact UUID/name/path and rejects extra authority in its published schema', async () => {
  const schema = config.get('delete_pipeline_revision_now')!.inputSchema['~standard'];
  expect(await schema.validate(input)).not.toHaveProperty('issues');
  for (const invalid of [{ ...input, eligible: true }, { ...input, submissionId: 'other' }, { name: 'Synthetic' }]) expect(await schema.validate(invalid)).toHaveProperty('issues');
});
