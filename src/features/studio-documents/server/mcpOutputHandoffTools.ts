import { fromJsonSchema, type JsonSchemaType } from '@modelcontextprotocol/server';
import { z } from 'zod/v4';
import { requireAccountToolCapability } from '@/features/account/server';
import { observeMcpToolExecution } from '@/features/mcp-usage/server';
import { outputIntentSchema, validateOutputIntentDocument } from '../outputIntent';
import { createStudioOutputIntent, getStudioDocument } from './studioDocumentStore';
import { StudioDocumentStoreError } from './StudioDocumentStoreError';
import type { registerRevisionRecoveryTools } from './mcpRevisionRecoveryTools';

const output = z.object({ documentId: z.string(), revision: z.number(), setId: z.string(), reference: z.string(), openInStudioUrl: z.string(), status: z.literal('prepared') }).strict();

export function registerOutputHandoffTools({ server, publicOrigin, getReadAccess, toolError }: Pick<Parameters<typeof registerRevisionRecoveryTools>[0], 'server' | 'publicOrigin' | 'getReadAccess' | 'toolError'>) {
  server.registerTool('prepare_output_handoff', {
    title: 'Prepare exact Output in CardForge',
    description: 'Prepare an exact revision, Set, ordered unique cards and existing PDF settings for user review in Studio. Opening the link does not download a file; the user chooses when to download. Default layout is tiled sheets. This is not a file attachment.',
    inputSchema: fromJsonSchema<Record<string, unknown>>(z.toJSONSchema(outputIntentSchema, { io: 'input' }) as JsonSchemaType),
    outputSchema: fromJsonSchema<Record<string, unknown>>(z.toJSONSchema(output) as JsonSchemaType),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  }, async (input) => {
    try {
      const intent = outputIntentSchema.parse(input);
      const access = await getReadAccess();
      requireAccountToolCapability(access, 'studio.ai.create');
      return await observeMcpToolExecution({ ownerUserId: access.user.id, toolName: 'prepare_output_handoff', input, execute: async () => {
        const document = await getStudioDocument(access.user.id, intent.documentId, undefined, (raw) => {
          try { validateOutputIntentDocument(intent, raw); }
          catch (error) { throw new StudioDocumentStoreError(error instanceof Error ? error.message : 'Invalid output source.', 409); }
        });
        if (document.revision !== intent.revision) throw new StudioDocumentStoreError('The exact document revision has changed. Read the current document before preparing Output.', 409);
        const reference = await createStudioOutputIntent(access.user.id, intent);
        const params = new URLSearchParams({ document: intent.documentId, revision: String(intent.revision), outputRef: reference });
        const structuredContent = output.parse({ documentId: intent.documentId, revision: intent.revision, setId: intent.setId, reference, openInStudioUrl: `${publicOrigin}/studio?${params}`, status: 'prepared' });
        return { content: [{ type: 'text' as const, text: 'Output is prepared for review in Studio. Opening the link will not download a file.' }], structuredContent };
      } });
    } catch (error) { return toolError(error); }
  });
}
