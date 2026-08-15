import { auth, clerkClient, currentUser } from '@clerk/nextjs/server';

import { isClerkAuthConfigured, resolveAccountEntitlement } from '@/features/account/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { resolveWithTimeout } from '@/shared/asyncTimeout';
import { resolveOwnerAccess } from '@/domain/entitlements';
import { getCachedExperienceSettings } from '@/features/experience-settings/server';

export const dynamic = 'force-dynamic';
const CLERK_READ_TIMEOUT_MS = 3000;

export async function GET() {
  try {
    const authConfigured = isClerkAuthConfigured();
    const experienceSettings = await getCachedExperienceSettings();

    if (!authConfigured) {
      return createNoStoreJsonResponse(resolveAccountEntitlement({
        authConfigured: false,
        projectFileAccess: experienceSettings.projectFileAccess,
      }));
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
    const privateMetadata = user?.privateMetadata;
    const publicMetadata = user?.publicMetadata;
    const ownerAccess = resolveOwnerAccess({
      authConfigured: true,
      isSignedIn: Boolean(user),
      emailAddresses,
      publicMetadata,
      privateMetadata,
    });
    const entitlement = resolveAccountEntitlement({
      authConfigured: true,
      isSignedIn: Boolean(user),
      accountUserId: userId,
      emailAddresses,
      privateMetadata,
      ownerAccess,
      projectFileAccess: experienceSettings.projectFileAccess,
    });

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
