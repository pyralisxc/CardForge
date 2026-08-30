import { createMcpHandler } from 'mcp-handler';

import type { StudioAgentAccess } from './studioAgentAccess';
import { requireAccountToolCapability } from '@/features/account/server';
import { observeMcpToolExecution } from '@/features/mcp-usage/server';

import { getWorkingDocumentOperationStatusInputSchema } from './mcpOperationStatusSchema';
import {
  attachTemplateArtworksInputSchema,
  patchCardsInputSchema,
  patchWorkingDocumentInputSchema,
  previewCardsInputSchema,
  validateWorkingDocumentInputSchema,
} from './mcpWorkingDocumentSchemas';
import {
  selectiveCardPreviewOutputSchema,
  workingDocumentOperationStatusOutputSchema,
  workingDocumentPatchOutputSchema,
  workingDocumentValidationOutputSchema,
} from './mcpWorkingDocumentOutputSchemas';
import { renderArtifactImageContent, renderArtifactStructuredContent } from './mcpRenderArtifactResults';
import { getStudioDocumentRetentionHours } from './studioDocumentAccess';
import { getStudioDocument } from './studioDocumentStore';
import { ensureSelectedCardArtifacts } from './studioRenderArtifacts';
import {
  getWorkingDocumentOperationStatus,
  patchWorkingDocument,
} from './workingDocumentPatches';
import { getWorkingDocumentStructuralValidation } from './workingDocumentValidation';

const CARDFORGE_MCP_CAPABILITY_VERSION = '1.0.0';

type RegistrationCallback = Parameters<typeof createMcpHandler>[0];
type McpRegistrationServer = Parameters<RegistrationCallback>[0];
type ToolErrorResult = {
  isError: boolean;
  content: Array<{ type: 'text'; text: string }>;
  _meta?: Record<string, unknown>;
};

export const registerWorkingDocumentTools = ({
  server,
  publicOrigin,
  getAccess,
  toolError,
}: {
  server: McpRegistrationServer;
  publicOrigin: string;
  getAccess: () => Promise<StudioAgentAccess>;
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
    execute: (access: StudioAgentAccess) => Promise<Result>;
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

  const mutationResult = (result: Awaited<ReturnType<typeof patchWorkingDocument>>) => ({
    content: [{
      type: 'text' as const,
      text: result.replayed
        ? `CardForge reconciled operation ${result.operationId}: it already committed at revision ${result.committedRevision}, so no duplicate mutation was performed.`
        : `CardForge committed the atomic sparse patch as one transaction at revision ${result.committedRevision}.`,
    }],
    structuredContent: {
      documentId: result.document.id,
      revision: result.committedRevision,
      operationId: result.operationId ?? null,
      replayed: result.replayed,
      changedTemplateIds: result.changedTemplateIds,
      changedElementIds: result.changedElementIds,
      changedCardIds: result.changedCardIds,
      changedAssetRequirementIds: result.changedAssetRequirementIds,
      warnings: result.warnings,
      canonicalRenderingRecommended: result.canonicalRenderingRecommended,
      openInStudioUrl: studioUrl(result.document.id, result.committedRevision),
    },
  });

  server.registerTool(
    'patch_working_document',
    {
      title: 'Atomically patch a CardForge working document',
      description: 'Preferred editing path after one initial read. Sparse-patch existing Templates/elements, existing cards, and multiple Template artworks in one expectedRevision transaction. CardForge validates first, commits exactly one revision or nothing, never creates replacement stable objects, preserves compatible legacy card data with warnings, and supports operationId reconciliation for timed-out mutations.',
      inputSchema: patchWorkingDocumentInputSchema,
      outputSchema: workingDocumentPatchOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async (input) => runObserved({
      toolName: 'patch_working_document',
      input,
      execute: async (access) => mutationResult(await patchWorkingDocument({ access, input })),
    }),
  );

  server.registerTool(
    'patch_cards',
    {
      title: 'Sparse-patch existing CardForge cards',
      description: 'Patch only changed fields on existing stable card ids. There is no creation path. Omitted fields remain unchanged; unsetFields/unsetBackingFields explicitly remove values. All cards commit atomically as one revision and legacy/orphaned stored fields are preserved with structured warnings.',
      inputSchema: patchCardsInputSchema,
      outputSchema: workingDocumentPatchOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ documentId, expectedRevision, operationId, cards }) => runObserved({
      toolName: 'patch_cards',
      input: { documentId, expectedRevision, operationId, cards },
      execute: async (access) => mutationResult(await patchWorkingDocument({
        access,
        input: { documentId, expectedRevision, operationId, cardPatches: cards },
      })),
    }),
  );

  server.registerTool(
    'attach_template_artworks',
    {
      title: 'Attach multiple Template artworks atomically',
      description: 'Normalize and bind up to 64 PNG/JPEG/WebP artwork sources to existing Template/binding targets in one expectedRevision transaction. The complete source schema is explicit: mimeType plus exactly one of data or sourceUrl. WebP is decoded and re-encoded before storage. One successful batch advances one revision.',
      inputSchema: attachTemplateArtworksInputSchema,
      outputSchema: workingDocumentPatchOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ documentId, expectedRevision, operationId, artworks }) => runObserved({
      toolName: 'attach_template_artworks',
      input: { documentId, expectedRevision, operationId, artworks },
      execute: async (access) => mutationResult(await patchWorkingDocument({
        access,
        input: { documentId, expectedRevision, operationId, templateArtworks: artworks },
      })),
    }),
  );

  server.registerTool(
    'validate_working_document',
    {
      title: 'Validate CardForge working-document structure without a browser',
      description: 'Cheap non-Chromium validation for duplicate/stale IDs, Template and Set references, field contracts, missing required card fields, preserved orphan fields, production-plan binding targets, and unresolved structural asset references. Use after a compound patch; canonical rendering is still recommended for visual truth.',
      inputSchema: validateWorkingDocumentInputSchema,
      outputSchema: workingDocumentValidationOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ documentId }) => runObserved({
      toolName: 'validate_working_document',
      input: { documentId },
      execute: async (access) => {
        requireAccountToolCapability(access, 'studio.ai.create');
        const result = await getWorkingDocumentStructuralValidation({ access, documentId });
        return {
          content: [{
            type: 'text' as const,
            text: result.valid
              ? `Structural validation passed for revision ${result.document.revision}. Canonical rendering remains the visual source of truth.`
              : `Structural validation found errors in revision ${result.document.revision}; fix them before final canonical review.`,
          }],
          structuredContent: {
            documentId: result.document.id,
            revision: result.document.revision,
            valid: result.valid,
            issues: result.issues,
            canonicalRenderingRecommended: result.canonicalRenderingRecommended,
            openInStudioUrl: studioUrl(result.document.id, result.document.revision),
          },
        };
      },
    }),
  );

  server.registerTool(
    'get_working_document_operation_status',
    {
      title: 'Reconcile a timed-out CardForge mutation',
      description: 'Look up an operationId previously supplied to patch_working_document, patch_cards, or attach_template_artworks. A committed receipt proves the mutation advanced exactly the recorded revision. Unknown means reload current state before deciding whether to retry; do not blindly repeat a mutation.',
      inputSchema: getWorkingDocumentOperationStatusInputSchema,
      outputSchema: workingDocumentOperationStatusOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ documentId, operationId }) => runObserved({
      toolName: 'get_working_document_operation_status',
      input: { documentId, operationId },
      execute: async (access) => {
        const result = await getWorkingDocumentOperationStatus({ access, documentId, operationId });
        return {
          content: [{
            type: 'text' as const,
            text: result.status === 'committed'
              ? `Operation ${operationId} committed at revision ${result.receipt!.revision}. Do not retry it.`
              : `Operation ${operationId} is not present in this document's recent receipt window. Reload revision ${result.document.revision} and compare current state before any retry.`,
          }],
          structuredContent: {
            documentId: result.document.id,
            currentRevision: result.document.revision,
            operationId,
            status: result.status,
            receipt: result.receipt,
          },
        };
      },
    }),
  );

  server.registerTool(
    'preview_cards',
    {
      title: 'Canonically render selected CardForge cards',
      description: 'Render one or more explicit stable card ids with the same canonical CardForge browser renderer used by full Set validation. Use during iteration for changed/representative cards, then use preview_card_set once for final contact-sheet review.',
      inputSchema: previewCardsInputSchema,
      outputSchema: selectiveCardPreviewOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ documentId, setId, cardIds }) => runObserved({
      toolName: 'preview_cards',
      input: { documentId, setId, cardIds },
      execute: async (access) => {
        requireAccountToolCapability(access, 'studio.ai.create');
        const document = await getStudioDocument(
          access.user.id,
          documentId,
          await getStudioDocumentRetentionHours(access.entitlement),
        );
        const rendered = await ensureSelectedCardArtifacts({
          ownerUserId: access.user.id,
          document,
          setId,
          cardIds,
          publicOrigin,
        });
        return {
          content: [
            { type: 'text' as const, text: `Canonical rendering succeeded for ${rendered.cardIds.length} selected card${rendered.cardIds.length === 1 ? '' : 's'} at revision ${document.revision}. Artwork render health is rendered for these exact cards.` },
            ...rendered.artifacts.map(renderArtifactImageContent),
          ],
          structuredContent: {
            documentId: document.id,
            revision: document.revision,
            setId,
            cardIds: rendered.cardIds,
            renderArtifacts: rendered.artifacts.map(renderArtifactStructuredContent),
            renderHealth: { status: 'rendered', renderedCardIds: rendered.cardIds },
            openInStudioUrl: studioUrl(document.id, document.revision),
          },
        };
      },
    }),
  );

  void CARDFORGE_MCP_CAPABILITY_VERSION;
};
