import {
  inferBoundaryFailureKind,
  isRetryableBoundaryStatus,
  type BoundaryFailureKind,
  type BoundaryLimit,
} from '@/shared/boundaryFailure';

export class ApiClientError extends Error {
  readonly name = 'ApiClientError';

  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly kind: BoundaryFailureKind,
    public readonly retryable: boolean,
    public readonly correlationId: string | null,
    public readonly nextAction?: string,
    public readonly retryAfterSeconds?: number,
    public readonly limit?: BoundaryLimit,
  ) {
    super(message);
  }
}

interface ParsedApiErrorBody {
  error: {
    code?: string;
    message: string;
    kind?: BoundaryFailureKind;
    retryable?: boolean;
    nextAction?: string;
    retryAfterSeconds?: number;
    limit?: BoundaryLimit;
  };
  correlationId?: string;
}

const isApiErrorBody = (value: unknown): value is ParsedApiErrorBody => {
  if (!value || typeof value !== 'object') return false;
  const body = value as Partial<ParsedApiErrorBody>;
  return Boolean(
    body.error
    && typeof body.error.message === 'string',
  );
};

export const readApiError = async (
  response: Response,
  fallback: string,
): Promise<ApiClientError> => {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!isApiErrorBody(body)) {
    return new ApiClientError(
      fallback,
      response.status,
      'unknown_error',
      inferBoundaryFailureKind(response.status),
      isRetryableBoundaryStatus(response.status),
      response.headers.get('x-correlation-id'),
    );
  }
  return new ApiClientError(
    body.error.message,
    response.status,
    body.error.code ?? 'unknown_error',
    body.error.kind ?? inferBoundaryFailureKind(response.status),
    body.error.retryable ?? isRetryableBoundaryStatus(response.status),
    body.correlationId ?? response.headers.get('x-correlation-id'),
    body.error.nextAction,
    body.error.retryAfterSeconds,
    body.error.limit,
  );
};

export const readApiErrorMessage = async (
  response: Response,
  fallback: string,
): Promise<string> => (await readApiError(response, fallback)).message;

export const requireOkResponse = async (
  response: Response,
  fallback: string,
): Promise<Response> => {
  if (!response.ok) throw await readApiError(response, fallback);
  return response;
};
