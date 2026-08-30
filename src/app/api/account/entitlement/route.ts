import {
  AccountIdentityUnavailableError,
  getCurrentCardforgeEntitlement,
} from '@/features/account/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const entitlement = await getCurrentCardforgeEntitlement();

    return createNoStoreJsonResponse({
      ...entitlement,
    });
  } catch (error) {
    console.error('Failed to resolve account entitlement:', error);
    return createApiErrorResponse(
      error instanceof AccountIdentityUnavailableError ? error.status : 500,
      'account_entitlement_unavailable',
      'Unable to verify account access right now.',
      {
        nextAction: 'Keep working locally and retry account or connected-service actions when the identity service recovers.',
      },
    );
  }
}
