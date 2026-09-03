import { describe, expect, it, vi } from 'vitest';

import {
  createMcpWorkflowDocumentKey,
  observeMcpToolExecution,
} from '@/features/mcp-usage/server';

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
    expect(recordWorkflow).toHaveBeenCalledTimes(1);
    expect(recordWorkflow).toHaveBeenCalledWith(expect.objectContaining({
      ownerUserId: 'user-1',
      documentId: 'document-123',
      toolCalls: 1,
      revisions: 1,
      retries: 0,
      duplicatePreventions: 0,
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

    expect(replayRecord).toHaveBeenCalledTimes(1);
    expect(replayRecord).toHaveBeenCalledWith(expect.objectContaining({
      toolCalls: 1,
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
    expect(statusRecord).toHaveBeenCalledWith(expect.objectContaining({ toolCalls: 1, retries: 1 }));
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

    expect(recordWorkflow).toHaveBeenCalledTimes(1);
    expect(recordWorkflow).toHaveBeenCalledWith(expect.objectContaining({
      toolCalls: 1,
      revisionConflicts: 1,
      duplicatePreventions: 1,
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
});
