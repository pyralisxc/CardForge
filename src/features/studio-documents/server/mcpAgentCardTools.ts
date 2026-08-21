import { createMcpHandler } from 'mcp-handler';

import type { DeveloperCockpitAccess } from '@/features/developer-access/server';
import { observeMcpToolExecution } from '@/features/mcp-usage/server';
import {
  getDeveloperCardGenerationContract,
  upsertDeveloperCards,
  upsertDeveloperCardSet,
} from './developerCardSetDrafts';
import { StudioDocumentStoreError } from './StudioDocumentStoreError';
import {
  cardGenerationContractInputSchema,
  getCardSetInputSchema,
  type McpCardInput,
  upsertCardInputSchema,
  upsertCardsInputSchema,
  upsertCardSetInputSchema,
} from './mcpCardToolSchemas';
import {
  cardGenerationContractOutputSchema,
  cardSetPreviewOutputSchema,
  cardSetWriteOutputSchema,
  cardWriteOutputSchema,
} from './mcpToolOutputSchemas';

const CARDFORGE_MCP_CAPABILITY_VERSION = '0.7.0';

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
  if (typeof value === 'string' && value.startsWith('cardforge-studio-asset://')) return '[private artwork stored by CardForge]';
  if (typeof value === 'string' && value.startsWith('data:')) return '[legacy embedded artwork retained by CardForge]';
  if (Array.isArray(value)) return value.map(compactValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, compactValue(entry)]));
  }
  return value;
};

type ArtworkField = {
  key: string;
  label: string;
  defaultValue?: string;
  isImage: boolean;
};

const isRenderableArtworkReference = (value: string): boolean => (
  value.startsWith('data:')
  || value.startsWith('blob:')
  || value.startsWith('http://')
  || value.startsWith('https://')
  || value.startsWith('/')
);

const getArtworkDiagnostics = ({
  cards,
  frontFields,
  backFields,
}: {
  cards: Array<{ uniqueId: string; data: Record<string, unknown>; backingData?: Record<string, unknown> }>;
  frontFields: ArtworkField[];
  backFields: ArtworkField[];
}) => {
  const faces = [
    { face: 'front' as const, fields: frontFields, getData: (card: typeof cards[number]) => card.data },
    { face: 'back' as const, fields: backFields, getData: (card: typeof cards[number]) => card.backingData ?? {} },
  ];
  const diagnostics = cards.flatMap((card) => faces.flatMap(({ face, fields, getData }) => (
    fields.filter((field) => field.isImage).map((field) => {
      const rawValue = getData(card)[field.key];
      const value = typeof rawValue === 'string' ? rawValue.trim() : '';
      const hasFallback = typeof field.defaultValue === 'string' && isRenderableArtworkReference(field.defaultValue.trim());
      if (value.startsWith('cardforge-studio-asset://')) {
        return { cardId: card.uniqueId, face, fieldKey: field.key, label: field.label, resolution: 'resolved_private' as const };
      }
      if (value && isRenderableArtworkReference(value)) {
        return { cardId: card.uniqueId, face, fieldKey: field.key, label: field.label, resolution: 'renderable_reference' as const };
      }
      if (value) {
        return {
          cardId: card.uniqueId,
          face,
          fieldKey: field.key,
          label: field.label,
          resolution: 'unresolved' as const,
          renderedAs: hasFallback ? 'template_fallback' as const : 'placeholder' as const,
        };
      }
      return {
        cardId: card.uniqueId,
        face,
        fieldKey: field.key,
        label: field.label,
        resolution: hasFallback ? 'template_fallback' as const : 'placeholder' as const,
      };
    })
  )));
  return {
    fields: diagnostics,
    counts: {
      resolvedPrivate: diagnostics.filter((item) => item.resolution === 'resolved_private').length,
      renderableReferences: diagnostics.filter((item) => item.resolution === 'renderable_reference').length,
      unresolved: diagnostics.filter((item) => item.resolution === 'unresolved').length,
      templateFallbacks: diagnostics.filter((item) => item.resolution === 'template_fallback' || item.renderedAs === 'template_fallback').length,
      placeholders: diagnostics.filter((item) => item.resolution === 'placeholder' || item.renderedAs === 'placeholder').length,
    },
  };
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
      return toolError(error);
    }
  };

  server.registerTool(
    'get_card_generation_contract',
    {
      title: 'Prepare a Template for making cards or a bulk card set',
      description: 'Use when the user wants to make cards, generate a deck or set, or turn a list/CSV/JSON into cards. Reads the exact front/back Template fields, required fields, image fields, and CardForge bulk schema before any card write. Never guess card columns or image keys.',
      inputSchema: cardGenerationContractInputSchema,
      outputSchema: cardGenerationContractOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ documentId, setId }) => {
      return runObserved({
        toolName: 'get_card_generation_contract',
        input: { documentId, setId },
        execute: async (access) => {
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
        },
      });
    },
  );

  server.registerTool(
    'upsert_card_set',
    {
      title: 'Create or update a CardForge card set',
      description: 'Use when the user names a set, deck, collection, expansion, or group of cards. Creates or revises that set in the same private working document. Reuse a stable setId on revisions or retries; when setId is omitted CardForge reuses an existing same-name set before creating another one.',
      inputSchema: upsertCardSetInputSchema,
      outputSchema: cardSetWriteOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ documentId, expectedRevision, setId, name, frontTemplateId, backingTemplateId }) => {
      return runObserved({
        toolName: 'upsert_card_set',
        input: { documentId, expectedRevision, setId, name, frontTemplateId, backingTemplateId },
        execute: async (access) => {
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
        },
      });
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
    cards: McpCardInput[];
    bulk: boolean;
  }) => {
    return runObserved({
      toolName: bulk ? 'upsert_cards' : 'upsert_card',
      input: { documentId, expectedRevision, setId, cards },
      execute: async (access) => {
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
          artwork: result.artworkResults,
          cardCount: result.document.document.storedCards.filter((card) => card.setId === result.set.id).length,
          openInStudioUrl: studioUrl(result.document.id, result.document.revision),
          retrySafety: {
            setId: result.set.id,
            stableCardIds: result.updatedIds,
            rule: 'Reuse these exact ids for edits and retries. If the connector response is lost, reload the current revision before retrying the same ids.',
          },
          ...workflowMeta(bulk ? 'bulk_cards_ready' : 'card_ready', [
            { action: bulk ? 'upsert_cards' : 'upsert_card', reason: 'Revise copy or artwork in the same stable-card operation when needed.' },
            { action: 'preview_card_set', reason: 'Review the complete set data before opening the exact revision in Studio.' },
          ]),
        },
        };
      },
    });
  };

  server.registerTool(
    'upsert_card',
    {
      title: 'Make or update one CardForge card',
      description: 'Use for a single card in an existing working set. Load get_card_generation_contract first and use only its Template field keys. Copy and optional artwork are written together; artwork accepts a generated/uploaded public HTTPS sourceUrl or bounded raw base64 fallback. Reuse the returned stable cardId for edits or retries.',
      inputSchema: upsertCardInputSchema,
      outputSchema: cardWriteOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
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
      description: 'Use when the user asks for multiple cards, a deck/set, bulk generation, or conversion of a list/CSV/JSON. Creates or revises up to 100 cards using structured objects and the exact CardForge field contract. Each card can include its artwork so CardForge performs one real bulk write. Never guess card columns or image keys; reuse stable cardId values for revisions and retries.',
      inputSchema: upsertCardsInputSchema,
      outputSchema: cardWriteOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
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
    'preview_card_set',
    {
      title: 'Review a CardForge card set before opening it in Studio',
      description: 'Use after making one or many cards to review the current set structure and card values. Embedded artwork bytes are omitted from model context. Check that card copy varies as intended, image fields are populated where required, and the set/card ids are stable before opening the exact revision in Studio.',
      inputSchema: getCardSetInputSchema,
      outputSchema: cardSetPreviewOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ documentId, setId }) => {
      return runObserved({
        toolName: 'preview_card_set',
        input: { documentId, setId },
        execute: async (access) => {
        const contract = await getDeveloperCardGenerationContract({ access, documentId, setId });
        const document = contract.document;
        const set = document.document.cardSets.find((candidate) => candidate.id === setId);
        if (!set) {
          throw new StudioDocumentStoreError(
            'That card set is not part of the current working design. Reload get_card_generation_contract and retry with the current set id.',
            404,
          );
        }
        const cards = document.document.storedCards.filter((card) => card.setId === setId);
        const artwork = getArtworkDiagnostics({
          cards,
          frontFields: contract.frontFields,
          backFields: contract.backFields,
        });
        return {
          content: [{ type: 'text', text: `Reviewed "${set.name}" at revision ${document.revision}: ${cards.length} card${cards.length === 1 ? '' : 's'}, ${artwork.counts.unresolved} unresolved artwork value${artwork.counts.unresolved === 1 ? '' : 's'}, ${artwork.counts.templateFallbacks} template fallback${artwork.counts.templateFallbacks === 1 ? '' : 's'}, and ${artwork.counts.placeholders} placeholder${artwork.counts.placeholders === 1 ? '' : 's'}.` }],
          structuredContent: {
            documentId: document.id,
            revision: document.revision,
            set,
            cards: compactValue(cards),
            artwork,
            cardCount: cards.length,
            openInStudioUrl: studioUrl(document.id, document.revision),
            retrySafety: {
              setId: set.id,
              stableCardIds: cards.map((card) => card.uniqueId),
            },
            ...workflowMeta('card_set_reviewed', [
              { action: 'upsert_cards', reason: 'Fill unresolved artwork fields or placeholders using the same stable card ids.' },
              { action: 'open_in_studio', reason: 'Open openInStudioUrl to install or update this exact revision in the normal local CardForge workspace.' },
            ]),
          },
          };
        },
      });
    },
  );
};
