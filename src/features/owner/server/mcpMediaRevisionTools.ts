import { fromJsonSchema, type JsonSchemaType } from '@modelcontextprotocol/server';
import { z } from 'zod/v4';
import { observeMcpToolExecution } from '@/features/mcp-usage/server';
import { mediaRevisionBaseInput, mediaRevisionAttemptInput, mediaRevisionBaseOutput, mediaRevisionReceiptOutput, mediaRevisionCommandResult } from '@/features/pipeline/server';
import { getOwnerMediaRevisionBase, getOwnerMediaRevisionReceipt, createOwnerMediaRevision } from './ownerMediaRevisionCommands';
import type { registerOwnerReadTools } from './mcpOwnerTools';
export function registerOwnerMediaRevisionTools({ server, getAccess, toolError }: Parameters<typeof registerOwnerReadTools>[0]) {
  const tools = [
    { name: 'get_pipeline_media_presentation_base', input: mediaRevisionBaseInput, output: mediaRevisionBaseOutput, write: false, action: getOwnerMediaRevisionBase, description: 'Owner only. Read the exact current published managed texture presentation and source SHA256. This downloads and hashes its managed source but does not copy or allocate. Only tileMode/seamless presentation changes are supported; no new media sources or rights claims.' },
    { name: 'get_pipeline_media_presentation_receipt', input: mediaRevisionAttemptInput, output: mediaRevisionReceiptOutput, write: false, action: getOwnerMediaRevisionReceipt, description: 'Owner only. Read the exact existing asset + UUID submissionKey + full presentation receipt. Key is not actor-bound. This never allocates, downloads, copies or deletes. Unavailable/malformed reads do not establish absence. A row receipt is not a fresh Storage-integrity or global orphan-cleanup proof.' },
    { name: 'create_pipeline_media_presentation_revision', input: mediaRevisionAttemptInput, output: mediaRevisionCommandResult, write: true, action: createOwnerMediaRevision, description: 'Owner only. Create an unpublished managed texture tileMode/seamless review using the exact saved presentation and UUID key. Native service owns source metadata, copy/hash verification, candidate UUID, path, allocation, locks and conservative compensation. Same-content key reuse remains native, not actor-bound. Confirmed receipt survives audit failure. Unknown outcome requires exact receipt read; never copy/replay automatically or invent another key. cleanupPending concerns only this invocation, not prior orphans; no durable pre-copy resume claim or publication.' },
  ] as const;
  for (const tool of tools) server.registerTool(tool.name, { description: tool.description,
    inputSchema: fromJsonSchema<Record<string, unknown>>(z.toJSONSchema(tool.input, { io: 'input' }) as JsonSchemaType), outputSchema: fromJsonSchema<Record<string, unknown>>(z.toJSONSchema(tool.output) as JsonSchemaType),
    annotations: { readOnlyHint: false, destructiveHint: tool.write, openWorldHint: false },
  }, async input => { try { const access = await getAccess(); return await observeMcpToolExecution({ ownerUserId: access.user.id, toolName: tool.name, input, execute: async () => {
    const result = tool.output.parse(await tool.action(access.user.id, input));
    return { ...('outcome' in result && result.outcome === 'uncertain' ? { isError: true } : {}), content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result };
  } }); } catch (error) { return toolError(error); } });
}
