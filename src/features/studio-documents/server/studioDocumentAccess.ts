import { getCurrentCardforgeEntitlement } from '@/features/account/server';
import { isWatermarkRequired } from '@/domain/entitlements';
import type { StudioDocumentWatermarkPolicy } from '@/features/studio-documents/model';

export class StudioDocumentAccessError extends Error {
  constructor(message: string, public readonly status: 401 | 403) {
    super(message);
  }
}

export const getCurrentStudioDocumentAccount = async () => {
  const entitlement = await getCurrentCardforgeEntitlement();
  if (!entitlement.authConfigured || !entitlement.isSignedIn || !entitlement.accountUserId) {
    throw new StudioDocumentAccessError('Sign in before using account Studio documents.', 401);
  }
  return {
    ownerUserId: entitlement.accountUserId,
    entitlement,
    watermark: {
      required: isWatermarkRequired(entitlement.capabilities.canExportClean),
      canExportClean: entitlement.capabilities.canExportClean,
    } satisfies StudioDocumentWatermarkPolicy,
  };
};
