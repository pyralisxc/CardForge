import 'server-only';

import { AccountToolAccessError } from '@/features/account/server';
import { BusinessIdentityStoreError } from '@/features/business-identity/server';
import { LegalDocumentStoreError } from '@/features/legal/server';
import { McpUsageStoreError } from '@/features/mcp-usage/server';
import {
  FounderProfileStoreError,
  PublicSiteConfigurationStoreError,
  PublicSiteStoreError,
  SiteMediaStoreError,
} from '@/features/public-site/server';
import { RoadmapStoreError } from '@/features/roadmap/server';
import { describeAgentBoundaryFailure } from '@/shared/boundaryFailure';

const isSafeOwnerMcpError = (error: unknown): error is Error => (
  error instanceof AccountToolAccessError
  || error instanceof BusinessIdentityStoreError
  || error instanceof LegalDocumentStoreError
  || error instanceof McpUsageStoreError
  || error instanceof FounderProfileStoreError
  || error instanceof PublicSiteConfigurationStoreError
  || error instanceof PublicSiteStoreError
  || error instanceof SiteMediaStoreError
  || error instanceof RoadmapStoreError
);

export const createOwnerMcpToolError = (error: unknown) => {
  const message = isSafeOwnerMcpError(error)
    ? error.message
    : 'CardForge Owner could not complete that action.';
  if (!isSafeOwnerMcpError(error)) console.error('CardForge Owner MCP tool failed:', error);
  return {
    isError: true,
    content: [{ type: 'text' as const, text: message }],
    _meta: {
      'cardforge/boundaryFailure': describeAgentBoundaryFailure(error),
    },
  };
};
