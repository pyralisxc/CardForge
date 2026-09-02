import { inferBoundaryFailureKind, type BoundaryFailureKind } from '@/shared/boundaryFailure';

export interface GoogleProviderErrorPayload {
  error?: { message?: string; status?: string; errors?: Array<{ reason?: string }> } | string;
  error_description?: string;
}

export interface GoogleProviderFailure {
  status: number;
  kind: BoundaryFailureKind;
  providerMessage?: string;
  nextAction?: string;
  reconnectRequired: boolean;
}

const RATE_LIMIT_REASONS = new Set([
  'rateLimitExceeded',
  'sharingRateLimitExceeded',
  'userRateLimitExceeded',
]);

export const classifyGoogleProviderFailure = (
  responseStatus: number,
  payload: GoogleProviderErrorPayload,
  context: 'api' | 'token' = 'api',
): GoogleProviderFailure => {
  const providerMessage = typeof payload.error === 'object'
    ? payload.error?.message
    : payload.error_description ?? (typeof payload.error === 'string' ? payload.error : undefined);
  const reasons = typeof payload.error === 'object'
    ? payload.error?.errors?.flatMap((error) => error.reason ? [error.reason] : []) ?? []
    : [];
  const errorCode = typeof payload.error === 'string' ? payload.error : '';
  const reconnectRequired = context === 'token' && errorCode === 'invalid_grant';
  const transientRateLimit = responseStatus === 429 || (
    responseStatus === 403 && reasons.some((reason) => RATE_LIMIT_REASONS.has(reason))
  );
  const permanentLimit = responseStatus === 403
    && reasons.some((reason) => /(?:dailyLimit|quotaExceeded)/iu.test(reason));
  const status = reconnectRequired
    ? 401
    : transientRateLimit
      ? 429
      : context === 'token'
        ? responseStatus === 429 ? 429 : 503
        : [400, 401, 403, 404, 409, 413].includes(responseStatus) ? responseStatus : 503;
  const kind = permanentLimit ? 'limit' : inferBoundaryFailureKind(status);
  const nextAction = reconnectRequired || status === 401
    ? 'Reconnect Google Drive in Account → Storage & Library.'
    : permanentLimit
      ? 'Review the Google account storage or Google Cloud project quota before retrying.'
      : status === 403
        ? 'Confirm this Google account can access the requested Drive file or folder.'
        : status === 429
          ? 'Wait briefly, then retry the same Google Drive action without reconnecting.'
          : status >= 500
            ? 'Retry without reconnecting Google Drive. Your saved connection remains unchanged.'
            : undefined;
  return { status, kind, providerMessage, nextAction, reconnectRequired };
};

export const readGoogleProviderFailure = async (
  response: Response,
  context: 'api' | 'token' = 'api',
): Promise<GoogleProviderFailure> => {
  const payload = await response.json().catch(() => ({})) as GoogleProviderErrorPayload;
  return classifyGoogleProviderFailure(response.status, payload, context);
};
