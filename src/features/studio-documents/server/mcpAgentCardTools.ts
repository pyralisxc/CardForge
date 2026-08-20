import { createMcpHandler } from 'mcp-handler';

import type { DeveloperCockpitAccess } from '@/features/developer-access/server';
import {
  attachDeveloperCardArtwork,
  getDeveloperCardGenerationContract,
  upsertDeveloperCards,
  upsertDeveloperCardSet,
} from './developerCardSetDrafts';
import { getStudioDocument } from './studioDocumentStore';
import {
  attachCardArtworkInputSchema,
  cardGenerationContractInputSchema,
  getCardSetInputSchema,
  upsertCardInputSchema,
  upsertCardsInputSchema,
  upsertCardSetInputSchema,
} from './mcpCardToolSchemas';

type RegistrationCallback = Parameters<typeof createMcpHandler>[0];
type McpRegistrationServer = Parameters<RegistrationCallback>[0];
type ToolErrorResult = {
  isError: boolean;
  content: Array<{ type: 'text'; text: string }>;
};

const compactValue = (value: unknown): unknown => {
  if (typeof value === 'string' && value.startsWith('data:')) return '[embedded artwork retained by CardForge]';
  if (Array.isArray(value)) return value.map(compactValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, compactValue(entry)]));
  }
  return value;
};

export const registerAgentCardTools = ({
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
  const studioUrl = (documentId: string, revision: number) => (
    `${publicOrigin}/studio?document=${encodeURIComponent(documentId)}&revision=${revision}`
  );

  server.registerTool(
    'get_card_generation_contract',
    {
      title: 'Get the exact card-generation contract',
      description: 'Read the selected CardForge Template fields before making one card or a bulk set. Returns exact front/back field keys, required/image fields, and the same bulk contract used by Studio. Never guess card columns or image keys.',
      inputSchema: cardGenerationContractInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ documentId, setId }) => {
      try {
        const access = await getAccess();
        const result = await getDeveloperCardGenerationContract({ access, documentId, setId });
        return {
          content: [{
            type: 'text',
            text: `Loaded the exact CardForge card contract for "${result.document.title}" revision ${result.document.revision}. Use these field keys for both individual and bulk card creation; do not invent additional columns.`,
          }],
          structuredContent: {
            documentId: result.document.id,
            revision: result.document.revision,
            set: result.set,
            frontTemplateId: result.frontTemplateId,
            backingTemplateId: result.backingTemplateId,
            frontFields: result.frontFields,
            backFields: result.backFields,
            bulkContract: result.bulkContract,
            exampleJson: result.exampleJson,
          },
        };
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'upsert_card_set',
    {
      title: 'Create or revise a CardForge card set',
      description: 'Create one named set in the same private Studio working document or revise the same set by stable id. The set owns its front/back Templates; it does not create a parallel cloud library.',
      inputSchema: upsertCardSetInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ documentId, expectedRevision, setId, name, frontTemplateId, backingTemplateId }) => {
      try {
        const access = await getAccess();
        const document = await upsertDeveloperCardSet({
          access,
          documentId,
          expectedRevision,
          setId,
          name,
          frontTemplateId,
          backingTemplateId,
        });
        const set = document.document.cardSets.find((candidate) => candidate.id === document.document.activeCardSetId);
        return {
          content: [{ type: 'text', text: `Card set "${set?.name ?? name}" is ready in revision ${document.revision}. Load get_card_generation_contract before adding cards.` }],
          structuredContent: {
            documentId: document.id,
            revision: document.revision,
            set,
            openInStudioUrl: studioUrl(document.id, document.revision),
          },
        };
      } catch (error) {
        return toolError(error);
      }
    },
  );

  const upsertCards = async ({
    documentId,
    expectedRevision,
    setId,
    cards,
    bulk,
  }: {
    documentId: string;
    expectedRevision: number;
    setId: string;
    cards: Array<{ cardId?: string; data: Record<string, string | number>; backingData?: Record<string, string | number> }>;
    bulk: boolean;
  }) => {
    try {
      const access = await getAccess();
      const result = await upsertDeveloperCards({ access, documentId, expectedRevision, setId, cards });
      return {
        content: [{
          type: 'text',
          text: `${bulk ? 'Bulk' : 'Card'} update completed for "${result.set.name}". ${result.updatedIds.length} card${result.updatedIds.length === 1 ? '' : 's'} added or revised in Studio document revision ${result.document.revision}.`,
        }],
        structuredContent: {
          documentId: result.document.id,
          revision: result.document.revision,
          set: result.set,
          cardIds: result.updatedIds,
          cardCount: result.document.document.storedCards.filter((card) => card.setId === result.set.id).length,
          openInStudioUrl: studioUrl(result.document.id, result.document.revision),
        },
      };
    } catch (error) {
      return toolError(error);
    }
  };

  server.registerTool(
    'upsert_card',
    {
      title: 'Create or revise one CardForge card',
      description: 'Create one card in a named set or revise the same card by stable cardId. Call get_card_generation_contract first and use only its native Template field keys.',
      inputSchema: upsertCardInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ documentId, expectedRevision, setId, card }) => upsertCards({
      documentId,
      expectedRevision,
      setId,
      cards: [card],
      bulk: false,
    }),
  );

  server.registerTool(
    'upsert_cards',
    {
      title: 'Bulk create or revise CardForge cards',
      description: 'Create or revise up to 100 cards in one set using structured objects. This is the agent-native bulk path: call get_card_generation_contract first rather than inventing CSV columns. Stable cardId values update existing cards.',
      inputSchema: upsertCardsInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ documentId, expectedRevision, setId, cards }) => upsertCards({
      documentId,
      expectedRevision,
      setId,
      cards,
      bulk: true,
    }),
  );

  server.registerTool(
    'attach_card_artwork',
    {
      title: 'Attach artwork to an exact card image field',
      description: 'Attach generated or user-provided PNG/JPEG/WebP bytes to one exact image field on one card face. Load get_card_generation_contract first so the fieldKey is real. CardForge embeds the normalized image into the same working document revision.',
      inputSchema: attachCardArtworkInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ documentId, expectedRevision, cardId, fieldKey, face, mimeType, data }) => {
      try {
        const access = await getAccess();
        const document = await attachDeveloperCardArtwork({
          access,
          documentId,
          expectedRevision,
          cardId,
          fieldKey,
          face,
          mimeType,
          data,
        });
        return {
          content: [{ type: 'text', text: `Artwork attached to ${face} field "${fieldKey}" on card ${cardId}. Studio document is now revision ${document.revision}.` }],
          structuredContent: {
            documentId: document.id,
            revision: document.revision,
            cardId,
            fieldKey,
            face,
            openInStudioUrl: studioUrl(document.id, document.revision),
          },
        };
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'preview_card_set',
    {
      title: 'Review the current CardForge card set',
      description: 'Review the current set structure and card data after individual or bulk generation. Embedded artwork bytes are omitted from model context. Use this before calling a generated set complete, then open the exact revision in Studio for visual review.',
      inputSchema: getCardSetInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ documentId, setId }) => {
      try {
        const access = await getAccess();
        const document = await getStudioDocument(access.user.id, documentId);
        const set = document.document.cardSets.find((candidate) => candidate.id === setId);
        if (!set) throw new Error('That card set is not part of this Studio document.');
        const cards = document.document.storedCards.filter((card) => card.setId === setId);
        return {
          content: [{ type: 'text', text: `Reviewed "${set.name}" at revision ${document.revision}: ${cards.length} card${cards.length === 1 ? '' : 's'} are in the set. Open this exact revision in Studio for visual review before finalizing.` }],
          structuredContent: {
            documentId: document.id,
            revision: document.revision,
            set,
            cards: compactValue(cards),
            cardCount: cards.length,
            openInStudioUrl: studioUrl(document.id, document.revision),
          },
        };
      } catch (error) {
        return toolError(error);
      }
    },
  );
};
