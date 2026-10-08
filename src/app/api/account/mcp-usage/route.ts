import { getCurrentCardforgeEntitlement } from '@/features/account/server';
import {
  applyProductAccessPricePresentation,
  getAccountMcpUsageSummary,
} from '@/features/mcp-usage/server';
import { getCurrentProductAccessPricePresentation } from '@/features/billing/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const entitlement = await getCurrentCardforgeEntitlement();
    if (!entitlement.isSignedIn || !entitlement.accountUserId) {
      return createApiErrorResponse(401, 'sign_in_required', 'Sign in to view CardForge usage.');
    }
    const [summary, productAccessPrices] = await Promise.all([
      getAccountMcpUsageSummary({
        accountUserId: entitlement.accountUserId,
        accessMode: entitlement.accessMode,
        isOwner: entitlement.ownerAccess.isOwner,
        isSignedIn: entitlement.isSignedIn,
        paidPlan: entitlement.paidPlan,
      }),
      getCurrentProductAccessPricePresentation(),
    ]);
    return createNoStoreJsonResponse({
      ...summary,
      allowance: applyProductAccessPricePresentation([summary.allowance], productAccessPrices)[0],
      availablePlans: applyProductAccessPricePresentation(summary.availablePlans, productAccessPrices),
    });
  } catch (error) {
    console.error('Failed to load account MCP usage:', error);
    return createApiErrorResponse(500, 'mcp_usage_unavailable', 'Unable to load CardForge assistant usage.');
  }
}