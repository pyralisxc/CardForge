import { reconcileBillingState } from '@/features/billing/server/reconcileBillingState';
import { getCurrentOwnerAccess } from '@/features/owner/server';
import { createApiErrorResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

export async function POST() {
  const owner = await getCurrentOwnerAccess();
  if (!owner.isOwner) {
    return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required.');
  }
  return reconcileBillingState();
}
