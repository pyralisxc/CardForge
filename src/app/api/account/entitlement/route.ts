import { auth, clerkClient, currentUser } from '@clerk/nextjs/server';

import { isClerkAuthConfigured, resolveAccountEntitlement } from '@/lib/accountEntitlement';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/lib/apiResponses';
import { resolveWithTimeout } from '@/lib/asyncTimeout';
import { resolveOwnerAccess } from '@/lib/ownerAccess';
import { getSupabaseServerClient } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';
const CLERK_READ_TIMEOUT_MS = 3000;

const getActiveFounderBetaAccessExpiresAt = async (userId: string): Promise<string | null> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('cardforge_founder_beta_claims')
    .select('access_expires_at')
    .eq('clerk_user_id', userId)
    .eq('status', 'active')
    .gt('access_expires_at', new Date().toISOString())
    .order('access_expires_at', { ascending: false })
    .limit(1);

  if (error) return null;
  const row = data?.[0] as { access_expires_at?: string | null } | undefined;
  return row?.access_expires_at ?? null;
};

export async function GET() {
  try {
    const authConfigured = isClerkAuthConfigured();

    if (!authConfigured) {
      return createNoStoreJsonResponse(resolveAccountEntitlement({ authConfigured: false }));
    }

    const [authState, sessionUser] = await Promise.all([
      resolveWithTimeout(Promise.resolve().then(() => auth()), {
        fallback: null,
        timeoutMs: CLERK_READ_TIMEOUT_MS,
      }),
      resolveWithTimeout(Promise.resolve().then(() => currentUser()), {
        fallback: null,
        timeoutMs: CLERK_READ_TIMEOUT_MS,
      }),
    ]);
    const userId = sessionUser?.id ?? authState?.userId ?? null;
    const user = userId ? await resolveWithTimeout(
      Promise.resolve().then(async () => {
        const client = await clerkClient();
        return client.users.getUser(userId);
      }),
      {
        fallback: sessionUser,
        timeoutMs: CLERK_READ_TIMEOUT_MS,
      },
    ) : null;
    const emailAddresses = user?.emailAddresses.map((email) => email.emailAddress) ?? [];
    let privateMetadata = user?.privateMetadata;
    const publicMetadata = user?.publicMetadata;
    let ownerAccess = resolveOwnerAccess({
      authConfigured: true,
      isSignedIn: Boolean(user),
      emailAddresses,
      publicMetadata,
      privateMetadata,
    });
    let entitlement = resolveAccountEntitlement({
      authConfigured: true,
      isSignedIn: Boolean(user),
      emailAddresses,
      privateMetadata,
      ownerAccess,
    });

    if (user && !entitlement.canExportClean) {
      const founderBetaAccessExpiresAt = await getActiveFounderBetaAccessExpiresAt(user.id);
      if (founderBetaAccessExpiresAt) {
        privateMetadata = {
          ...privateMetadata,
          cardforgeAccess: 'paid',
          cardforgeAccessExpiresAt: founderBetaAccessExpiresAt,
        };
        ownerAccess = resolveOwnerAccess({
          authConfigured: true,
          isSignedIn: true,
          emailAddresses,
          publicMetadata,
          privateMetadata,
        });
        entitlement = resolveAccountEntitlement({
          authConfigured: true,
          isSignedIn: true,
          emailAddresses,
          privateMetadata,
          ownerAccess,
        });
      }
    }

    return createNoStoreJsonResponse({
      ...entitlement,
    });
  } catch (error) {
    console.error('Failed to resolve account entitlement:', error);
    return createApiErrorResponse(
      500,
      'account_entitlement_unavailable',
      'Unable to load account entitlement.'
    );
  }
}
