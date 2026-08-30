import { getCurrentContributorAccessProjection } from '@/features/contributor-access/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return createNoStoreJsonResponse(await getCurrentContributorAccessProjection());
  } catch (error) {
    console.error('Failed to resolve Contributor access projection:', error);
    return createApiErrorResponse(500, 'contributor_access_unavailable', 'Unable to load Contributor access.');
  }
}
