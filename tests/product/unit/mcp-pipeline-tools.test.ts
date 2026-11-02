import { beforeEach, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
const f = vi.hoisted(() => ({ list: vi.fn(), inspect: vi.fn(), health: vi.fn(), read: vi.fn(), vote: vi.fn(), heart: vi.fn() }));
vi.mock('@/features/pipeline/server', async () => ({ ...(await import('@/features/pipeline/lib/pipelineAgentContract')), listAgentPipelineSubmissions: f.list, inspectAgentPipelineRevision: f.inspect, readAgentPipelineHealth: f.health, readAgentPipelineEngagement: f.read, voteAgentPipelineRevision: f.vote, heartAgentPipelineLineage: f.heart }));
vi.mock('@/features/mcp-usage/server', () => ({ observeMcpToolExecution: ({ execute }: { execute: () => unknown }) => execute() }));
import { registerPipelineTools } from '@/features/studio-documents/server/mcpPipelineTools';
import { pipelineAgentPage, pipelineAgentEngagement, pipelineAgentMutationReceipt, pipelineAgentRevision, pipelineAgentHealth } from '@/features/pipeline/lib/pipelineAgentContract';
type Options = Parameters<typeof registerPipelineTools>[0];
const callbacks = new Map<string, (input: Record<string, unknown>) => Promise<unknown>>();
const schemas = new Map<string, { inputSchema: { '~standard': { validate: (input: unknown) => PromiseLike<{ issues?: unknown }> } }; outputSchema: unknown }>();
const access = vi.fn();
const id = '10000000-0000-4000-8000-000000000001', lineageId = '20000000-0000-4000-8000-000000000001';
const engagement = { submissionId: id, lineageId, name: 'Exact', revisionNumber: 1, status: 'published', trashedAt: null, purgeState: null, positiveVotes: 1, negativeVotes: 0, currentUserVote: 'positive', voteIssue: null, heart: { count: 2, hearted: true }, heartIssue: null };
const receipt = { submissionId: id, lineageId, outcome: 'committed', engagement, warnings: [], nextAction: 'Read exact engagement before any further write; never retry an uncertain mutation automatically.' };
beforeEach(() => {
  vi.resetAllMocks(); callbacks.clear(); schemas.clear(); access.mockResolvedValue({ user: { id: 'oauth-actor' } });
  registerPipelineTools({ server: { registerTool: (name: string, schema: never, callback: never) => { schemas.set(name, schema); callbacks.set(name, callback); } } as unknown as Options['server'], getReadAccess: access, toolError: error => ({ isError: true, content: [{ type: 'text', text: String(error) }] }) });
});
it('registers exactly six explicit input/output contracts and rejects caller authority', async () => {
  expect(callbacks.size).toBe(6);
  for (const [name, schema] of schemas) {
    expect(schema.outputSchema, name).toBeDefined();
    const input = name === 'list_pipeline_submissions' || name === 'get_pipeline_content_health' ? {} : name === 'set_pipeline_heart' ? { submissionId: id, lineageId, hearted: true } : name === 'vote_pipeline_revision' ? { submissionId: id, voteValue: 'positive' } : { submissionId: id };
    expect(await schema.inputSchema['~standard'].validate(input), name).not.toHaveProperty('issues');
    expect(await schema.inputSchema['~standard'].validate({ ...input, isOwner: true, actorUserId: 'forged' }), name).toHaveProperty('issues');
  }
});
it('uses fresh OAuth read access, validates actual output and preserves uncertain mutation receipts', async () => {
  f.read.mockResolvedValue(engagement); f.vote.mockResolvedValue({ ...receipt, outcome: 'uncertain', engagement: null }); f.heart.mockResolvedValue(receipt);
  const read = await callbacks.get('get_pipeline_engagement')!({ submissionId: id });
  expect(read).toMatchObject({ structuredContent: engagement });
  expect(f.read).toHaveBeenCalledExactlyOnceWith('oauth-actor', { submissionId: id });
  expect(await callbacks.get('vote_pipeline_revision')!({ submissionId: id, voteValue: 'positive' })).toMatchObject({ isError: true, structuredContent: { outcome: 'uncertain', engagement: null } });
  access.mockResolvedValue({ user: { id: 'changed-actor' } });
  await callbacks.get('set_pipeline_heart')!({ submissionId: id, lineageId, hearted: false });
  expect(f.heart).toHaveBeenCalledExactlyOnceWith('changed-actor', { submissionId: id, lineageId, hearted: false });
  f.read.mockResolvedValue({ ...engagement, privatePayload: 'must not leak' });
  expect(await callbacks.get('get_pipeline_engagement')!({ submissionId: id })).toMatchObject({ isError: true });
});
it('published schemas are JSON serializable and sanitize contract boundaries', () => {
  for (const schema of [pipelineAgentPage, pipelineAgentEngagement, pipelineAgentMutationReceipt, pipelineAgentRevision, pipelineAgentHealth]) expect(z.toJSONSchema(schema).additionalProperties).toBe(false);
});
