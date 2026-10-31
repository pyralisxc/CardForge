import { fromJsonSchema } from '@modelcontextprotocol/server';
import { readRevisionRecovery, changeRevisionRecovery, revalidateCardForgeCatalog } from '@/features/pipeline/server';
import type { RevisionRecoveryCommand } from '@/features/pipeline/server';
import { observeMcpToolExecution } from '@/features/mcp-usage/server';
import type { registerAccountWorkflowTools } from './mcpAccountWorkflowTools';

export function registerRevisionRecoveryTools({ server, getAccess, toolError }: Parameters<typeof registerAccountWorkflowTools>[0]) {
  const run = async (name: string, input: unknown, action: (actorUserId: string) => Promise<unknown>) => {
    try {
      const access = await getAccess();
      return await observeMcpToolExecution({ ownerUserId: access.user.id, toolName: name, input, execute: async () => {
        const result = await action(access.user.id);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result as Record<string, unknown> };
      } });
    } catch (error) { return toolError(error); }
  };
  server.registerTool('get_pipeline_revision_recovery', {
    title: 'Inspect exact Pipeline revision recovery',
    description: 'Owner or exact original Contributor only. Read revision-scoped identity, current pointer, high-water, Trash epoch, source uncertainty and recovery blockers. Metadata recovery does not prove source bytes are present. Does not grant deletion authority or reveal another Contributor’s private work. Catalog-lineage recovery is separate.',
    inputSchema: fromJsonSchema<{ submissionId: string }>({ type: 'object', additionalProperties: false, required: ['submissionId'], properties: { submissionId: { type: 'string', format: 'uuid' } } }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, input => run('get_pipeline_revision_recovery', input, actor => readRevisionRecovery(actor, input.submissionId)));
  server.registerTool('change_pipeline_revision_recovery', {
    title: 'Trash, restore or hold one exact Pipeline revision',
    description: 'Use the exact state from get_pipeline_revision_recovery. Contributors may Trash their own exact work and Restore only their own contributor-origin Trash; Owner moderation and holds remain authoritative. Restore retains immutable archived records and never republishes or replaces a newer live revision. Trash does not remove files or publication history; it does not certify existing source bytes. This tool cannot permanently delete, activate expiry or alter independent copies. After conflict or an uncertain response read state before another action.',
    inputSchema: fromJsonSchema<RevisionRecoveryCommand>({ type: 'object', additionalProperties: false, required: ['action', 'expected'], properties: {
      action: { type: 'string', enum: ['trash', 'restore', 'hold'] }, held: { type: 'boolean' },
      expected: { type: 'object', additionalProperties: false,
        required: ['scope','submissionId','lineageId','revisionNumber','registrySubmissionId','revisionHighWater','recoveryVersion','status','updatedAt','trashedAt','purgeAfter','held'], properties: {
          scope: { type: 'string', const: 'revision' }, submissionId: { type: 'string', format: 'uuid' }, lineageId: { type: 'string', format: 'uuid' },
          revisionNumber: { type: ['integer','null'], minimum: 0 }, registrySubmissionId: { type: ['string','null'], format: 'uuid' },
          revisionHighWater: { type: 'integer', minimum: 0 }, status: { type: 'string', enum: ['draft','submitted','voting','publish_candidate','published','archived','rejected'] },
          recoveryVersion: { type: 'string', pattern: '^(0|[1-9][0-9]*)$', maxLength: 19 },
          updatedAt: { type: 'string', format: 'date-time' }, trashedAt: { type: ['string','null'], format: 'date-time' },
          purgeAfter: { type: ['string','null'], format: 'date-time' }, held: { type: 'boolean' },
        } },
    } }),
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  }, input => run('change_pipeline_revision_recovery', input, async actor => {
    const result = await changeRevisionRecovery(actor, input);
    revalidateCardForgeCatalog();
    return result;
  }));
}
