import { recordOwnerActivity } from '@/features/owner/server';
import { fromJsonSchema } from '@modelcontextprotocol/server';
import { deleteOwnerRevision, inspectOwnerRevisionDeletion } from '@/features/pipeline/server';
import { observeMcpToolExecution } from '@/features/mcp-usage/server';
import type { registerAccountWorkflowTools } from './mcpAccountWorkflowTools';

export function registerRevisionDeletionTools({ server, getAccess, toolError }: Parameters<typeof registerAccountWorkflowTools>[0]) {
  server.registerTool('get_pipeline_revision_deletion', {
    title: 'Inspect one Owner revision for permanent deletion',
    description: 'Owner only. Reads product state and records normal MCP usage telemetry. Inspect an exact submission UUID and obtain its exact name/path confirmation and current blockers. This is one unpublished trashed revision, not catalog-lineage Trash or generic asset deletion. Eligibility is an observation, not authority; the delete command rechecks under native locks. An absent row alone does not prove a previous deletion committed.',
    inputSchema: fromJsonSchema<{ submissionId: string }>({ type: 'object', additionalProperties: false, required: ['submissionId'], properties: { submissionId: { type: 'string', format: 'uuid' } } }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  }, async input => {
    try {
      const access = await getAccess();
      return await observeMcpToolExecution({ ownerUserId: access.user.id, toolName: 'get_pipeline_revision_deletion', input, execute: async () => {
        const receipt = await inspectOwnerRevisionDeletion(access.user.id, input.submissionId);
        return { content: [{ type: 'text' as const, text: JSON.stringify(receipt) }], structuredContent: receipt };
      } });
    } catch (error) { return toolError(error); }
  });
  server.registerTool('delete_pipeline_revision_now', {
    title: 'Permanently delete one confirmed trashed revision',
    description: 'Owner only, destructive. After exact preflight discovery and explicit confirmation of this UUID/name/path, permanently delete only that eligible unpublished trashed revision and its managed source using the existing native Owner claim. Never deletes siblings or a catalog lineage; cannot enable expiry. A lost/unconfirmed result requires read-only reconciliation, never an automatic retry. Committed results with activity/refresh warnings remain committed and must not be repeated.',
    inputSchema: fromJsonSchema<{ submissionId: string; name: string; storagePath: string | null }>({ type: 'object', additionalProperties: false, required: ['submissionId', 'name', 'storagePath'], properties: {
      submissionId: { type: 'string', format: 'uuid' }, name: { type: 'string', minLength: 1 }, storagePath: { type: ['string', 'null'], minLength: 1 },
    } }),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  }, async input => {
    try {
      const access = await getAccess();
      return await observeMcpToolExecution({ ownerUserId: access.user.id, toolName: 'delete_pipeline_revision_now', input, execute: async () => {
        try {
          const receipt = await deleteOwnerRevision(access.user.id, input);
          try {
            const recorded = await recordOwnerActivity({ actorUserId: access.user.id, actorEmail: access.user.email, action: 'library.asset.delete', targetType: 'contributor_asset_revision', targetId: input.submissionId, summary: 'Owner-confirmed permanent deletion of one trashed Pipeline revision.' });
            if (!recorded) receipt.warnings.push('activity_record_unavailable');
          } catch { receipt.warnings.push('activity_record_unavailable'); }
          return { content: [{ type: 'text' as const, text: JSON.stringify(receipt) }], structuredContent: receipt };
        } catch (error) {
          if (error instanceof Error && 'status' in error && error.status === 503) {
            const receipt = { submissionId: input.submissionId, deleted: null, outcome: 'uncertain', message: 'Deletion was not confirmed. Inspect the exact revision and retained claim state before any further action; do not retry automatically.' };
            return { isError: true, content: [{ type: 'text' as const, text: JSON.stringify(receipt) }], structuredContent: receipt };
          }
          throw error;
        }
      } });
    } catch (error) { return toolError(error); }
  });
}
