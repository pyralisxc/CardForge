import { getCurrentCardforgeEntitlement } from '@/features/account/server';
import { CloudSetStoreError } from '@/features/project/server';
import { createApiErrorResponse } from '@/infrastructure/http/apiResponses';
import { parseJsonBodyWithLimit, STUDIO_CONTENT_MAX_JSON_BODY_BYTES } from '@/infrastructure/http/apiValidation';

export const getCloudSetAccount = async () => {
  const entitlement = await getCurrentCardforgeEntitlement();
  if (!entitlement.isSignedIn || !entitlement.accountUserId) {
    throw new CloudSetStoreError('Sign in to use CardForge cloud set saves.', 401);
  }
  return {
    ownerUserId: entitlement.accountUserId,
    slotLimit: entitlement.capabilities.cloudSetLimit,
  };
};

export const parseCloudSetJson = async (request: Request) => {
  const parsed = await parseJsonBodyWithLimit(request, STUDIO_CONTENT_MAX_JSON_BODY_BYTES);
  if (!parsed.ok) {
    throw new CloudSetStoreError(parsed.message, parsed.code === 'payload_too_large' ? 413 : 400);
  }
  if (!parsed.data || typeof parsed.data !== 'object' || Array.isArray(parsed.data)) {
    throw new CloudSetStoreError('Cloud set request body must be a JSON object.', 400);
  }
  return parsed.data as Record<string, unknown>;
};

export const toCloudSetErrorResponse = (error: unknown, fallback: string) => {
  if (error instanceof CloudSetStoreError) {
    const code = error.status === 401
      ? 'sign_in_required'
      : error.status === 404
        ? 'cloud_set_not_found'
        : error.status === 409
          ? 'cloud_set_conflict'
          : error.status === 413
            ? 'cloud_set_too_large'
            : 'cloud_set_invalid';
    return createApiErrorResponse(error.status, code, error.message, {
      kind: error.kind,
      nextAction: error.nextAction,
      limit: error.limit,
    });
  }
  console.error(fallback, error);
  return createApiErrorResponse(500, 'cloud_set_unavailable', fallback);
};
