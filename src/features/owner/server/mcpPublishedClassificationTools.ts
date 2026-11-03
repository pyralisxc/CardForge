import { fromJsonSchema, type JsonSchemaType } from '@modelcontextprotocol/server';
import { z } from 'zod/v4';
import { observeMcpToolExecution } from '@/features/mcp-usage/server';
import { publishedClassificationReadInput, publishedClassificationInput, publishedClassificationSnapshot, publishedClassificationResult } from '@/features/pipeline/server';
import { getOwnerPublishedClassification, saveOwnerPublishedClassification } from './ownerPublishedClassificationCommands';
import type { registerOwnerReadTools } from './mcpOwnerTools';

export function registerPublishedClassificationTools({ server, getAccess, toolError }: Parameters<typeof registerOwnerReadTools>[0]) {
  const tools = [
    { name: 'get_pipeline_published_classification', input: publishedClassificationReadInput, output: publishedClassificationSnapshot, write: false, action: getOwnerPublishedClassification,
      description: 'Owner only. Read the exact current published asset, submission/lineage/revision and all seven expected classification values before proposing discovery metadata changes. Read does not authorize publication, revision creation, content replacement or deletion.' },
    { name: 'save_pipeline_published_classification', input: publishedClassificationInput, output: publishedClassificationResult, write: true, action: saveOwnerPublishedClassification,
      description: 'Owner only. Use exact native expected identity and all seven expected values previously read, plus supported desired taxonomy. Existing locked comparison and classification rules remain authoritative. No fabricated timestamp CAS or operation ID, latest/sibling substitution, revision creation, publication or Storage change. Native acknowledgement is commit; refresh failures preserve it. Unknown/lost acknowledgement stays uncertain even when current values match. Read exact classification before any further write; never replay automatically.' },
  ] as const;
  for (const tool of tools) server.registerTool(tool.name, { description: tool.description,
    inputSchema: fromJsonSchema<Record<string, unknown>>(z.toJSONSchema(tool.input, { io: 'input' }) as JsonSchemaType),
    outputSchema: fromJsonSchema<Record<string, unknown>>(z.toJSONSchema(tool.output) as JsonSchemaType),
    annotations: { readOnlyHint: false, destructiveHint: tool.write, openWorldHint: false },
  }, async input => {
    try {
      const access = await getAccess();
      return await observeMcpToolExecution({ ownerUserId: access.user.id, toolName: tool.name, input, execute: async () => {
        const result = tool.output.parse(await tool.action(access.user.id, input));
        const uncertain = 'receipt' in result && result.receipt.outcome === 'uncertain';
        return { ...(uncertain ? { isError: true } : {}), content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result };
      } });
    } catch (error) { return toolError(error); }
  });
}
