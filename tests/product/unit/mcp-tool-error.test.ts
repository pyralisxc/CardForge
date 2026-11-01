import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { createMcpToolError } from '@/features/studio-documents/server/mcpToolError';
import { PersonalLibraryStoreError } from '@/features/personal-library/server';
import { ProjectStorageProviderError } from '@/features/project/server';
import { StudioDocumentStoreError } from '@/features/studio-documents/server/StudioDocumentStoreError';

describe('MCP boundary failures', () => {
  it('preserves stale Studio revision conflicts instead of reporting invalid input', () => {
    const result = createMcpToolError(new StudioDocumentStoreError(
      'The Studio document changed from expected revision 4 to 5. Reload once, keep the same stable ids, and retry the whole atomic patch.',
      409,
    ));
    expect(result).toMatchObject({
      isError: true,
      _meta: { 'cardforge/boundaryFailure': { status: 409, kind: 'conflict' } },
    });
    expect(result.content[0]).toMatchObject({ type: 'text', text: expect.stringContaining('expected revision 4 to 5') });
  });

  it('preserves connected-provider failure meaning for the agent', () => {
    const result = createMcpToolError(new ProjectStorageProviderError(
      'Reconnect Google Drive before retrying.',
      401,
      { kind: 'authentication', nextAction: 'Reconnect Google Drive, then retry the same project id.' },
    ));

    expect(result).toMatchObject({
      isError: true,
      content: [{ type: 'text', text: 'Reconnect Google Drive before retrying.' }],
      _meta: {
        'cardforge/boundaryFailure': {
          status: 401,
          kind: 'authentication',
          retryable: false,
          nextAction: 'Reconnect Google Drive, then retry the same project id.',
        },
      },
    });
  });

  it('preserves personal-library permission failures for the agent', () => {
    const result = createMcpToolError(new PersonalLibraryStoreError(
      'That file is outside the authorized personal library.',
      403,
      { kind: 'authorization' },
    ));

    expect(result._meta['cardforge/boundaryFailure']).toMatchObject({
      status: 403,
      kind: 'authorization',
      retryable: false,
    });
  });
});

it.each([409, 503] as const)('serializes exact revision deletion %s as reconciliation, never automatic retry', async status => {
  const { RevisionDeleteError } = await import('@/features/pipeline/server');
  const message = status === 409 ? 'Exact revision claim was not confirmed' : 'Revision deletion incomplete; reconcile its Storage and claim state';
  const result = createMcpToolError(new RevisionDeleteError(status, message));
  expect(result.content).toEqual([{ type: 'text', text: message }]);
  expect(result._meta['cardforge/boundaryFailure']).toMatchObject({ status, retryable: false, nextAction: expect.stringContaining('retained destructive claim state') });
  expect(result._meta['cardforge/boundaryFailure'].nextAction).not.toContain('retry against its latest revision');
});

it.each([409, 503] as const)('serializes revision recovery %s as exact-state reconciliation without automatic retry', async status => {
  const { RevisionRecoveryError } = await import('@/features/pipeline/server');
  const message = status === 409 ? 'A destructive claim blocks recovery.' : 'The recovery command outcome is uncertain.';
  const result = createMcpToolError(new RevisionRecoveryError(message, status, 'revision_recovery_blocked'));
  expect(result.content).toEqual([{ type: 'text', text: message }]);
  expect(result._meta['cardforge/boundaryFailure']).toMatchObject({ status, retryable: false,
    nextAction: expect.stringContaining('retained Trash, hold and destructive claim state') });
  expect(result._meta['cardforge/boundaryFailure'].nextAction).not.toContain('retry against its latest revision');
});
