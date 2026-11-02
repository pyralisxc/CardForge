import { fromJsonSchema, type JsonSchemaType } from '@modelcontextprotocol/server';
import { z } from 'zod/v4';
import { observeMcpToolExecution } from '@/features/mcp-usage/server';
import {
  listAgentPipelineSubmissions, inspectAgentPipelineRevision, readAgentPipelineHealth,
  readAgentPipelineEngagement, voteAgentPipelineRevision, heartAgentPipelineLineage,
} from '@/features/pipeline/server';
import {
  pipelineAgentListInput, pipelineAgentExactInput, pipelineAgentVoteInput, pipelineAgentHeartInput,
  pipelineAgentPage, pipelineAgentRevision, pipelineAgentHealth, pipelineAgentEngagement, pipelineAgentMutationReceipt,
} from '@/features/pipeline/server';
import type { registerRevisionRecoveryTools } from './mcpRevisionRecoveryTools';

export function registerPipelineTools({ server, getReadAccess, toolError }: Pick<Parameters<typeof registerRevisionRecoveryTools>[0], 'server' | 'getReadAccess' | 'toolError'>) {
  const tools = [
    { name: 'list_pipeline_submissions', title: 'Find scoped exact Pipeline revisions', input: pipelineAgentListInput, output: pipelineAgentPage,
      description: 'Native paginated discovery with filtered totals, search/type/status and active/trashed/all lifecycle filters. Own requires submission scope; review requires review scope; all is Owner-only. shared-trash is sanitized effective revision-or-catalog Trash for any signed-in viewer, not private drafts. scope shared-trash always selects Trash. No source bytes, email, private notes or authored payloads are returned.', action: listAgentPipelineSubmissions },
    { name: 'get_pipeline_revision', title: 'Inspect one exact visible Pipeline revision', input: pipelineAgentExactInput, output: pipelineAgentRevision,
      description: 'Read exact submission/lineage/revision identity and effective Trash scope, deadline and hold. Applies existing viewer policy; never substitutes a sibling or latest revision. This sanitized read does not certify source bytes, authorize Restore or grant deletion.', action: inspectAgentPipelineRevision },
    { name: 'get_pipeline_content_health', title: 'Read authorized technical Pipeline Content Health', input: z.object({}).strict(), output: pipelineAgentHealth,
      description: 'Contributor review scope required. Read existing technical Content Health and exact authorized dependency findings. Does not return human editorial review packets, private consumers, source payloads or classify technical findings as editorial decisions.', action: readAgentPipelineHealth },
    { name: 'get_pipeline_engagement', title: 'Read exact revision votes and lineage heart', input: pipelineAgentExactInput, output: pipelineAgentEngagement,
      description: 'Read exact current signal, your vote/heart and native eligibility explanations. Votes belong to one revision; hearts belong to its exact lineage. Use before a write and to reconcile uncertain results. Read does not enroll a Contributor profile.', action: readAgentPipelineEngagement },
    { name: 'vote_pipeline_revision', title: 'Like or dislike one eligible exact revision', input: pipelineAgentVoteInput, output: pipelineAgentMutationReceipt,
      description: 'Explicit user-requested positive or negative vote only, through existing Contributor review/self-vote/lifecycle policy and rate limits. Server derives actor. Native RPC remains authoritative. outcome uncertain requires exact engagement readback; never automatically replay. A committed vote stays committed when later readback is unavailable.', action: voteAgentPipelineRevision },
    { name: 'set_pipeline_heart', title: 'Set your heart on one exact visible source lineage', input: pipelineAgentHeartInput, output: pipelineAgentMutationReceipt,
      description: 'Explicitly set hearted true or false, never toggle blindly. Requires exact matching submission and lineage and existing viewer eligibility/rate limits. No new Contributor grant. Uncertain outcome requires engagement readback; committed write plus failed refresh remains committed.', action: heartAgentPipelineLineage },
  ] as const;
  for (const tool of tools) server.registerTool(tool.name, {
    title: tool.title, description: tool.description,
    inputSchema: fromJsonSchema<Record<string, unknown>>(z.toJSONSchema(tool.input, { io: 'input' }) as JsonSchemaType),
    outputSchema: fromJsonSchema<Record<string, unknown>>(z.toJSONSchema(tool.output) as JsonSchemaType),
    // All handlers record the established aggregate usage telemetry.
    annotations: { readOnlyHint: false, destructiveHint: tool.name === 'vote_pipeline_revision' || tool.name === 'set_pipeline_heart', openWorldHint: false },
  }, async input => {
    try {
      const access = await getReadAccess();
      return await observeMcpToolExecution({ ownerUserId: access.user.id, toolName: tool.name, input,
        execute: async () => {
          const receipt = tool.output.parse(await tool.action(access.user.id, input));
          const uncertain = 'outcome' in receipt && receipt.outcome === 'uncertain';
          return { ...(uncertain ? { isError: true } : {}), content: [{ type: 'text' as const, text: JSON.stringify(receipt) }], structuredContent: receipt };
        } });
    } catch (error) { return toolError(error); }
  });
}
