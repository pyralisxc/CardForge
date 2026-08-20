import { createMcpHandler } from 'mcp-handler';

import type { DeveloperCockpitAccess } from '@/features/developer-access/server';
import {
  attachDeveloperCardArtwork,
  getDeveloperCardGenerationContract,
  upsertDeveloperCards,
  upsertDeveloperCardSet,
} from './developerCardSetDrafts';
import { StudioDocumentStoreError } from './StudioDocumentStoreError';
import { getStudioDocument } from './studioDocumentStore';
import {
  attachCardArtworkInputSchema,
  cardGenerationContractInputSchema,
  getCardSetInputSchema,
  upsertCardInputSchema,
  upsertCardsInputSchema,
  upsertCardSetInputSchema,
} from './mcpCardToolSchemas';

const CARDFORGE_MCP_CAPABILITY_VERSION = '0.3.3';

type RegistrationCallback = Parameters<typeof createMcpHandler>[0];
type McpRegistrationServer = Parameters<RegistrationCallback>[0];
type ToolErrorResult = {
  isError: boolean;
  content: Array<{ type: 'text'; text: string }>;
};

type WorkflowAction = {
  action: string;
  reason: string;
};

const workflowMeta = (workflowStage: string, nextActions: WorkflowAction[]) => ({
  capabilityVersion: CARDFORGE_MCP_CAPABILITY_VERSION,
  workflowStage,
  nextActions,
});

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
      title: 'Prepare a Template for making cards or a bulk card set',
      description: 'Use when the user wants to make cards, generate a deck or set, or turn a list/CSV/JSON into cards. Reads the exact front/back Template fields, required fields, image fields, and CardForge bulk schema before any card write. Never guess card columns or image keys.',
      inputSchema: cardGenerationContractInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ documentId, setId }) => {
      try {
        const access = await getAccess();
        const result = await getDeveloperCardGenerationContract({ access, documentId, setId });
        const resolvedSetId = result.set?.id ?? null;
        return {
          content: [{
            type: 'text',
            text: `CardForge is ready to make cards from "${result.document.title}" revision ${result.document.revision}. Use only the returned field keys for individual or bulk cards.`,
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
            retrySafety: {
              setId: resolvedSetId,
              rule: 'Reuse this set id and the stable card ids returned by card writes. If the connector drops, reload the current revision before retrying with those same ids.',
            },
            ...workflowMeta('card_contract_ready', [
              { action: 'upsert_card_set', reason: 'Name or update the working set before generation when needed.' },
              { action: 'upsert_card', reason: 'Make or revise one card using the exact returned fields.' },
              { action: 'upsert_cards', reason: 'Generate or revise multiple cards in one bounded bulk pass.' },
            ]),
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
      title: 'Create or update a CardForge card set',
      description: 'Use when the user names a set, deck, collection, expansion, or group of cards. Creates or revises that set in the same private working document. Reuse a stable setId on revisions or retries; when setId is omitted CardForge reuses an existing same-name set before creating another one.',
      inputSchema: upsertCardSetInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
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
          content: [{ type: 'text', text: `"${set?.name ?? name}" is the working CardForge set at revision ${document.revision}. Load its exact card fields before generating cards.` }],
          structuredContent: {
            documentId: document.id,
            revision: document.revision,
            set,
            openInStudioUrl: studioUrl(document.id, document.revision),
            retrySafety: {
              setId: set?.id ?? null,
              rule: 'Reuse this set id on every later revision or retry.',
            },
            ...workflowMeta('card_set_ready', [
              { action: 'get_card_generation_contract', reason: 'Load the real Template fields before making one card or a bulk set.' },
            ]),
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
          type: 'text' as const,
          text: `${bulk ? 'Bulk generation' : 'Card update'} completed for "${result.set.name}". ${result.updatedIds.length} card${result.updatedIds.length === 1 ? '' : 's'} added or revised; the working document is now revision ${result.document.revision}.`,
        }],
        structuredContent: {
          documentId: result.document.id,
          revision: result.document.revision,
          set: result.set,
          cardIds: result.updatedIds,
          cardCount: result.document.document.storedCards.filter((card) => card.setId === result.set.id).length,
          openInStudioUrl: studioUrl(result.document.id, result.document.revision),
          retrySafety: {
            setId: result.set.id,
            stableCardIds: result.updatedIds,
            rule: 'Reuse these exact ids for edits and retries. If the connector response is lost, reload the current revision before retrying the same ids.',
          },
          ...workflowMeta(bulk ? 'bulk_cards_ready' : 'card_ready', [
            { action: 'attach_card_artwork', reason: 'Attach unique artwork to any card image fields that need it.' },
            { action: 'preview_card_set', reason: 'Review the complete set data before opening the exact revision in Studio.' },
          ]),
        },
      };
    } catch (error) {
      return toolError(error);
    }
  };

  server.registerTool(
    'upsert_card',
    {
      title: 'Make or update one CardForge card',
      description: 'Use for a single card in an existing working set. Load get_card_generation_contract first and use only its Template field keys. Reuse the returned stable cardId for later edits or retries; if cardId is omitted for a new card, CardForge derives a deterministic id from that submitted card data.',
      inputSchema: upsertCardInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
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
      title: 'Generate cards in bulk for a CardForge set',
      description: 'Use when the user asks for multiple cards, a deck/set, bulk generation, or conversion of a list/CSV/JSON. Creates or revises up to 100 cards using structured objects and the exact CardForge field contract. Never guess card columns or image keys. Give planned cards stable cardId values when possible so later revisions and retries update instead of duplicate.',
      inputSchema: upsertCardsInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
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
      title: 'Add artwork to one CardForge card',
      description: 'Use when a generated or user-provided PNG/JPEG/WebP belongs in a specific card image slot. Load get_card_generation_contract first, use its exact image fieldKey, and reuse the stable cardId. CardForge embeds the normalized artwork into the same working document.',
      inputSchema: attachCardArtworkInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
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
          content: [{ type: 'text', text: `Artwork was added to ${face} field "${fieldKey}" on card ${cardId}. The working document is now revision ${document.revision}.` }],
          structuredContent: {
            documentId: document.id,
            revision: document.revision,
            cardId,
            fieldKey,
            face,
            openInStudioUrl: studioUrl(document.id, document.revision),
            retrySafety: {
              stableCardId: cardId,
              rule: 'Keep this card id for later artwork or copy revisions.',
            },
            ...workflowMeta('card_artwork_attached', [
              { action: 'preview_card_set', reason: 'Review the set after meaningful card or artwork changes.' },
            ]),
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
      title: 'Review a CardForge card set before opening it in Studio',
      description: 'Use after making one or many cards to review the current set structure and card values. Embedded artwork bytes are omitted from model context. Check that card copy varies as intended, image fields are populated where required, and the set/card ids are stable before opening the exact revision in Studio.',
      inputSchema: getCardSetInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ documentId, setId }) => {
      try {
        const access = await getAccess();
        const document = await getStudioDocument(access.user.id, documentId);
        const set = document.document.cardSets.find((candidate) => candidate.id === setId);
        if (!set) {
          throw new StudioDocumentStoreError(
            'That card set is not part of the current working design. Reload get_card_generation_contract and retry with the current set id.',
            404,
          );
        }
        const cards = document.document.storedCards.filter((card) => card.setId === setId);
        return {
          content: [{ type: 'text', text: `Reviewed "${set.name}" at revision ${document.revision}: ${cards.length} card${cards.length === 1 ? '' : 's'} are in the set. Open this exact revision in Studio only after the card copy and artwork look complete.` }],
          structuredContent: {
            documentId: document.id,
            revision: document.revision,
            set,
            cards: compactValue(cards),
            cardCount: cards.length,
            openInStudioUrl: studioUrl(document.id, document.revision),
            retrySafety: {
              setId: set.id,
              stableCardIds: cards.map((card) => card.uniqueId),
            },
            ...workflowMeta('card_set_reviewed', [
              { action: 'attach_card_artwork', reason: 'Fill any remaining per-card image fields before final review.' },
              { action: 'open_in_studio', reason: 'Open openInStudioUrl to install or update this exact revision in the normal local CardForge workspace.' },
            ]),
          },
        };
      } catch (error) {
        return toolError(error);
      }
    },
  );
};
