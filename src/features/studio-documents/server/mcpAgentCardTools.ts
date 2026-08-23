import { createMcpHandler } from 'mcp-handler';

import type { DeveloperCockpitAccess } from '@/features/developer-access/server';
import { observeMcpToolExecution } from '@/features/mcp-usage/server';
import {
  deleteDeveloperCards,
  deleteDeveloperCardSet,
  getDeveloperCardGenerationContract,
  moveDeveloperCards,
  upsertDeveloperCards,
  upsertDeveloperCardSet,
} from './developerCardSetDrafts';
import { ensureSetContactSheetArtifact } from './studioRenderArtifacts';
import { renderArtifactImageContent, renderArtifactStructuredContent } from './mcpRenderArtifactResults';
import { StudioDocumentStoreError } from './StudioDocumentStoreError';
import {
  cardGenerationContractInputSchema,
  deleteCardsInputSchema,
  deleteCardSetInputSchema,
  getCardSetInputSchema,
  type McpCardInput,
  type McpCardWriteMode,
  moveCardsInputSchema,
  upsertCardInputSchema,
  upsertCardsInputSchema,
  upsertCardSetInputSchema,
} from './mcpCardToolSchemas';
import {
  cardDeleteOutputSchema,
  cardGenerationContractOutputSchema,
  cardMoveOutputSchema,
  cardSetDeleteOutputSchema,
  cardSetPreviewOutputSchema,
  cardSetWriteOutputSchema,
  cardWriteOutputSchema,
} from './mcpToolOutputSchemas';

const CARDFORGE_MCP_CAPABILITY_VERSION = '0.8.0';

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
      title: 'Prepare a Template for making or revising cards',
      description: 'Read the exact front/back Template fields, required fields, image fields, and bulk schema before any card write. Use this for new cards and before revising an existing Set. Never guess card columns or image keys.',
      inputSchema: cardGenerationContractInputSchema,
      outputSchema: cardGenerationContractOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ documentId, setId }) => runObserved({
      toolName: 'get_card_generation_contract',
      input: { documentId, setId },
      execute: async (access) => {
        const result = await getDeveloperCardGenerationContract({ access, documentId, setId });
        const resolvedSetId = result.set?.id ?? null;
        return {
          content: [{
            type: 'text',
            text: `CardForge is ready to make or revise cards from "${result.document.title}" revision ${result.document.revision}. Use only the returned field keys and use revise mode with stable card ids for existing cards.`,
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
              rule: 'Reuse this set id and the stable card ids returned by card writes. Existing-card revisions should use writeMode revise so missing ids cannot become duplicates.',
            },
            ...workflowMeta('card_contract_ready', [
              { action: 'upsert_card_set', reason: 'Name or update the working set before generation when needed.' },
              { action: 'upsert_card', reason: 'Make or revise one card using the exact returned fields.' },
              { action: 'upsert_cards', reason: 'Generate or revise multiple cards in one bounded bulk pass.' },
              { action: 'preview_card_set', reason: 'Read stable existing card ids before a revision pass.' },
            ]),
          },
        };
      },
    }),
  );

  server.registerTool(
    'upsert_card_set',
    {
      title: 'Create or update a CardForge card set',
      description: 'Create or revise a named Set in the same private working document. Reuse a stable setId on revisions or retries; when setId is omitted CardForge reuses an existing same-name Set before creating another one.',
      inputSchema: upsertCardSetInputSchema,
      outputSchema: cardSetWriteOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ documentId, expectedRevision, setId, name, frontTemplateId, backingTemplateId }) => runObserved({
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
          content: [{ type: 'text', text: `"${set?.name ?? name}" is the working CardForge Set at revision ${document.revision}. Load its exact card fields before making or revising cards.` }],
          structuredContent: {
            documentId: document.id,
            revision: document.revision,
            set,
            openInStudioUrl: studioUrl(document.id, document.revision),
            retrySafety: {
              setId: set?.id ?? null,
              rule: 'Reuse this Set id on every later revision or retry.',
            },
            ...workflowMeta('card_set_ready', [
              { action: 'get_card_generation_contract', reason: 'Load the real Template fields before making or revising cards.' },
            ]),
          },
        };
      },
    }),
  );

  const writeCards = async ({
    documentId,
    expectedRevision,
    setId,
    cards,
    bulk,
    writeMode = 'upsert',
  }: {
    documentId: string;
    expectedRevision: number;
    setId: string;
    cards: McpCardInput[];
    bulk: boolean;
    writeMode?: McpCardWriteMode;
  }) => runObserved({
    toolName: bulk ? 'upsert_cards' : 'upsert_card',
    input: { documentId, expectedRevision, setId, writeMode, cards },
    execute: async (access) => {
      const result = await upsertDeveloperCards({ access, documentId, expectedRevision, setId, cards, writeMode });
      const action = result.addedIds.length > 0 && result.revisedIds.length > 0
        ? `${result.addedIds.length} added and ${result.revisedIds.length} revised`
        : result.revisedIds.length > 0
          ? `${result.revisedIds.length} revised`
          : `${result.addedIds.length} added`;
      return {
        content: [{
          type: 'text' as const,
          text: `${bulk ? 'Bulk card write' : 'Card write'} completed for "${result.set.name}": ${action}. The working document is now revision ${result.document.revision}; the user’s browser workspace is not changed until that exact revision is applied.`,
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
            rule: 'Reuse these exact ids for edits and retries. Use writeMode revise for existing cards so a changed data payload cannot create a replacement id.',
          },
          ...workflowMeta(bulk ? 'bulk_cards_ready' : 'card_ready', [
            { action: 'preview_card_set', reason: 'Review the complete Set and stable ids before applying this exact revision in Studio.' },
            { action: bulk ? 'upsert_cards' : 'upsert_card', reason: 'Revise copy or artwork in place using writeMode revise and the same stable ids.' },
          ]),
        },
      };
    },
  });

  server.registerTool(
    'upsert_card',
    {
      title: 'Make or revise one CardForge card',
      description: 'Use for one card in a working Set. Load get_card_generation_contract first. For an existing card use writeMode revise and its current cardId; CardForge will fail rather than silently create a duplicate. Copy and optional artwork are written together.',
      inputSchema: upsertCardInputSchema,
      outputSchema: cardWriteOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ documentId, expectedRevision, setId, writeMode, card }) => writeCards({
      documentId,
      expectedRevision,
      setId,
      writeMode,
      cards: [card],
      bulk: false,
    }),
  );

  server.registerTool(
    'upsert_cards',
    {
      title: 'Make or revise CardForge cards in bulk',
      description: 'Use for multiple cards, list/CSV/JSON conversion, or a bounded multi-card revision. Creates or revises up to 100 cards in one operation. For existing cards use writeMode revise and provide every stable cardId; this is the preferred way to update an existing Set without duplicates. Per-card artwork accepts a generated/uploaded public HTTPS sourceUrl or bounded raw base64 through the exact image-field contract.',
      inputSchema: upsertCardsInputSchema,
      outputSchema: cardWriteOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ documentId, expectedRevision, setId, writeMode, cards }) => writeCards({
      documentId,
      expectedRevision,
      setId,
      writeMode,
      cards,
      bulk: true,
    }),
  );

  server.registerTool(
    'delete_cards',
    {
      title: 'Delete cards from an agent working Set',
      description: 'Remove one or more cards by stable card id from the private agent working document. Use only after the user asks to remove those cards. This does not change a browser-local or cloud-saved Set until the relevant revision is applied or committed.',
      inputSchema: deleteCardsInputSchema,
      outputSchema: cardDeleteOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ documentId, expectedRevision, setId, cardIds }) => runObserved({
      toolName: 'delete_cards',
      input: { documentId, expectedRevision, setId, cardIds },
      execute: async (access) => {
        const result = await deleteDeveloperCards({ access, documentId, expectedRevision, setId, cardIds });
        return {
          content: [{ type: 'text', text: `Deleted ${result.deletedIds.length} card${result.deletedIds.length === 1 ? '' : 's'} from "${result.set.name}" in agent revision ${result.document.revision}.` }],
          structuredContent: {
            documentId: result.document.id,
            revision: result.document.revision,
            setId: result.set.id,
            deletedCardIds: result.deletedIds,
            openInStudioUrl: studioUrl(result.document.id, result.document.revision),
          },
        };
      },
    }),
  );

  server.registerTool(
    'move_cards',
    {
      title: 'Move cards between agent working Sets',
      description: 'Move existing stable card ids from one Set to another in the same private working document. CardForge validates the target Template contract before moving so incompatible card data is not silently broken.',
      inputSchema: moveCardsInputSchema,
      outputSchema: cardMoveOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ documentId, expectedRevision, sourceSetId, targetSetId, cardIds }) => runObserved({
      toolName: 'move_cards',
      input: { documentId, expectedRevision, sourceSetId, targetSetId, cardIds },
      execute: async (access) => {
        const result = await moveDeveloperCards({ access, documentId, expectedRevision, sourceSetId, targetSetId, cardIds });
        return {
          content: [{ type: 'text', text: `Moved ${result.movedIds.length} card${result.movedIds.length === 1 ? '' : 's'} from "${result.sourceSet.name}" to "${result.targetSet.name}" at revision ${result.document.revision}.` }],
          structuredContent: {
            documentId: result.document.id,
            revision: result.document.revision,
            sourceSet: result.sourceSet,
            targetSet: result.targetSet,
            movedCardIds: result.movedIds,
            openInStudioUrl: studioUrl(result.document.id, result.document.revision),
          },
        };
      },
    }),
  );

  server.registerTool(
    'delete_card_set',
    {
      title: 'Delete a Set from an agent working document',
      description: 'Remove a Set from the private agent working document. A non-empty Set is refused unless deleteCards is explicitly true, so normal Set deletion cannot silently destroy cards.',
      inputSchema: deleteCardSetInputSchema,
      outputSchema: cardSetDeleteOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ documentId, expectedRevision, setId, deleteCards }) => runObserved({
      toolName: 'delete_card_set',
      input: { documentId, expectedRevision, setId, deleteCards },
      execute: async (access) => {
        const result = await deleteDeveloperCardSet({ access, documentId, expectedRevision, setId, deleteCards });
        return {
          content: [{
            type: 'text',
            text: `Deleted Set "${result.deletedSet.name}" from the agent working document at revision ${result.document.revision}${result.deletedCardIds.length ? ` together with ${result.deletedCardIds.length} card${result.deletedCardIds.length === 1 ? '' : 's'}` : ''}.`,
          }],
          structuredContent: {
            documentId: result.document.id,
            revision: result.document.revision,
            deletedSetId: result.deletedSet.id,
            deletedCardIds: result.deletedCardIds,
            activeSetId: result.document.document.activeCardSetId ?? null,
            openInStudioUrl: studioUrl(result.document.id, result.document.revision),
          },
        };
      },
    }),
  );

  server.registerTool(
    'preview_card_set',
    {
      title: 'Visually review a CardForge Set before applying or committing it',
      description: 'Review the current agent Set structure, stable ids, artwork diagnostics, install state, and representative native CardForge renders. Use after meaningful copy or artwork changes. Do not call a Set visually finished from field diagnostics alone; inspect the rendered cards shown in chat.',
      inputSchema: getCardSetInputSchema,
      outputSchema: cardSetPreviewOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ documentId, setId }) => runObserved({
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
        const applied = document.lastInstalledRevision === document.revision;
        const rendered = await ensureSetContactSheetArtifact({
          ownerUserId: access.user.id,
          document,
          setId: set.id,
          publicOrigin,
        });
        return {
          content: [{
            type: 'text' as const,
            text: `Reviewed "${set.name}" at revision ${document.revision}: ${cards.length} card${cards.length === 1 ? '' : 's'}, ${artwork.counts.unresolved} unresolved artwork value${artwork.counts.unresolved === 1 ? '' : 's'}, ${artwork.counts.templateFallbacks} template fallback${artwork.counts.templateFallbacks === 1 ? '' : 's'}, and ${artwork.counts.placeholders} placeholder${artwork.counts.placeholders === 1 ? '' : 's'}. ${rendered.artifact ? `The native image is a contact sheet composed only from ${rendered.previewSampleCount} canonical CardForge card renders.` : 'This Set has no cards to render yet.'} This exact revision is ${applied ? 'already applied to a CardForge Studio workspace' : 'not yet acknowledged as applied in Studio'}.`,
          }, ...(rendered.artifact ? [renderArtifactImageContent(rendered.artifact)] : [])],
          structuredContent: {
            documentId: document.id,
            revision: document.revision,
            set,
            cards: compactValue(cards),
            artwork,
            cardCount: cards.length,
            renderArtifact: rendered.artifact ? renderArtifactStructuredContent(rendered.artifact) : null,
            previewSampleCount: rendered.previewSampleCount,
            installation: {
              currentRevisionApplied: applied,
              lastInstalledRevision: document.lastInstalledRevision,
              lastInstalledAt: document.lastInstalledAt,
            },
            openInStudioUrl: studioUrl(document.id, document.revision),
            retrySafety: {
              setId: set.id,
              stableCardIds: cards.map((card) => card.uniqueId),
            },
            ...workflowMeta('card_set_reviewed', [
              { action: 'upsert_cards', reason: 'Use writeMode revise with these stable ids for any remaining copy or artwork changes.' },
              { action: 'open_in_studio', reason: 'Open openInStudioUrl to apply this exact revision to the normal local CardForge workspace.' },
              { action: 'commit_cloud_set', reason: 'If this working document came from a cloud checkout and the user wants the cloud save updated, commit only after visual review.' },
            ]),
          },
        };
      },
    }),
  );
};
