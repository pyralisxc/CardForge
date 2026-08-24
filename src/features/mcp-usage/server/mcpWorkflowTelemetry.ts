import { createHash } from 'node:crypto';

import { getSupabaseServerClient, getSupabaseServerConfigStatus } from '@/infrastructure/database/supabaseServer';

import { observeMcpToolExecution as observeBaseMcpToolExecution } from './mcpUsageStore';

export interface McpWorkflowObservation {
  ownerUserId: string;
  documentId: string;
  toolCalls?: number;
  revisions?: number;
  canonicalRenders?: number;
  renderCacheChecks?: number;
  cacheHits?: number;
  retries?: number;
  validationFailures?: number;
  revisionConflicts?: number;
  duplicatePreventions?: number;
  uploadOperations?: number;
  uploadLatencyMs?: number;
  renderOperations?: number;
  renderLatencyMs?: number;
  complete?: boolean;
  createIfMissing?: boolean;
}

type UsageObservationRecorder = (observation: {
  actionUnits: number;
  durationMs: number;
  ownerUserId: string;
  requestBytes: number;
  responseBytes: number;
  succeeded: boolean;
  toolName: string;
}) => Promise<boolean>;

type WorkflowObservationRecorder = (observation: McpWorkflowObservation) => Promise<boolean>;

const REVISION_MUTATION_TOOLS = new Set([
  'patch_working_document',
  'patch_cards',
  'attach_template_artworks',
  'update_editable_template',
  'attach_template_artwork',
  'upsert_card_set',
  'upsert_card',
  'upsert_cards',
  'delete_cards',
  'move_cards',
  'delete_card_set',
]);

const STABLE_ID_MUTATION_TOOLS = new Set([
  'patch_working_document',
  'patch_cards',
  'attach_template_artworks',
  'update_editable_template',
  'attach_template_artwork',
]);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const nonNegativeInteger = (value: number | undefined, max: number): number => (
  Number.isFinite(value) ? Math.min(max, Math.max(0, Math.trunc(value ?? 0))) : 0
);

export const createMcpWorkflowDocumentKey = (ownerUserId: string, documentId: string): string => (
  createHash('sha256').update(`${ownerUserId}:${documentId}`).digest('hex')
);

export const recordMcpWorkflowObservation = async ({
  ownerUserId,
  documentId,
  toolCalls = 0,
  revisions = 0,
  canonicalRenders = 0,
  renderCacheChecks = 0,
  cacheHits = 0,
  retries = 0,
  validationFailures = 0,
  revisionConflicts = 0,
  duplicatePreventions = 0,
  uploadOperations = 0,
  uploadLatencyMs = 0,
  renderOperations = 0,
  renderLatencyMs = 0,
  complete = false,
  createIfMissing = true,
}: McpWorkflowObservation): Promise<boolean> => {
  const supabase = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !supabase) return false;
  const { error } = await supabase.rpc('cardforge_record_mcp_workflow_observation', {
    p_owner_user_id: ownerUserId,
    p_document_key: createMcpWorkflowDocumentKey(ownerUserId, documentId),
    p_tool_calls: nonNegativeInteger(toolCalls, 10_000),
    p_revisions: nonNegativeInteger(revisions, 10_000),
    p_canonical_renders: nonNegativeInteger(canonicalRenders, 100_000),
    p_render_cache_checks: nonNegativeInteger(renderCacheChecks, 100_000),
    p_cache_hits: nonNegativeInteger(cacheHits, 100_000),
    p_retries: nonNegativeInteger(retries, 10_000),
    p_validation_failures: nonNegativeInteger(validationFailures, 10_000),
    p_revision_conflicts: nonNegativeInteger(revisionConflicts, 10_000),
    p_duplicate_preventions: nonNegativeInteger(duplicatePreventions, 10_000),
    p_upload_operations: nonNegativeInteger(uploadOperations, 10_000),
    p_upload_latency_ms: nonNegativeInteger(uploadLatencyMs, 86_400_000),
    p_render_operations: nonNegativeInteger(renderOperations, 10_000),
    p_render_latency_ms: nonNegativeInteger(renderLatencyMs, 86_400_000),
    p_complete: complete,
    p_create_if_missing: createIfMissing,
  });
  if (error) {
    console.error('Failed to record MCP workflow observation:', error);
    return false;
  }
  return true;
};

const getDocumentId = (input: unknown): string | null => {
  if (!isRecord(input)) return null;
  return typeof input.documentId === 'string' && input.documentId.trim()
    ? input.documentId.trim()
    : null;
};

const structuredContent = (result: unknown): Record<string, unknown> => {
  if (!isRecord(result) || !isRecord(result.structuredContent)) return {};
  return result.structuredContent;
};

const hasArtworkPayload = (input: unknown): boolean => {
  if (!isRecord(input)) return false;
  if (Array.isArray(input.artworks) && input.artworks.length > 0) return true;
  if (Array.isArray(input.templateArtworks) && input.templateArtworks.length > 0) return true;
  const cardCandidates = [
    ...(Array.isArray(input.cards) ? input.cards : []),
    ...(isRecord(input.card) ? [input.card] : []),
  ];
  return cardCandidates.some((candidate) => isRecord(candidate)
    && Array.isArray(candidate.artwork)
    && candidate.artwork.length > 0);
};

const stableIdMutationCouldPreventDuplicate = (toolName: string, input: unknown): boolean => {
  if (STABLE_ID_MUTATION_TOOLS.has(toolName)) return true;
  if (!['upsert_card', 'upsert_cards'].includes(toolName) || !isRecord(input)) return false;
  return input.writeMode === 'revise';
};

const errorStatus = (error: unknown): number | null => (
  isRecord(error) && typeof error.status === 'number' ? error.status : null
);

const errorMessage = (error: unknown): string => (
  error instanceof Error ? error.message : isRecord(error) && typeof error.message === 'string' ? error.message : ''
);

const safeWorkflowRecord = async (
  recordWorkflow: WorkflowObservationRecorder,
  observation: McpWorkflowObservation,
): Promise<void> => {
  try {
    await recordWorkflow(observation);
  } catch (error) {
    console.error('MCP workflow recorder failed open:', error);
  }
};

export const observeMcpToolExecution = async <Result>({
  ownerUserId,
  toolName,
  input,
  execute,
  record,
  recordWorkflow = recordMcpWorkflowObservation,
}: {
  ownerUserId: string;
  toolName: string;
  input: unknown;
  execute: () => Promise<Result>;
  record?: UsageObservationRecorder;
  recordWorkflow?: WorkflowObservationRecorder;
}): Promise<Result> => {
  const documentId = getDocumentId(input);
  if (documentId) {
    await safeWorkflowRecord(recordWorkflow, {
      ownerUserId,
      documentId,
      toolCalls: 1,
    });
  }

  const startedAt = Date.now();
  try {
    const result = await observeBaseMcpToolExecution({
      ownerUserId,
      toolName,
      input,
      execute,
      ...(record ? { record } : {}),
    });
    if (documentId) {
      const structured = structuredContent(result);
      const replayed = structured.replayed === true;
      const statusLookup = toolName === 'get_working_document_operation_status';
      const uploadOperation = ['attach_template_artwork', 'attach_template_artworks'].includes(toolName)
        || hasArtworkPayload(input);
      await safeWorkflowRecord(recordWorkflow, {
        ownerUserId,
        documentId,
        revisions: REVISION_MUTATION_TOOLS.has(toolName) && !replayed ? 1 : 0,
        retries: replayed || statusLookup ? 1 : 0,
        duplicatePreventions: replayed ? 1 : 0,
        validationFailures: toolName === 'validate_working_document' && structured.valid === false ? 1 : 0,
        uploadOperations: uploadOperation ? 1 : 0,
        uploadLatencyMs: uploadOperation ? Math.max(0, Date.now() - startedAt) : 0,
        complete: toolName === 'preview_card_set',
        createIfMissing: false,
      });
    }
    return result;
  } catch (error) {
    if (documentId) {
      const status = errorStatus(error);
      const message = errorMessage(error);
      const revisionConflict = status === 409 && /revision|stale|expected/i.test(message);
      const duplicatePrevented = stableIdMutationCouldPreventDuplicate(toolName, input)
        && (status === 404 || revisionConflict);
      const validationFailure = /validation|structural|unknown field|required field|contract/i.test(message);
      await safeWorkflowRecord(recordWorkflow, {
        ownerUserId,
        documentId,
        revisionConflicts: revisionConflict ? 1 : 0,
        duplicatePreventions: duplicatePrevented ? 1 : 0,
        validationFailures: validationFailure ? 1 : 0,
        createIfMissing: false,
      });
    }
    throw error;
  }
};
