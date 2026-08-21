import { getCurrentCardforgeEntitlement } from '@/features/account/server';
import { getAccountMcpUsageSummary } from '@/features/mcp-usage/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const entitlement = await getCurrentCardforgeEntitlement();
    if (!entitlement.isSignedIn || !entitlement.accountUserId) {
      return createApiErrorResponse(401, 'sign_in_required', 'Sign in to view CardForge usage.');
    }
    return createNoStoreJsonResponse(await getAccountMcpUsageSummary({
      accountUserId: entitlement.accountUserId,
      accessMode: entitlement.accessMode,
      isOwner: entitlement.ownerAccess.isOwner,
      isSignedIn: entitlement.isSignedIn,
      paidPlan: entitlement.paidPlan,
    }));
  } catch (error) {
    console.error('Failed to load account MCP usage:', error);
    return createApiErrorResponse(500, 'mcp_usage_unavailable', 'Unable to load CardForge assistant usage.');
  }
}
