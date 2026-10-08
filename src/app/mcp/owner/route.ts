import { verifyClerkToken } from '@clerk/mcp-tools/next';
import { auth } from '@clerk/nextjs/server';
import { withMcpAuth } from 'mcp-handler';

import { cardForgeOwnerMcpHandler } from '@/features/owner/server/mcpOwnerServer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

const authenticatedHandler = withMcpAuth(
  cardForgeOwnerMcpHandler,
  async (_request, token) => {
    const clerkAuth = await auth({ acceptsToken: 'oauth_token' });
    return verifyClerkToken(clerkAuth, token);
  },
  {
    required: true,
    resourceMetadataPath: '/.well-known/oauth-protected-resource/mcp/owner',
  },
);

export { authenticatedHandler as GET, authenticatedHandler as POST };
