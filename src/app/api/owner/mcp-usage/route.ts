import {
  getOwnerMcpUsageDashboard,
  isMcpUsagePlanKey,
  McpUsageStoreError,
  updateMcpAllowance,
} from '@/features/mcp-usage/server';
import { getCurrentOwnerAccess, recordOwnerActivity } from '@/features/owner/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

const requireOwner = async () => {
  const access = await getCurrentOwnerAccess();
  return access.isOwner ? access : null;
};

export async function GET() {
  try {
    if (!await requireOwner()) {
      return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required.');
    }
    return createNoStoreJsonResponse(await getOwnerMcpUsageDashboard());
  } catch (error) {
    if (error instanceof McpUsageStoreError) {
      return createApiErrorResponse(error.status, 'mcp_usage_unavailable', error.message);
    }
    console.error('Failed to load owner MCP usage:', error);
    return createApiErrorResponse(500, 'mcp_usage_unavailable', 'Unable to load MCP usage controls.');
  }
}

export async function PUT(request: Request) {
  try {
    const owner = await requireOwner();
    if (!owner) return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required.');
    const body = await request.json() as unknown;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return createApiErrorResponse(400, 'mcp_allowance_invalid', 'Usage targets must be sent as a JSON object.');
    }
    const values = body as Record<string, unknown>;
    if (!isMcpUsagePlanKey(values.planKey)) {
      return createApiErrorResponse(400, 'mcp_allowance_invalid', 'Choose a valid CardForge plan.');
    }
    if (typeof values.monthlyActionLimit !== 'number'
      || typeof values.dailySafetyLimit !== 'number'
      || typeof values.onlineStorageLimitBytes !== 'number'
      || typeof values.displayName !== 'string'
      || typeof values.description !== 'string'
      || typeof values.featureSummary !== 'string'
      || typeof values.ctaLabel !== 'string'
      || typeof values.priceLabel !== 'string'
      || typeof values.priceNote !== 'string'
      || typeof values.isVisible !== 'boolean') {
      return createApiErrorResponse(400, 'mcp_allowance_invalid', 'Plan settings contain invalid values.');
    }
    const monthlyActionLimit = values.monthlyActionLimit;
    const dailySafetyLimit = values.dailySafetyLimit;
    const onlineStorageLimitBytes = values.onlineStorageLimitBytes;
    const dashboard = await updateMcpAllowance({
      planKey: values.planKey,
      displayName: values.displayName,
      description: values.description,
      featureSummary: values.featureSummary,
      ctaLabel: values.ctaLabel,
      priceLabel: values.priceLabel,
      priceNote: values.priceNote,
      isVisible: values.isVisible,
      monthlyActionLimit,
      dailySafetyLimit,
      onlineStorageLimitBytes,
    });
    revalidatePath('/');
    revalidatePath('/cameron');
    revalidatePath('/sign-up');
    const activityRecorded = await recordOwnerActivity({
      actorUserId: owner.userId ?? 'owner',
      actorEmail: owner.email,
      action: 'mcp.allowance.update',
      targetType: 'mcp_allowance',
      targetId: values.planKey,
      summary: `Updated plan presentation and capacity targets for ${values.planKey}.`,
      metadata: {
        displayName: values.displayName,
        priceLabel: values.priceLabel,
        isVisible: values.isVisible,
        monthlyActionLimit,
        dailySafetyLimit,
        onlineStorageLimitBytes,
      },
    });
    return createNoStoreJsonResponse({ dashboard, activityRecorded });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createApiErrorResponse(400, 'invalid_json', 'Request body must be valid JSON.');
    }
    if (error instanceof McpUsageStoreError) {
      return createApiErrorResponse(
        error.status,
        error.status === 503 ? 'mcp_usage_unavailable' : 'mcp_allowance_invalid',
        error.message,
      );
    }
    console.error('Failed to update MCP allowance:', error);
    return createApiErrorResponse(500, 'mcp_usage_unavailable', 'Unable to update MCP usage controls.');
  }
}
import { revalidatePath } from 'next/cache';
