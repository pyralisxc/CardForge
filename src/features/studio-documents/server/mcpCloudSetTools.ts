import { fromJsonSchema } from '@modelcontextprotocol/server';
import { createMcpHandler } from 'mcp-handler';

import { getCardforgeEntitlementForUserId } from '@/features/account/server';
import type { DeveloperCockpitAccess } from '@/features/developer-access/server';
import {
  CloudSetStoreError,
  getCloudSet,
  listCloudSets,
} from '@/features/project/server';

interface GetCloudSetInput {
  setId: string;
  cardOffset?: number;
  cardLimit?: number;
}

const getCloudSetInputSchema = fromJsonSchema<GetCloudSetInput>({
  type: 'object',
  additionalProperties: false,
  required: ['setId'],
  properties: {
    setId: {
      type: 'string',
      minLength: 1,
      maxLength: 160,
      description: 'Stable CardForge set id returned by list_cloud_sets.',
    },
    cardOffset: {
      type: 'integer',
      minimum: 0,
      default: 0,
      description: 'Zero-based card offset for large saved sets.',
    },
    cardLimit: {
      type: 'integer',
      minimum: 1,
      maximum: 100,
      default: 60,
      description: 'Maximum cards to return in this page. A traditional 52-card set fits in the default page.',
    },
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
  getAccess,
  toolError,
}: {
  server: McpRegistrationServer;
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

  server.registerTool(
    'list_cloud_sets',
    {
      title: 'List cloud-saved CardForge sets',
      description: 'Use when the user refers to a set they saved, backed up, made on another device, or expects CardForge to remember. Lists only the sets the linked CardForge account intentionally saved to its cloud slots; browser-only sets remain private to that device.',
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        const access = await getAccess();
        const entitlement = await getCardforgeEntitlementForUserId(access.user.id);
        if (!entitlement.isSignedIn || !entitlement.accountUserId) {
          throw new CloudSetStoreError('A linked CardForge account is required to read cloud-saved sets.', 401);
        }
        const result = await listCloudSets(
          entitlement.accountUserId,
          entitlement.capabilities.cloudSetLimit,
        );
        return {
          content: [{
            type: 'text',
            text: result.sets.length === 0
              ? `This CardForge account has no cloud-saved sets yet. It has ${result.limit} cloud set slot${result.limit === 1 ? '' : 's'} available.`
              : `Found ${result.sets.length} cloud-saved CardForge set${result.sets.length === 1 ? '' : 's'} using ${result.used}/${result.limit} cloud slots.`,
          }],
          structuredContent: result,
        };
      } catch (error) {
        return cloudError(error);
      }
    },
  );

  server.registerTool(
    'get_cloud_set',
    {
      title: 'Read a cloud-saved CardForge set',
      description: 'Load the editable metadata for one set returned by list_cloud_sets, including its set record, required personal Templates, card values, and private-artwork manifest. This is read-only: it does not change the permanent cloud save or the browser workspace.',
      inputSchema: getCloudSetInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ setId, cardOffset = 0, cardLimit = 60 }) => {
      try {
        const access = await getAccess();
        const entitlement = await getCardforgeEntitlementForUserId(access.user.id);
        if (!entitlement.isSignedIn || !entitlement.accountUserId) {
          throw new CloudSetStoreError('A linked CardForge account is required to read a cloud-saved set.', 401);
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
            text: `Loaded cloud set "${result.summary.name}" revision ${result.summary.revision}: ${cards.length} of ${result.payload.cards.length} cards returned${hasMoreCards ? '; request the next cardOffset to continue' : ''}.`,
          }],
          structuredContent,
        };
      } catch (error) {
        return cloudError(error);
      }
    },
  );
};
