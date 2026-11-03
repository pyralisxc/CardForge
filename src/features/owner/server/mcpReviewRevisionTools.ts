import { fromJsonSchema, type JsonSchemaType } from '@modelcontextprotocol/server';
import { z } from 'zod/v4';
import { observeMcpToolExecution } from '@/features/mcp-usage/server';
import { createOwnerReviewRevision, getOwnerReviewRevisionBase, getOwnerReviewRevisionReceipt } from './ownerReviewRevisionCommands';
import { reviewRevisionReadInput, reviewRevisionReceiptInput, reviewRevisionBase, reviewTemplatePayload, reviewStylePayload, reviewRevisionNativeReceipt, reviewRevisionResult } from './ownerReviewRevisionSchemas';
import type { registerOwnerReadTools } from './mcpOwnerTools';

export function registerOwnerReviewRevisionTools({ server, getAccess, toolError }: Parameters<typeof registerOwnerReadTools>[0]) {
  for (const kind of ['template', 'style'] as const) {
    const payload = kind === 'template' ? reviewTemplatePayload : reviewStylePayload;
    const baseOutput = z.object({ expectedBase: reviewRevisionBase, [kind]: payload });
    const createInput = z.object({ expectedBase: reviewRevisionBase, submissionKey: reviewRevisionReceiptInput.shape.submissionKey, [kind]: payload }).strict();
    const tools = [
      { name: `get_pipeline_${kind}_review_base`, input: reviewRevisionReadInput, output: baseOutput, write: false, action: getOwnerReviewRevisionBase,
        description: 'Owner only. Read the exact published same-lineage review base and editable payload. Preserve parent, lineage, revision/high-water and both content versions. Media correction is separate.' },
      { name: `get_pipeline_${kind}_review_receipt`, input: reviewRevisionReceiptInput, output: z.object({ receipt: reviewRevisionNativeReceipt.nullable() }), write: false, action: getOwnerReviewRevisionReceipt,
        description: 'Owner only. Read the exact native receipt for the authenticated actor, asset ID and retained submission key. A failed read is not absence. Reconcile uncertain creation here; do not invent a key or replay automatically.' },
      { name: `create_pipeline_${kind}_review_revision`, input: createInput, output: reviewRevisionResult, write: true, action: createOwnerReviewRevision,
        description: 'Owner only. Submit an unpublished same-lineage review revision from the exact base and saved native submission key. Native actor-bound fingerprint/receipt reuse, changed-payload key conflicts, source/provenance restrictions and allocation remain authoritative. Preserve the payload ID, base and key. Confirmed receipt survives activity failure; unknown outcomes require exact receipt lookup, never fabricated absence, a new key or automatic replay. Does not publish or change Storage bytes.' },
    ] as const;
    for (const tool of tools) server.registerTool(tool.name, { description: tool.description,
      inputSchema: fromJsonSchema<Record<string, unknown>>(z.toJSONSchema(tool.input, { io: 'input' }) as JsonSchemaType),
      outputSchema: fromJsonSchema<Record<string, unknown>>(z.toJSONSchema(tool.output) as JsonSchemaType),
      annotations: { readOnlyHint: false, destructiveHint: tool.write, openWorldHint: false },
    }, async input => { try {
      const access = await getAccess();
      return await observeMcpToolExecution({ ownerUserId: access.user.id, toolName: tool.name, input, execute: async () => {
        const result = tool.output.parse(await tool.action(access.user.id, kind, input));
        return { ...('outcome' in result && (result as { outcome?: unknown }).outcome === 'uncertain' ? { isError: true } : {}), content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result };
      } });
    } catch (error) { return toolError(error); } });
  }
}
