import { getCurrentCardforgeEntitlement } from '@/features/account/server';
import { ProjectStorageProviderError } from '@/features/project/server';
import { createApiErrorResponse } from '@/infrastructure/http/apiResponses';
import { parseJsonBodyWithLimit, STUDIO_CONTENT_MAX_JSON_BODY_BYTES } from '@/infrastructure/http/apiValidation';

export const getGoogleDriveProjectAccount = async () => {
  const entitlement = await getCurrentCardforgeEntitlement();
  if (!entitlement.isSignedIn || !entitlement.accountUserId) {
    throw new ProjectStorageProviderError('Sign in to connect or use Google Drive project storage.', 401, { kind: 'authentication' });
  }
  return { ownerUserId: entitlement.accountUserId, entitlement };
};

export const parseGoogleDriveProjectJson = async (request: Request) => {
  const parsed = await parseJsonBodyWithLimit(request, STUDIO_CONTENT_MAX_JSON_BODY_BYTES);
  if (!parsed.ok) {
    throw new ProjectStorageProviderError(parsed.message, parsed.code === 'payload_too_large' ? 413 : 400, {
      kind: parsed.code === 'payload_too_large' ? 'limit' : 'invalid',
    });
  }
  if (!parsed.data || typeof parsed.data !== 'object' || Array.isArray(parsed.data)) {
    throw new ProjectStorageProviderError('Google Drive project request body must be a JSON object.', 400, { kind: 'invalid' });
  }
  return parsed.data as Record<string, unknown>;
};

export const toGoogleDriveProjectErrorResponse = (error: unknown, fallback: string) => {
  if (error instanceof ProjectStorageProviderError) {
    const code = error.status === 401
      ? 'google_drive_auth_required'
      : error.status === 403
        ? error.kind === 'limit' ? 'google_drive_limit' : 'google_drive_not_permitted'
      : error.status === 404
        ? 'google_drive_project_not_found'
        : error.status === 409
          ? 'google_drive_project_conflict'
          : error.status === 413
            ? 'google_drive_project_too_large'
            : error.status === 429
              ? 'rate_limited'
            : error.status >= 500
              ? 'google_drive_unavailable'
              : 'google_drive_project_invalid';
    return createApiErrorResponse(error.status, code, error.message, {
      kind: error.kind,
      nextAction: error.nextAction,
    });
  }
  console.error(fallback, error);
  return createApiErrorResponse(500, 'google_drive_unavailable', fallback, { kind: 'unavailable' });
};
