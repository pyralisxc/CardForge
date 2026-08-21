import { revalidatePath } from 'next/cache';

import { getCurrentOwnerAccess, recordOwnerActivity } from '@/features/owner/server';
import {
  PublicSiteConfigurationStoreError,
  revalidatePublicSiteConfiguration,
  updatePublicSiteConfiguration,
} from '@/features/public-site/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { parseJsonBodyWithLimit } from '@/infrastructure/http/apiValidation';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request) {
  const owner = await getCurrentOwnerAccess();
  if (!owner.isOwner || !owner.userId) {
    return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required.');
  }
  try {
    const parsedBody = await parseJsonBodyWithLimit(request);
    if (!parsedBody.ok) {
      return createApiErrorResponse(
        parsedBody.code === 'payload_too_large' ? 413 : 400,
        parsedBody.code,
        parsedBody.message,
      );
    }
    const settings = await updatePublicSiteConfiguration(parsedBody.data as Record<string, unknown>);
    revalidatePublicSiteConfiguration();
    revalidatePath('/');
    revalidatePath('/account');
    revalidatePath('/cameron');
    revalidatePath('/', 'layout');
    const activityRecorded = await recordOwnerActivity({
      actorUserId: owner.userId,
      actorEmail: owner.email,
      action: 'site.configuration.update',
      targetType: 'public_site',
      targetId: 'cardforge',
      summary: 'Updated public navigation, homepage presentation, offer visibility, announcement, search metadata, watermark presentation, or demonstration sets.',
      metadata: {
        announcementEnabled: settings.announcementEnabled,
        visibleNavigation: settings.primaryNavigation.filter((item) => item.visible).map((item) => item.id),
        visibleHomepageSections: settings.homepageSections.filter((item) => item.visible).map((item) => item.id),
        visibleShowcaseExamples: settings.homepageSections
          .find((item) => item.id === 'showcase')
          ?.showcaseExamples?.filter((example) => example.visible).map((example) => example.slug) ?? [],
      },
    });
    return createNoStoreJsonResponse({ settings, activityRecorded });
  } catch (error) {
    if (error instanceof PublicSiteConfigurationStoreError) {
      return createApiErrorResponse(error.status, 'site_configuration_invalid', error.message);
    }
    console.error('Failed to update public site configuration:', error);
    return createApiErrorResponse(500, 'site_configuration_unavailable', 'Unable to update public site settings.');
  }
}
