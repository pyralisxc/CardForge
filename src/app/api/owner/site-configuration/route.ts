import { getCurrentOwnerAccess } from '@/features/owner/server';
import { publishOwnerSiteConfiguration, publishOwnerSiteConfigurationField } from '@/features/owner/server/ownerSiteCommands';
import { PublicSiteConfigurationStoreError } from '@/features/public-site/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { parseJsonBodyWithLimit } from '@/infrastructure/http/apiValidation';

export const dynamic = 'force-dynamic';


/** Same protected Owner endpoint, one canonical site-configuration writer. */
export async function PATCH(request: Request) {
  const owner = await getCurrentOwnerAccess();
  if (!owner.isOwner || !owner.userId) {
    return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required.');
  }
  try {
    const parsedBody = await parseJsonBodyWithLimit(request);
    if (!parsedBody.ok) {
      return createApiErrorResponse(
        parsedBody.code === 'payload_too_large' ? 413 : 400, parsedBody.code, parsedBody.message,
      );
    }
    const data = parsedBody.data;
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return createApiErrorResponse(400, 'site_configuration_invalid', 'Choose an editable site field.');
    }
    const values = data as Record<string, unknown>;
    const publication = await publishOwnerSiteConfigurationField({
      actor: { userId: owner.userId, email: owner.email },
      input: {
        field: values.field as 'primaryCtaLabel' | 'navigationLabel' | 'announcementMessage',
        value: values.value,
        navigationId: values.navigationId,
        expectedUpdatedAt: values.expectedUpdatedAt,
      },
    });
    return createNoStoreJsonResponse(publication);
  } catch (error) {
    if (error instanceof PublicSiteConfigurationStoreError) {
      return createApiErrorResponse(
        error.status,
        error.status === 409 ? 'site_configuration_conflict'
          : error.status >= 500 ? 'site_configuration_unavailable' : 'site_configuration_invalid',
        error.message,
      );
    }
    console.error('Failed to publish selected Owner site field:', error);
    return createApiErrorResponse(500, 'site_configuration_unavailable', 'Unable to publish selected site field.');
  }
}

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
    const publication = await publishOwnerSiteConfiguration({
      actor: { userId: owner.userId, email: owner.email },
      input: parsedBody.data as Record<string, unknown>,
    });
    return createNoStoreJsonResponse({
      ...publication,
      activityRecorded: publication.receipt.activityRecorded,
    });
  } catch (error) {
    if (error instanceof PublicSiteConfigurationStoreError) {
      return createApiErrorResponse(error.status, error.status === 409 ? 'site_configuration_conflict' : error.status >= 500 ? 'site_configuration_unavailable' : 'site_configuration_invalid', error.message);
    }
    console.error('Failed to update public site configuration:', error);
    return createApiErrorResponse(500, 'site_configuration_unavailable', 'Unable to update public site settings.');
  }
}