import {
  ContributorAccessError,
  ContributorAccessStoreError,
} from '@/features/contributor-access/server';
import { SiteProposalStoreError } from '@/features/site-proposals/server/siteProposalStoreSupport';
import { createApiErrorResponse, createRateLimitErrorResponse } from '@/infrastructure/http/apiResponses';
import { RateLimitExceededError, RateLimitUnavailableError } from '@/infrastructure/security/abuseProtection';

export const createSiteProposalErrorResponse = (
  error: unknown,
  fallbackMessage: string,
) => {
  if (error instanceof SyntaxError) {
    return createApiErrorResponse(400, 'invalid_json', 'Request body must be valid JSON.');
  }
  if (error instanceof ContributorAccessError) {
    return createApiErrorResponse(
      error.status,
      error.status === 401
        ? 'sign_in_required'
        : error.message.startsWith('Owner')
          ? 'owner_access_required'
          : 'contributor_access_required',
      error.message,
    );
  }
  if (error instanceof ContributorAccessStoreError) {
    return createApiErrorResponse(
      error.status,
      error.status === 503
        ? 'contributor_access_unavailable'
        : 'site_proposal_invalid',
      error.message,
    );
  }
  if (error instanceof RateLimitUnavailableError) {
    return createApiErrorResponse(503, 'site_proposal_unavailable', error.message);
  }
  if (error instanceof RateLimitExceededError) {
    return createRateLimitErrorResponse(error.message, {
      retryAfterSeconds: error.retryAfterSeconds,
      resource: error.limit?.resource,
      maximum: error.limit?.maximum,
      unit: error.limit?.unit,
    });
  }
  if (error instanceof SiteProposalStoreError) {
    return createApiErrorResponse(
      error.status,
      error.status === 429
        ? 'rate_limited'
        : error.status === 503
          ? 'site_proposal_unavailable'
          : 'site_proposal_invalid',
      error.message,
    );
  }
  console.error(fallbackMessage, error);
  return createApiErrorResponse(500, 'site_proposal_unavailable', fallbackMessage);
};
