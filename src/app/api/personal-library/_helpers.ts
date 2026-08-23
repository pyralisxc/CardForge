import { getCurrentCardforgeEntitlement } from '@/features/account/server';
import { PersonalLibraryStoreError } from '@/features/personal-library/server';
import { createApiErrorResponse } from '@/infrastructure/http/apiResponses';
import { parseJsonBodyWithLimit } from '@/infrastructure/http/apiValidation';

const PERSONAL_LIBRARY_REQUEST_MAX_BYTES = 64 * 1024;

export const getPersonalLibraryAccount = async () => {
  const entitlement = await getCurrentCardforgeEntitlement();
  if (!entitlement.isSignedIn || !entitlement.accountUserId) {
    throw new PersonalLibraryStoreError('Sign in to use your connected personal library.', 401, { kind: 'authentication' });
  }
  return { ownerUserId: entitlement.accountUserId, entitlement };
};

export const parsePersonalLibraryJson = async (request: Request) => {
  const parsed = await parseJsonBodyWithLimit(request, PERSONAL_LIBRARY_REQUEST_MAX_BYTES);
  if (!parsed.ok) {
    throw new PersonalLibraryStoreError(parsed.message, parsed.code === 'payload_too_large' ? 413 : 400, {
      kind: parsed.code === 'payload_too_large' ? 'limit' : 'invalid',
    });
  }
  if (!parsed.data || typeof parsed.data !== 'object' || Array.isArray(parsed.data)) {
    throw new PersonalLibraryStoreError('Personal-library request body must be a JSON object.', 400, { kind: 'invalid' });
  }
  return parsed.data as Record<string, unknown>;
};

export const toPersonalLibraryErrorResponse = (error: unknown, fallback: string) => {
  if (error instanceof PersonalLibraryStoreError) {
    const code = error.status === 401
      ? 'sign_in_required'
      : error.status === 404
        ? 'personal_library_not_found'
        : error.status === 413
          ? 'payload_too_large'
          : error.status === 429
            ? 'rate_limited'
            : error.status >= 500
              ? 'personal_library_unavailable'
              : 'personal_library_invalid';
    return createApiErrorResponse(error.status, code, error.message, {
      kind: error.kind,
      nextAction: error.nextAction,
    });
  }
  console.error(fallback, error);
  return createApiErrorResponse(500, 'personal_library_unavailable', fallback, { kind: 'unavailable' });
};
