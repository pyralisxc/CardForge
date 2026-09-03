import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { createMcpToolError } from '@/app/mcp/mcpToolError';
import { PersonalLibraryStoreError } from '@/features/personal-library/server';
import { ProjectStorageProviderError } from '@/features/project/server';

describe('MCP boundary failures', () => {
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
