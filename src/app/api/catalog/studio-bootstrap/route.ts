import { getCurrentCardforgeEntitlement } from '@/features/account/server';
import { getCachedCardForgeStudioBootstrap } from '@/features/developer-assets/server/catalogCache';
import { getExperienceSettings } from '@/features/experience-settings/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export async function GET() {
  try {
    const entitlement = await getCurrentCardforgeEntitlement();
    const [bootstrap, experienceSettings] = await Promise.all([
      getCachedCardForgeStudioBootstrap(entitlement.accessMode),
      getExperienceSettings(),
    ]);
    return createNoStoreJsonResponse({
      ...bootstrap,
      studioDefaults: {
        ...bootstrap.studioDefaults,
        defaultTemplateId: experienceSettings.studioDefaultTemplateId,
      },
    });
  } catch (error) {
    console.error('Failed to load CardForge Studio bootstrap:', error);
    return createApiErrorResponse(500, 'asset_library_unavailable', 'Unable to load the CardForge Studio library.');
  }
}
