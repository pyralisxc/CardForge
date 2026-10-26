import { fromJsonSchema } from '@modelcontextprotocol/server';
import { changeCatalogTrash, readCatalogTrash, revalidateCardForgeCatalog } from '@/features/pipeline/server';
import type { CatalogTrashCommand, CatalogTrashSnapshot } from '@/features/pipeline/server';
import type { registerAccountWorkflowTools } from './mcpAccountWorkflowTools';
import { observeMcpToolExecution } from '@/features/mcp-usage/server';

const snapshotOutputSchema = fromJsonSchema<CatalogTrashSnapshot>({
  type: 'object', additionalProperties: false, required: ['name', 'state', 'retentionDays', 'reasons', 'entryReasons'],
  properties: { name: { type: 'string' }, state: { type: 'object' }, retentionDays: { type: 'integer' },
    reasons: { type: 'array', items: { type: 'string' } }, entryReasons: { type: 'array', items: { type: 'string' } } },
});

export function registerCatalogTrashTools({ server, getAccess, toolError }: Parameters<typeof registerAccountWorkflowTools>[0]) {
  const run = async (name: string, input: unknown, execute: (userId: string) => Promise<CatalogTrashSnapshot>) => {
    try {
      const access = await getAccess();
      return await observeMcpToolExecution({ ownerUserId: access.user.id, toolName: name, input,
        execute: async () => {
          const receipt = await execute(access.user.id);
          return { content: [{ type: 'text' as const, text: JSON.stringify(receipt) }], structuredContent: receipt };
        },
      });
    } catch (error) { return toolError(error); }
  };
  server.registerTool('get_catalog_trash', {
    title: 'Inspect Owner catalog recovery',
    description: 'Owner only. Read exact lineage/current revision/high-water and recovery state, entry blockers, configured retention and blocked physical-expiry status. This is not deletion permission or proof that cleanup will run. Storage resources are not standalone catalog identities.',
    inputSchema: fromJsonSchema<{ submissionId: string }>({ type: 'object', additionalProperties: false, required: ['submissionId'], properties: { submissionId: { type: 'string', format: 'uuid' } } }),
    outputSchema: snapshotOutputSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, input => run('get_catalog_trash', input, userId => readCatalogTrash(userId, input.submissionId)));
  server.registerTool('change_catalog_trash', {
    title: 'Move, restore or hold Owner catalog Trash',
    description: 'Owner only. Use the exact state from get_catalog_trash. Move hides discovery and retains bytes, subject to native consumer and prior-worker checks. Restore and Hold are blocked after destructive commitment. This tool cannot purge, activate a scheduler, or remove independent downloaded copies. On conflict or uncertain outcome read state before any new request.',
    inputSchema: fromJsonSchema<CatalogTrashCommand>({
      type: 'object', additionalProperties: false, required: ['action', 'expected'],
      properties: {
        action: { type: 'string', enum: ['trash', 'restore', 'hold'] }, held: { type: 'boolean' },
        expected: { type: 'object', additionalProperties: false, required: ['identity', 'trashedAt', 'purgeAfter', 'held'], properties: {
          identity: { type: 'object', additionalProperties: false, required: ['lineageId', 'submissionId', 'registrySubmissionId', 'revisionHighWater'], properties: {
            lineageId: { type: 'string', format: 'uuid' }, submissionId: { type: 'string', format: 'uuid' },
            registrySubmissionId: { type: ['string', 'null'], format: 'uuid' }, revisionHighWater: { type: 'integer', minimum: 0 },
          } },
          trashedAt: { type: ['string', 'null'], format: 'date-time' }, purgeAfter: { type: ['string', 'null'], format: 'date-time' }, held: { type: 'boolean' },
        } },
      },
    }),
    outputSchema: snapshotOutputSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  }, input => run('change_catalog_trash', input, async userId => {
    const receipt = await changeCatalogTrash(userId, input);
    revalidateCardForgeCatalog();
    return receipt;
  }));
}
