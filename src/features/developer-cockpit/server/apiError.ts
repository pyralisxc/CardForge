import {
  DeveloperCockpitAccessError,
} from '@/features/developer-cockpit/server/access';
import { DeveloperAccessStoreError } from '@/features/developer-access/server';
import { DeveloperCockpitStoreError } from '@/features/developer-cockpit/server/storeSupport';
import { createApiErrorResponse, createRateLimitErrorResponse } from '@/infrastructure/http/apiResponses';
import { RateLimitExceededError, RateLimitUnavailableError } from '@/infrastructure/security/abuseProtection';

export const createDeveloperCockpitErrorResponse = (
  error: unknown,
  fallbackMessage: string,
) => {
  if (error instanceof SyntaxError) {
    return createApiErrorResponse(400, 'invalid_json', 'Request body must be valid JSON.');
  }
  if (error instanceof DeveloperCockpitAccessError) {
    return createApiErrorResponse(
      error.status,
      error.status === 401
        ? 'sign_in_required'
        : error.message.startsWith('Owner')
          ? 'owner_access_required'
          : 'developer_access_required',
      error.message,
    );
  }
  if (error instanceof DeveloperAccessStoreError) {
    return createApiErrorResponse(
      error.status,
      error.status === 503
        ? 'developer_cockpit_unavailable'
        : 'developer_cockpit_request_invalid',
      error.message,
    );
  }
  if (error instanceof RateLimitUnavailableError) {
    return createApiErrorResponse(503, 'developer_cockpit_unavailable', error.message);
  }
  if (error instanceof RateLimitExceededError) {
    return createRateLimitErrorResponse(error.message, {
      retryAfterSeconds: error.retryAfterSeconds,
      resource: error.limit?.resource,
      maximum: error.limit?.maximum,
      unit: error.limit?.unit,
    });
  }
  if (error instanceof DeveloperCockpitStoreError) {
    return createApiErrorResponse(
      error.status,
      error.status === 429
        ? 'rate_limited'
        : error.status === 503
          ? 'developer_cockpit_unavailable'
          : 'developer_cockpit_request_invalid',
      error.message,
    );
  }
  console.error(fallbackMessage, error);
  return createApiErrorResponse(500, 'developer_cockpit_unavailable', fallbackMessage);
};
