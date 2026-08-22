import { fromJsonSchema } from '@modelcontextprotocol/server';
import { createMcpHandler } from 'mcp-handler';

import type { DeveloperCockpitAccess } from '@/features/developer-access/server';
import { observeMcpToolExecution } from '@/features/mcp-usage/server';
import {
  CloudSetStoreError,
  getCloudSet,
  listCloudSets,
} from '@/features/project/server';
import {
  cloudSetListOutputSchema,
  cloudSetOutputSchema,
} from './mcpToolOutputSchemas';
import {
  checkoutCloudSetForAgent,
  commitAgentWorkingSetToCloud,
  deleteCloudSetForAgent,
} from './mcpCloudSetBridge';

interface GetCloudSetInput {
  setId: string;
  cardOffset?: number;
  cardLimit?: number;
}

interface CheckoutCloudSetInput {
  setId: string;
  expectedCloudRevision?: number;
}

interface CommitCloudSetInput {
  documentId: string;
  expectedDocumentRevision: number;
  setId: string;
  expectedCloudRevision: number;
}

interface DeleteCloudSetInput {
  setId: string;
  expectedCloudRevision: number;
}

const setIdSchema = {
  type: 'string',
  minLength: 1,
  maxLength: 160,
  description: 'Stable CardForge cloud Set id.',
} as const;
const revisionSchema = {
  type: 'integer',
  minimum: 1,
  description: 'Exact revision previously read from CardForge. Mutations fail if the current revision differs.',
} as const;

const getCloudSetInputSchema = fromJsonSchema<GetCloudSetInput>({
  type: 'object',
  additionalProperties: false,
  required: ['setId'],
  properties: {
    setId: setIdSchema,
    cardOffset: {
      type: 'integer',
      minimum: 0,
      default: 0,
      description: 'Zero-based card offset for large saved Sets.',
    },
    cardLimit: {
      type: 'integer',
      minimum: 1,
      maximum: 100,
      default: 60,
      description: 'Maximum cards to return in this page. A traditional 52-card Set fits in the default page.',
    },
  },
});

const checkoutCloudSetInputSchema = fromJsonSchema<CheckoutCloudSetInput>({
  type: 'object',
  additionalProperties: false,
  required: ['setId'],
  properties: {
    setId: setIdSchema,
    expectedCloudRevision: revisionSchema,
  },
});

const commitCloudSetInputSchema = fromJsonSchema<CommitCloudSetInput>({
  type: 'object',
  additionalProperties: false,
  required: ['documentId', 'expectedDocumentRevision', 'setId', 'expectedCloudRevision'],
  properties: {
    documentId: {
      type: 'string',
      format: 'uuid',
      description: 'Private agent working document created by checkout_cloud_set or another current agent workflow.',
    },
    expectedDocumentRevision: revisionSchema,
    setId: setIdSchema,
    expectedCloudRevision: revisionSchema,
  },
});

const deleteCloudSetInputSchema = fromJsonSchema<DeleteCloudSetInput>({
  type: 'object',
  additionalProperties: false,
  required: ['setId', 'expectedCloudRevision'],
  properties: {
    setId: setIdSchema,
    expectedCloudRevision: revisionSchema,
  },
});

type RegistrationCallback = Parameters<typeof createMcpHandler>[0];
type McpRegistrationServer = Parameters<RegistrationCallback>[0];
type ToolErrorResult = {
  isError: boolean;
  content: Array<{ type: 'text'; text: string }>;
};

const compactValue = (value: unknown): unknown => {
  if (typeof value === 'string') {
    if (value.startsWith('cardforge-studio-asset://')) return '[private artwork stored by CardForge]';
    if (value.startsWith('data:')) return '[embedded artwork retained by CardForge]';
    return value.length > 4000 ? `${value.slice(0, 4000)}…` : value;
  }
  if (Array.isArray(value)) return value.map(compactValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, entry]) => [key, compactValue(entry)]),
    );
  }
  return value;
};

export const registerCloudSetTools = ({
  server,
  publicOrigin,
  getAccess,
  toolError,
}: {
  server: McpRegistrationServer;
  publicOrigin: string;
  getAccess: () => Promise<DeveloperCockpitAccess>;
  toolError: (error: unknown) => ToolErrorResult;
}) => {
  const cloudError = (error: unknown) => {
    if (error instanceof CloudSetStoreError) {
      return {
        isError: true,
        content: [{ type: 'text' as const, text: error.message }],
      };
    }
    return toolError(error);
  };
  const runObserved = async <Result>({
    toolName,
    input,
    execute,
  }: {
    toolName: string;
    input: unknown;
    execute: (access: DeveloperCockpitAccess) => Promise<Result>;
  }): Promise<Result | ToolErrorResult> => {
    try {
      const access = await getAccess();
      return await observeMcpToolExecution({
        ownerUserId: access.user.id,
        toolName,
        input,
        execute: async () => execute(access),
      });
    } catch (error) {
      return cloudError(error);
    }
  };
  const studioUrl = (documentId: string, revision: number) => (
    `${publicOrigin}/studio?document=${encodeURIComponent(documentId)}&revision=${revision}`
  );

  server.registerTool(
    'list_cloud_sets',
    {
      title: 'List cloud-saved CardForge Sets',
      description: 'Use when the user refers to a Set they saved, backed up, made on another device, or expects CardForge to remember. Lists only Sets intentionally saved to the linked account cloud; browser-only Sets remain private to that device.',
      outputSchema: cloudSetListOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async () => runObserved({
      toolName: 'list_cloud_sets',
      input: {},
      execute: async (access) => {
        const entitlement = access.entitlement;
        if (!entitlement.isSignedIn || !entitlement.accountUserId) {
          throw new CloudSetStoreError('A linked CardForge account is required to read cloud-saved Sets.', 401);
        }
        const result = await listCloudSets(
          entitlement.accountUserId,
          entitlement.capabilities.cloudSetLimit,
        );
        return {
          content: [{
            type: 'text',
            text: result.sets.length === 0
              ? `This CardForge account has no cloud-saved Sets yet. It has ${result.limit} cloud Set slot${result.limit === 1 ? '' : 's'} available.`
              : `Found ${result.sets.length} cloud-saved CardForge Set${result.sets.length === 1 ? '' : 's'} using ${result.used}/${result.limit} cloud slots.`,
          }],
          structuredContent: result,
        };
      },
    }),
  );

  server.registerTool(
    'get_cloud_set',
    {
      title: 'Read a cloud-saved CardForge Set',
      description: 'Load editable metadata for one cloud Set, including its Set record, required personal Templates, card values, private-artwork manifest, and exact cloud revision. This read does not change cloud or browser state; use checkout_cloud_set before agent edits.',
      inputSchema: getCloudSetInputSchema,
      outputSchema: cloudSetOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ setId, cardOffset = 0, cardLimit = 60 }) => runObserved({
      toolName: 'get_cloud_set',
      input: { setId, cardOffset, cardLimit },
      execute: async (access) => {
        const entitlement = access.entitlement;
        if (!entitlement.isSignedIn || !entitlement.accountUserId) {
          throw new CloudSetStoreError('A linked CardForge account is required to read a cloud-saved Set.', 401);
        }
        const result = await getCloudSet(entitlement.accountUserId, setId);
        const offset = Math.max(0, Math.trunc(cardOffset));
        const limit = Math.min(100, Math.max(1, Math.trunc(cardLimit)));
        const cards = result.payload.cards.slice(offset, offset + limit);
        const returnedThrough = offset + cards.length;
        const hasMoreCards = returnedThrough < result.payload.cards.length;
        const structuredContent = {
          summary: result.summary,
          set: compactValue(result.payload.sets[0] ?? null),
          templates: compactValue(result.payload.templates),
          cards: compactValue(cards),
          cardPage: {
            offset,
            limit,
            returned: cards.length,
            total: result.payload.cards.length,
            hasMore: hasMoreCards,
            nextOffset: hasMoreCards ? returnedThrough : null,
          },
          artwork: {
            count: result.assets.length,
            files: result.assets.map(({ id, mimeType, size }) => ({ id, mimeType, size })),
            note: 'Artwork remains private in CardForge cloud storage. Signed object URLs are intentionally not exposed to the model.',
          },
        };
        return {
          content: [{
            type: 'text',
            text: `Loaded cloud Set "${result.summary.name}" revision ${result.summary.revision}: ${cards.length} of ${result.payload.cards.length} cards returned${hasMoreCards ? '; request the next cardOffset to continue' : ''}. Use checkout_cloud_set at this revision before editing it.`,
          }],
          structuredContent,
        };
      },
    }),
  );

  server.registerTool(
    'checkout_cloud_set',
    {
      title: 'Check out a cloud Set for agent editing',
      description: 'Create a private revision-safe agent working document from an intentionally cloud-saved CardForge Set. Use this when the user asks the agent to edit, revise, clean up, add artwork to, or otherwise work on a cloud Set. The cloud save itself is unchanged until commit_cloud_set is explicitly called.',
      inputSchema: checkoutCloudSetInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ setId, expectedCloudRevision }) => runObserved({
      toolName: 'checkout_cloud_set',
      input: { setId, expectedCloudRevision },
      execute: async (access) => {
        const result = await checkoutCloudSetForAgent({ access, setId, expectedCloudRevision });
        return {
          content: [{
            type: 'text',
            text: `Checked out cloud Set "${result.cloud.name}" revision ${result.cloud.revision} into private agent working document ${result.workingDocument.id} at working revision ${result.workingDocument.revision}. The cloud Set is unchanged until an explicit commit.`,
          }],
          structuredContent: {
            cloudSet: result.cloud,
            set: result.set,
            documentId: result.workingDocument.id,
            documentRevision: result.workingDocument.revision,
            sourceCloudRevision: result.cloud.revision,
            openInStudioUrl: studioUrl(result.workingDocument.id, result.workingDocument.revision),
            nextActions: [
              { action: 'get_card_generation_contract', reason: 'Load the exact current Template fields before making or revising cards.' },
              { action: 'preview_card_set', reason: 'Read stable existing card ids before an in-place revision.' },
              { action: 'commit_cloud_set', reason: 'After review, explicitly write the finished working Set back to the same cloud revision.' },
            ],
          },
        };
      },
    }),
  );

  server.registerTool(
    'commit_cloud_set',
    {
      title: 'Commit an agent working Set back to CardForge cloud',
      description: 'Write one reviewed agent working Set back to its cloud save using both exact working-document and cloud revision checks. Use only when the user wants the cloud Set updated. CardForge refuses stale commits rather than overwriting a newer cloud revision.',
      inputSchema: commitCloudSetInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ documentId, expectedDocumentRevision, setId, expectedCloudRevision }) => runObserved({
      toolName: 'commit_cloud_set',
      input: { documentId, expectedDocumentRevision, setId, expectedCloudRevision },
      execute: async (access) => {
        const result = await commitAgentWorkingSetToCloud({
          access,
          documentId,
          expectedDocumentRevision,
          setId,
          expectedCloudRevision,
        });
        return {
          content: [{
            type: 'text',
            text: `Committed agent working revision ${result.documentRevision} to cloud Set "${result.summary.name}". The cloud Set is now revision ${result.summary.revision}.`,
          }],
          structuredContent: {
            summary: result.summary,
            documentId,
            documentRevision: result.documentRevision,
            previousCloudRevision: expectedCloudRevision,
            cloudRevision: result.summary.revision,
          },
        };
      },
    }),
  );

  server.registerTool(
    'delete_cloud_set',
    {
      title: 'Delete a CardForge cloud Set',
      description: 'Permanently remove one intentionally cloud-saved Set and its private cloud artwork after the user explicitly asks for that cloud save to be deleted. Requires the exact cloud revision previously read so a stale agent cannot delete a newer saved revision. Browser-local copies are not deleted.',
      inputSchema: deleteCloudSetInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ setId, expectedCloudRevision }) => runObserved({
      toolName: 'delete_cloud_set',
      input: { setId, expectedCloudRevision },
      execute: async (access) => {
        const deleted = await deleteCloudSetForAgent({ access, setId, expectedCloudRevision });
        return {
          content: [{
            type: 'text',
            text: `Deleted cloud Set "${deleted.name}" revision ${deleted.revision}. This removed only the account cloud save; browser-local copies are unchanged.`,
          }],
          structuredContent: {
            deletedSetId: deleted.setId,
            deletedRevision: deleted.revision,
            deletedName: deleted.name,
          },
        };
      },
    }),
  );
};
