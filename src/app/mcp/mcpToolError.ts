import 'server-only';

import { DeveloperCockpitAccessError } from '@/features/developer-access/server';
import { McpUsageStoreError } from '@/features/mcp-usage/server';
import { StudioDocumentStoreError } from '@/features/studio-documents/server';
import {
  RateLimitExceededError,
  RateLimitUnavailableError,
} from '@/infrastructure/security/abuseProtection';
import { describeAgentBoundaryFailure } from '@/shared/boundaryFailure';

const isSafeMcpError = (error: unknown): error is Error => (
  error instanceof DeveloperCockpitAccessError
  || error instanceof StudioDocumentStoreError
  || error instanceof RateLimitExceededError
  || error instanceof RateLimitUnavailableError
  || error instanceof McpUsageStoreError
);

export const createMcpToolError = (error: unknown) => {
  const message = isSafeMcpError(error)
    ? error.message
    : 'CardForge could not complete that action.';
  if (!isSafeMcpError(error)) console.error('CardForge MCP tool failed:', error);
  return {
    isError: true,
    content: [{ type: 'text' as const, text: message }],
    _meta: {
      'cardforge/boundaryFailure': describeAgentBoundaryFailure(error),
    },
  };
};
