import { getBillingConfigStatus } from '@/features/billing/server';
import { isClerkAuthConfigured } from '@/features/account/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { resolveAccessMode } from '@/domain/entitlements';
import { getSupabaseServerConfigStatus } from '@/infrastructure/database/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const billing = getBillingConfigStatus();
    const accessMode = resolveAccessMode();

    return createNoStoreJsonResponse({
      billing,
      authConfigured: isClerkAuthConfigured(),
      accessMode,
      supabase: getSupabaseServerConfigStatus(),
    });
  } catch (error) {
    console.error('Failed to load billing status:', error);
    return createApiErrorResponse(
      500,
      'billing_status_unavailable',
      'Unable to load billing status.'
    );
  }
}
