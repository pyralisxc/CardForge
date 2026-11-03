import { fromJsonSchema, type JsonSchemaType } from '@modelcontextprotocol/server';
import { z } from 'zod/v4';
import { observeMcpToolExecution } from '@/features/mcp-usage/server';
import { getContributorPipelineDraft, saveContributorPipelineMetadata, finalizeContributorTemplateSubmission, contributorDraftExactInput, contributorDraftWriteInput, contributorDraftSnapshot, contributorDraftMutationResult } from '@/features/pipeline/server';
import type { registerPipelineTools } from './mcpPipelineTools';

export function registerContributorDraftTools({ server, getReadAccess, toolError }: Parameters<typeof registerPipelineTools>[0]) {
  const tools = [
    { name: 'get_contributor_pipeline_draft', title: 'Read an exact authorized Contributor draft', input: contributorDraftExactInput, output: contributorDraftSnapshot, write: false, action: getContributorPipelineDraft,
      description: 'Read your exact Pipeline metadata and native editing/finalization eligibility before any write or retry. Active Contributor submission scope is required. Owner metadata visibility retains existing policy; finalization still requires the original draft owner. No sibling/latest substitution, source payloads or private local document changes.' },
    { name: 'save_contributor_pipeline_metadata', title: 'Save exact Contributor Pipeline metadata', input: contributorDraftWriteInput, output: contributorDraftMutationResult, write: true, action: saveContributorPipelineMetadata,
      description: 'Use only after reading the exact revision. Existing assets.submit, uploader/Owner edit policy and immutable presentation/published/rejected guards apply. No invented CAS/idempotency. Receipt confirms affected row; uncertain requires exact readback and never blind replay. A metadata save does not submit or publish, and never rewrites a private local copy.' },
    { name: 'finalize_contributor_template_submission', title: 'Submit one exact original-owner Template draft', input: contributorDraftWriteInput, output: contributorDraftMutationResult, write: true, action: finalizeContributorTemplateSubmission,
      description: 'Explicitly submit an existing Template draft through native library.submit/original-owner/draft/Template and metadata policy. Read the exact draft first. Semantic classification may commit before submission: metadata_committed_not_submitted lists only retained fields and requires readback. Unknown native outcome stays uncertain, even with observed current state; never automatically replay. Confirmed submitted remains submitted after refresh warnings. No publication, local-copy rewrite, new grant, fabricated CAS or operation ID.' },
  ] as const;
  for (const tool of tools) server.registerTool(tool.name, {
    title: tool.title, description: tool.description,
    inputSchema: fromJsonSchema<Record<string, unknown>>(z.toJSONSchema(tool.input, { io: 'input' }) as JsonSchemaType),
    outputSchema: fromJsonSchema<Record<string, unknown>>(z.toJSONSchema(tool.output) as JsonSchemaType),
    annotations: { readOnlyHint: false, destructiveHint: tool.write, openWorldHint: false },
  }, async input => {
    try {
      const access = await getReadAccess();
      return await observeMcpToolExecution({ ownerUserId: access.user.id, toolName: tool.name, input, execute: async () => {
        const result = tool.output.parse(await tool.action(access.user.id, input));
        const incomplete = 'receipt' in result && ['uncertain', 'metadata_committed_not_submitted'].includes(result.receipt.outcome);
        return { ...(incomplete ? { isError: true } : {}), content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result };
      } });
    } catch (error) { return toolError(error); }
  });
}
