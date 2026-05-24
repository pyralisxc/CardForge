import { getBillingConfigStatus } from '@/lib/billing';
import { isClerkAuthConfigured } from '@/lib/accountEntitlement';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/lib/apiResponses';
import { isShippedLibraryWriteEnabled, resolveAccessMode } from '@/lib/projectAccess';
import { getSupabaseServerConfigStatus } from '@/lib/supabaseServer';
import { getOwnerConsolePayload } from '@/lib/ownerConsoleStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const billing = getBillingConfigStatus();
    const accessMode = resolveAccessMode();

    return createNoStoreJsonResponse({
      billing,
      authConfigured: isClerkAuthConfigured(),
      accessMode,
      shippedLibraryWritesEnabled: isShippedLibraryWriteEnabled(),
      supabase: getSupabaseServerConfigStatus(),
      founderBetaCampaign: (await getOwnerConsolePayload()).founderBetaCampaign,
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
