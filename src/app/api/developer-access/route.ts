import { getCurrentDeveloperAccessProjection } from '@/features/developer-access/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return createNoStoreJsonResponse(await getCurrentDeveloperAccessProjection());
  } catch (error) {
    console.error('Failed to resolve developer access projection:', error);
    return createApiErrorResponse(500, 'developer_access_unavailable', 'Unable to load developer access.');
  }
}
