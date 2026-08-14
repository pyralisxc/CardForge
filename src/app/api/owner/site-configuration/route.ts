import { revalidatePath } from 'next/cache';

import { getCurrentOwnerAccess, recordOwnerActivity } from '@/features/owner/server';
import {
  PublicSiteConfigurationStoreError,
  revalidatePublicSiteConfiguration,
  updatePublicSiteConfiguration,
} from '@/features/public-site/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request) {
  const owner = await getCurrentOwnerAccess();
  if (!owner.isOwner || !owner.userId) {
    return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required.');
  }
  try {
    const body = await request.json() as Record<string, unknown>;
    const settings = await updatePublicSiteConfiguration(body);
    revalidatePublicSiteConfiguration();
    revalidatePath('/');
    revalidatePath('/cameron');
    revalidatePath('/', 'layout');
    const activityRecorded = await recordOwnerActivity({
      actorUserId: owner.userId,
      actorEmail: owner.email,
      action: 'site.configuration.update',
      targetType: 'public_site',
      targetId: 'cardforge',
      summary: 'Updated public navigation, homepage presentation, offer visibility, announcement, or homepage metadata.',
      metadata: {
        announcementEnabled: settings.announcementEnabled,
        visibleNavigation: settings.primaryNavigation.filter((item) => item.visible).map((item) => item.id),
        visibleHomepageSections: settings.homepageSections.filter((item) => item.visible).map((item) => item.id),
      },
    });
    return createNoStoreJsonResponse({ settings, activityRecorded });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createApiErrorResponse(400, 'invalid_json', 'Request body must be valid JSON.');
    }
    if (error instanceof PublicSiteConfigurationStoreError) {
      return createApiErrorResponse(error.status, 'site_configuration_invalid', error.message);
    }
    console.error('Failed to update public site configuration:', error);
    return createApiErrorResponse(500, 'site_configuration_unavailable', 'Unable to update public site settings.');
  }
}
