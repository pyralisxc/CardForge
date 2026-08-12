import { revalidatePath } from 'next/cache';

import {
  ExperienceSettingsStoreError,
  revalidateExperienceSettingsCache,
  updateExperienceSettings,
} from '@/features/experience-settings/server';
import { getCurrentOwnerAccess } from '@/features/owner/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request) {
  try {
    const ownerAccess = await getCurrentOwnerAccess();
    if (!ownerAccess.isOwner) {
      return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required for this console.');
    }

    const body = await request.json() as Record<string, unknown>;
    const settings = await updateExperienceSettings(body);
    revalidateExperienceSettingsCache();
    revalidatePath('/', 'layout');
    return createNoStoreJsonResponse({ settings });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createApiErrorResponse(400, 'invalid_json', 'Request body must be valid JSON.');
    }
    if (error instanceof ExperienceSettingsStoreError) {
      return createApiErrorResponse(
        error.status,
        error.status === 503 ? 'experience_controls_unavailable' : 'experience_controls_invalid',
        error.message,
      );
    }
    console.error('Failed to update experience settings:', error);
    return createApiErrorResponse(500, 'experience_controls_unavailable', 'Unable to update experience controls.');
  }
}
