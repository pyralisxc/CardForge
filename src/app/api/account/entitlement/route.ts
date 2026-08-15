import {
  getCurrentCardforgeUserAccess,
  resolveAccountEntitlement,
} from '@/features/account/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { getCachedExperienceSettings } from '@/features/experience-settings/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [access, experienceSettings] = await Promise.all([
      getCurrentCardforgeUserAccess(),
      getCachedExperienceSettings(),
    ]);
    const { authConfigured, ownerAccess, user } = access;
    const entitlement = resolveAccountEntitlement({
      authConfigured,
      isSignedIn: Boolean(user),
      accountUserId: user?.id ?? null,
      emailAddresses: user?.emailAddresses ?? [],
      privateMetadata: user?.privateMetadata,
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
