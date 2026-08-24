import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  createMcpWorkflowDocumentKey,
  observeMcpToolExecution,
} from '@/features/mcp-usage/server';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const conflictError = () => {
  const error = new Error('The expected revision is stale; reload the current revision.');
  return Object.assign(error, { status: 409 });
};

describe('MCP workflow efficiency telemetry', () => {
  it('correlates editing sequences with a one-way document key instead of storing raw ids', () => {
    const first = createMcpWorkflowDocumentKey('user-1', 'document-123');
    const repeated = createMcpWorkflowDocumentKey('user-1', 'document-123');
    const otherOwner = createMcpWorkflowDocumentKey('user-2', 'document-123');

    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).toBe(repeated);
    expect(first).not.toBe(otherOwner);
    expect(first).not.toContain('document-123');
  });

  it('counts one sparse mutation as one workflow call and one revision without recording payload content', async () => {
    const record = vi.fn().mockResolvedValue(true);
    const recordWorkflow = vi.fn().mockResolvedValue(true);
    const result = await observeMcpToolExecution({
      ownerUserId: 'user-1',
      toolName: 'patch_cards',
      input: {
        documentId: 'document-123',
        expectedRevision: 8,
        cards: [{ cardId: 'card-1', fields: { rules_text: 'private card copy' } }],
      },
      execute: async () => ({ structuredContent: { revision: 9, replayed: false } }),
      record,
      recordWorkflow,
    });

    expect(result).toEqual({ structuredContent: { revision: 9, replayed: false } });
    expect(recordWorkflow).toHaveBeenNthCalledWith(1, expect.objectContaining({
      ownerUserId: 'user-1',
      documentId: 'document-123',
      toolCalls: 1,
    }));
    expect(recordWorkflow).toHaveBeenLastCalledWith(expect.objectContaining({
      revisions: 1,
      retries: 0,
      duplicatePreventions: 0,
      createIfMissing: false,
    }));
    expect(JSON.stringify(recordWorkflow.mock.calls)).not.toContain('private card copy');
  });

  it('records timeout reconciliation and idempotent replay as retry and duplicate prevention without another revision', async () => {
    const replayRecord = vi.fn().mockResolvedValue(true);
    await observeMcpToolExecution({
      ownerUserId: 'user-1',
      toolName: 'patch_working_document',
      input: { documentId: 'document-123', expectedRevision: 9, operationId: 'op-1' },
      execute: async () => ({ structuredContent: { revision: 9, replayed: true } }),
      record: vi.fn().mockResolvedValue(true),
      recordWorkflow: replayRecord,
    });

    expect(replayRecord).toHaveBeenLastCalledWith(expect.objectContaining({
      revisions: 0,
      retries: 1,
      duplicatePreventions: 1,
    }));

    const statusRecord = vi.fn().mockResolvedValue(true);
    await observeMcpToolExecution({
      ownerUserId: 'user-1',
      toolName: 'get_working_document_operation_status',
      input: { documentId: 'document-123', operationId: 'op-1' },
      execute: async () => ({ structuredContent: { status: 'committed' } }),
      record: vi.fn().mockResolvedValue(true),
      recordWorkflow: statusRecord,
    });
    expect(statusRecord).toHaveBeenLastCalledWith(expect.objectContaining({ retries: 1 }));
  });

  it('tracks revision conflicts and stable-id duplicate prevention while failing open', async () => {
    const recordWorkflow = vi.fn().mockResolvedValue(true);
    await expect(observeMcpToolExecution({
      ownerUserId: 'user-1',
      toolName: 'patch_cards',
      input: { documentId: 'document-123', expectedRevision: 7, cards: [{ cardId: 'card-1' }] },
      execute: async () => { throw conflictError(); },
      record: vi.fn().mockResolvedValue(true),
      recordWorkflow,
    })).rejects.toThrow('expected revision is stale');

    expect(recordWorkflow).toHaveBeenLastCalledWith(expect.objectContaining({
      revisionConflicts: 1,
      duplicatePreventions: 1,
      createIfMissing: false,
    }));

    await expect(observeMcpToolExecution({
      ownerUserId: 'user-1',
      toolName: 'patch_cards',
      input: { documentId: 'document-123' },
      execute: async () => 'still succeeds',
      record: vi.fn().mockResolvedValue(true),
      recordWorkflow: vi.fn().mockRejectedValue(new Error('telemetry offline')),
    })).resolves.toBe('still succeeds');
  });

  it('stores the required workflow KPIs without user content and renders only cache misses', () => {
    const migration = readSource('supabase/migrations/20260824043000_mcp_workflow_efficiency.sql');
    const telemetry = readSource('src/features/mcp-usage/server/mcpWorkflowTelemetry.ts');
    const renderer = readSource('src/features/studio-documents/server/studioRenderArtifacts.ts');

    expect(migration).toContain('average_calls_per_completed_workflow');
    expect(migration).toContain('average_revisions_per_completed_workflow');
    expect(migration).toContain('canonical_renders_per_revision');
    expect(migration).toContain('cache_hit_rate');
    expect(migration).toContain('duplicate_preventions');
    expect(migration).toContain('average_upload_latency_ms');
    expect(migration).toContain('average_render_latency_ms');
    const workflowColumns = migration.match(/create table public\.cardforge_mcp_workflow_runs \(([\s\S]*?)\n\);/)?.[1] ?? '';
    expect(workflowColumns).not.toMatch(/prompt|card_content|document_payload|raw_document|title|asset_bytes/i);
    expect(workflowColumns).toContain('document_key');
    expect(telemetry).toContain("createHash('sha256')");
    expect(renderer).toContain('missingIndexes');
    expect(renderer).toContain('expectedCount: missingCards.length');
    expect(renderer).toContain('cacheHits: artifacts.filter');
    expect(renderer).toContain('canonicalRenders: renderedImages.length');
  });
});
