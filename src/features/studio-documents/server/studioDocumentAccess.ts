import { getCurrentCardforgeEntitlement } from '@/features/account/server';
import type { AccountEntitlement } from '@/features/account/server';
import { isWatermarkRequired } from '@/domain/entitlements';
import { getMcpAllowances, resolveMcpUsagePlanKey } from '@/features/mcp-usage/server';
import type { StudioDocumentWatermarkPolicy } from '@/features/studio-documents/model';

export class StudioDocumentAccessError extends Error {
  constructor(message: string, public readonly status: 401 | 403) {
    super(message);
  }
}

export const getStudioDocumentRetentionHours = async (
  entitlement: AccountEntitlement,
): Promise<number> => {
  const planKey = resolveMcpUsagePlanKey({
    accessMode: entitlement.accessMode,
    isOwner: entitlement.ownerAccess.isOwner,
    paidPlan: entitlement.paidPlan,
  });
  const allowances = await getMcpAllowances();
  return allowances.find((allowance) => allowance.planKey === planKey)?.draftRetentionHours
    ?? (planKey === 'designer' ? 48 : planKey === 'creator' ? 24 : 12);
};

export const getCurrentStudioDocumentAccount = async () => {
  const entitlement = await getCurrentCardforgeEntitlement();
  if (!entitlement.authConfigured || !entitlement.isSignedIn || !entitlement.accountUserId) {
    throw new StudioDocumentAccessError('Sign in before using account Studio documents.', 401);
  }
  const retentionHours = await getStudioDocumentRetentionHours(entitlement);
  return {
    ownerUserId: entitlement.accountUserId,
    entitlement,
    retentionHours,
    watermark: {
      required: isWatermarkRequired(entitlement.capabilities.canExportClean),
      canExportClean: entitlement.capabilities.canExportClean,
    } satisfies StudioDocumentWatermarkPolicy,
  };
};
