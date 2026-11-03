import { fromJsonSchema, type JsonSchemaType } from '@modelcontextprotocol/server';
import { z } from 'zod/v4';
import { observeMcpToolExecution } from '@/features/mcp-usage/server';
import { personalLibraryExactInput, personalLibraryRemovalInput, personalLibraryItemRead, personalLibraryRemovalReceipt } from '../itemContract';
import { getPersonalLibraryItem, removePersonalLibraryItem, PersonalLibraryStoreError } from './personalLibraryStore';
import type { registerPersonalLibraryTools } from './mcpPersonalLibraryTools';

export function registerPersonalLibraryItemTools({ server, getAccess, toolError }: Parameters<typeof registerPersonalLibraryTools>[0]) {
  for (const tool of [
    { name: 'get_personal_library_item', input: personalLibraryExactInput, output: personalLibraryItemRead, remove: false, description: 'Read exact account-owned personal Library index metadata, without provider calls, bytes, credentials or resource keys. Null means an observed absent entry, not unavailable and not proof a prior removal committed.' },
    { name: 'remove_personal_library_item', input: personalLibraryRemovalInput, output: personalLibraryRemovalReceipt, remove: true, description: 'Permanently remove only the exact account-owned CardForge index entry with target-bound confirmation. Drive original stays untouched. No index Trash/Undo; later Picker registration does not restore this identity. Unknown outcome: exact GET readback, no automatic DELETE replay or causal inference from absence.' },
  ]) server.registerTool(tool.name, {
    description: tool.description,
    inputSchema: fromJsonSchema<Record<string, unknown>>(z.toJSONSchema(tool.input) as JsonSchemaType),
    outputSchema: fromJsonSchema<Record<string, unknown>>(z.toJSONSchema(tool.output) as JsonSchemaType),
    annotations: { readOnlyHint: false, destructiveHint: tool.remove, openWorldHint: false },
  }, async input => {
    try {
      const access = await getAccess();
      const accountId = access.entitlement.isSignedIn && access.entitlement.accountUserId;
      if (!accountId) throw new PersonalLibraryStoreError('A linked CardForge account is required.', 401, { kind: 'authentication' });
      return await observeMcpToolExecution({ ownerUserId: access.user.id, toolName: tool.name, input, execute: async () => {
        const structuredContent = tool.remove
          ? await removePersonalLibraryItem(accountId, input)
          : await getPersonalLibraryItem(accountId, personalLibraryExactInput.parse(input).itemId);
        return { content: [{ type: 'text' as const, text: 'message' in structuredContent ? structuredContent.message : structuredContent.item ? 'Exact personal Library metadata read.' : 'Exact index entry is absent; no operation outcome is inferred.' }], structuredContent };
      } });
    } catch (error) { return toolError(error); }
  });
}
