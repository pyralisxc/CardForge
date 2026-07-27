import {
  createDeveloperCockpitErrorResponse,
} from '@/features/developer-cockpit/server/apiError';
import {
  getCurrentDeveloperCockpitAccess,
  getDeveloperCockpitView,
} from '@/features/developer-cockpit/server';
import { createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const access = await getCurrentDeveloperCockpitAccess();
    return createNoStoreJsonResponse({
      cockpit: await getDeveloperCockpitView(access),
    });
  } catch (error) {
    return createDeveloperCockpitErrorResponse(error, 'Unable to load the developer cockpit.');
  }
}
