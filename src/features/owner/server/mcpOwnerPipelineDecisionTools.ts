import { fromJsonSchema, type JsonSchemaType } from '@modelcontextprotocol/server';
import { z } from 'zod/v4';
import { observeMcpToolExecution } from '@/features/mcp-usage/server';
import { getOwnerPipelineSourceReviewEvidence, recordOwnerPipelineSourceReviewEvidence, getOwnerPipelineEditorialReview, saveOwnerPipelineEditorialReview, getOwnerPipelinePublicationDecision, saveOwnerPipelinePublicationOverride } from './ownerPipelineDecisionCommands';
import {
  ownerPipelineExactInput, ownerPipelineEvidenceInput, ownerPipelineEditorialInput, ownerPipelinePublicationInput, ownerPipelineEvidenceSnapshot, ownerPipelineEditorialSnapshot, ownerPipelinePublicationSnapshot, ownerPipelineEvidenceResult, ownerPipelineEditorialResult, ownerPipelinePublicationResult,
} from '@/features/pipeline/server';
import type { registerOwnerReadTools } from './mcpOwnerTools';

export function registerOwnerPipelineDecisionTools({ server, getAccess, toolError }: Pick<Parameters<typeof registerOwnerReadTools>[0], 'server' | 'getAccess' | 'toolError'>) {
  const tools = [
    { name: 'get_pipeline_source_review_evidence', title: 'Read exact Owner source-review evidence', input: ownerPipelineExactInput, output: ownerPipelineEvidenceSnapshot, write: false, action: getOwnerPipelineSourceReviewEvidence,
      description: 'Owner only. Read the exact correction candidate version and evidence version before recording observations. Private rights/creator/trace evidence remains private; a hash or parent revision does not establish authorship, rights or AI provenance. No sibling/latest substitution.' },
    { name: 'record_pipeline_source_review_evidence', title: 'Record exact Owner source-review observations', input: ownerPipelineEvidenceInput, output: ownerPipelineEvidenceResult, write: true, action: recordOwnerPipelineSourceReviewEvidence,
      description: 'Owner only. Record explicit reviewed facts with the exact candidateVersion/evidenceVersion previously read. Unknown facts stay null. Public AI text requires explicit opt-in and actual AI-use text. This does not approve or publish content and never replaces inherited source statements. Conflict requires fresh review; uncertain outcome requires exact evidence readback, never blind replay.' },
    { name: 'get_pipeline_editorial_review', title: 'Read exact editorial state and canonical quality criteria', input: ownerPipelineExactInput, output: ownerPipelineEditorialSnapshot, write: false, action: getOwnerPipelineEditorialReview,
      description: 'Owner only. Read one exact revision, source-evidence version and the same versioned role-specific quality standard as the browser. Technical validity and votes do not constitute editorial approval. Read actual render/source evidence before a human editorial decision.' },
    { name: 'save_pipeline_editorial_review', title: 'Save an explicit Owner editorial decision', input: ownerPipelineEditorialInput, output: ownerPipelineEditorialResult, write: true, action: saveOwnerPipelineEditorialReview,
      description: 'Owner only. Explicit reviewed decision and reason through native quality-standard/evidence-version policy. Use the supported expectedEvidenceVersion from the read; do not invent an operation ID or general CAS. Native rebalance and registry synchronization may change publication/visibility under existing rules, so obtain explicit authority for the consequential decision. Never infer approval from technical Health. Committed remains committed after follow-up failures; uncertain requires exact readback, not replay.' },
    { name: 'get_pipeline_publication_decision', title: 'Read exact Owner publication controls and current pointer', input: ownerPipelineExactInput, output: ownerPipelinePublicationSnapshot, write: false, action: getOwnerPipelinePublicationDecision,
      description: 'Owner only. Read exact revision/current publication pointer, override, tier and decision note. updatedAt is observation only: this existing native command has no general timestamp CAS. Read does not authorize publication, retirement or deletion.' },
    { name: 'save_pipeline_publication_override', title: 'Save an explicit exact Owner publication or access override', input: ownerPipelinePublicationInput, output: ownerPipelinePublicationResult, write: true, action: saveOwnerPipelinePublicationOverride,
      description: 'Owner only, consequential. After explicit review/approval, change only the selected submission using existing native publication, reason, current-pointer, hold and lifecycle guards. Omitted overrides remain unchanged; null removes that override. No new CAS/operation-ID guarantee. Never publish implicitly or select latest/sibling. Unknown outcomes require exact readback before any further write; confirmed commits must not be repeated after refresh/activity warnings. Cannot purge or activate expiry.' },
  ] as const;
  for (const tool of tools) server.registerTool(tool.name, {
    title: tool.title, description: tool.description,
    inputSchema: fromJsonSchema<Record<string, unknown>>(z.toJSONSchema(tool.input, { io: 'input' }) as JsonSchemaType),
    outputSchema: fromJsonSchema<Record<string, unknown>>(z.toJSONSchema(tool.output) as JsonSchemaType),
    annotations: { readOnlyHint: false, destructiveHint: tool.write, openWorldHint: false },
  }, async input => {
    try {
      const access = await getAccess();
      return await observeMcpToolExecution({ ownerUserId: access.user.id, toolName: tool.name, input, execute: async () => {
        const result = await tool.action(access.user.id, input);
        // Browser-only aggregate refresh never becomes a second MCP payload owner.
        const value = tool.write ? { snapshot: (result as { snapshot: unknown }).snapshot, receipt: (result as { receipt: unknown }).receipt } : result;
        const receipt = tool.output.parse(value);
        const uncertain = 'receipt' in receipt && receipt.receipt.outcome === 'uncertain';
        return { ...(uncertain ? { isError: true } : {}), content: [{ type: 'text' as const, text: JSON.stringify(receipt) }], structuredContent: receipt };
      } });
    } catch (error) { return toolError(error); }
  });
}
