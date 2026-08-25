import type { ApiClientError } from '@/infrastructure/http/clientResponses';

import type { EnvironmentBoundaryFailure } from './model';

export const projectApiClientErrorBoundary = (error: ApiClientError): EnvironmentBoundaryFailure => ({
  kind: error.kind,
  code: error.code,
  message: error.message,
  retryable: error.retryable,
  ...(error.nextAction ? { nextAction: error.nextAction } : {}),
  correlationId: error.correlationId,
  ...(error.retryAfterSeconds === undefined ? {} : { retryAfterSeconds: error.retryAfterSeconds }),
  ...(error.limit ? { limit: error.limit } : {}),
});
