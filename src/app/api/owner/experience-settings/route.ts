import {
  ExperienceSettingsStoreError,
} from '@/features/experience-settings/server';
import { getCurrentOwnerAccess } from '@/features/owner/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

import { publishOwnerExperienceSettings } from '@/features/owner/server/ownerSiteCommands';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request) {
  try {
    const ownerAccess = await getCurrentOwnerAccess();
    if (!ownerAccess.isOwner || !ownerAccess.userId) {
      return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required for these operations.');
    }

    const body = await request.json() as Record<string, unknown>;
    const publication = await publishOwnerExperienceSettings({ actor: { userId: ownerAccess.userId, email: ownerAccess.email }, input: body });
    return createNoStoreJsonResponse({ settings: publication.value, receipt: publication.receipt, activityRecorded: publication.receipt.activityRecorded });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createApiErrorResponse(400, 'invalid_json', 'Request body must be valid JSON.');
    }
    if (error instanceof ExperienceSettingsStoreError) {
      return createApiErrorResponse(
        error.status,
        error.status === 409 ? 'experience_controls_conflict' : error.status >= 500 ? 'experience_controls_unavailable' : 'experience_controls_invalid',
        error.message,
      );
    }
    console.error('Failed to update experience settings:', error);
    return createApiErrorResponse(500, 'experience_controls_unavailable', 'Unable to update experience controls.');
  }
}
