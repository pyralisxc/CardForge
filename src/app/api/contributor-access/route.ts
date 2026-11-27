import { getCurrentContributorAccessProjection } from '@/features/contributor-access/server';
import { AccountToolAccessError } from '@/features/account/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const readOnly = new URL(request.url).searchParams.get('readOnly') === '1';
    return createNoStoreJsonResponse(await getCurrentContributorAccessProjection({ readOnly }));
  } catch (error) {
    if (error instanceof AccountToolAccessError) {
      return createApiErrorResponse(error.status, error.status === 401 ? 'sign_in_required' : 'contributor_access_required', error.message);
    }
    console.error('Failed to resolve Contributor access projection:', error);
    return createApiErrorResponse(503, 'contributor_access_unavailable', 'Unable to verify Contributor access. Retry when the service recovers.');
  }
}
