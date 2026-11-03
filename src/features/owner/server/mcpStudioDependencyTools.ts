import { fromJsonSchema, type JsonSchemaType } from '@modelcontextprotocol/server';
import { z } from 'zod/v4';
import { observeMcpToolExecution } from '@/features/mcp-usage/server';
import { ownerStudioDependencyInput, ownerStudioDependencySnapshot, ownerStudioDependencyResult } from '@/features/studio-documents/server';
import { getOwnerStudioDependencies, reconcileOwnerStudioDependencies } from './ownerStudioDependencyCommands';
import type { registerOwnerReadTools } from './mcpOwnerTools';
export function registerOwnerStudioDependencyTools({ server, getAccess, toolError }: Parameters<typeof registerOwnerReadTools>[0]) {
  const tools = [
    { name: 'get_owner_studio_document_dependencies', output: ownerStudioDependencySnapshot, action: getOwnerStudioDependencies, write: false, description: 'Owner only. Read persisted dependency metadata for exact document UUID and expectedRevision. No interpreter, write or latest substitution. Absent/stale/incomplete metadata is distinct from unavailable or missing document. Sanitized codes only; no authored payload, source list or owner identity. State matching is not causal acknowledgement and metadata completeness is NOT deletion permission.' },
    { name: 'reconcile_owner_studio_document_dependencies', output: ownerStudioDependencyResult, action: reconcileOwnerStudioDependencies, write: true, description: 'Owner only. Reconcile derived metadata of exact stored document/revision through existing native payload/revision comparison. Server owns stored author/payload and interpretation; caller supplies neither. No authored content/revision change. Literal true native ACK commits; false conflicts; lost/malformed ACK is uncertain. Preserve commit through readback/activity warnings. Unknown outcome requires exact persisted read, never blind replay or causal inference from matching state. NOT deletion/expiry permission.' },
  ] as const;
  for (const tool of tools) server.registerTool(tool.name, { description: tool.description, inputSchema: fromJsonSchema<Record<string, unknown>>(z.toJSONSchema(ownerStudioDependencyInput, { io: 'input' }) as JsonSchemaType), outputSchema: fromJsonSchema<Record<string, unknown>>(z.toJSONSchema(tool.output) as JsonSchemaType), annotations: { readOnlyHint: false, destructiveHint: tool.write, openWorldHint: false } }, async input => {
    try { const access = await getAccess(); return await observeMcpToolExecution({ ownerUserId: access.user.id, toolName: tool.name, input, execute: async () => {
      const result = tool.output.parse(await tool.action(access.user.id, input));
      return { ...('receipt' in result && result.receipt.outcome === 'uncertain' ? { isError: true } : {}), content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result };
    } }); } catch (error) { return toolError(error); }
  });
}
