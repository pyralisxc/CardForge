export const BOUNDARY_FAILURE_KINDS = [
  'authentication',
  'authorization',
  'conflict',
  'invalid',
  'limit',
  'not_found',
  'unavailable',
] as const;

export type BoundaryFailureKind = typeof BOUNDARY_FAILURE_KINDS[number];

export interface BoundaryLimit {
  resource: string;
  maximum: number;
  unit: string;
  current?: number;
}

export interface BoundaryFailureMetadata {
  kind: BoundaryFailureKind;
  retryable: boolean;
  nextAction?: string;
  retryAfterSeconds?: number;
  limit?: BoundaryLimit;
}

export interface AgentBoundaryFailureMetadata extends BoundaryFailureMetadata {
  status: number;
}

export const inferBoundaryFailureKind = (status: number): BoundaryFailureKind => {
  if (status === 401) return 'authentication';
  if (status === 403) return 'authorization';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 413 || status === 429) return 'limit';
  if (status >= 500) return 'unavailable';
  return 'invalid';
};

export const isRetryableBoundaryStatus = (status: number): boolean => (
  status === 408 || status === 425 || status === 429 || status >= 500
);

export const readBoundaryFailureStatus = (error: unknown, fallbackStatus = 500): number => {
  if (typeof error !== 'object' || error === null || !('status' in error)) return fallbackStatus;
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' && Number.isInteger(status) && status >= 400 && status <= 599
    ? status
    : fallbackStatus;
};

const isBoundaryFailureKind = (value: unknown): value is BoundaryFailureKind => (
  typeof value === 'string' && (BOUNDARY_FAILURE_KINDS as readonly string[]).includes(value)
);

const readErrorRecord = (error: unknown): Record<string, unknown> => (
  typeof error === 'object' && error !== null ? error as Record<string, unknown> : {}
);

const nextActionForStatus = (status: number): string => {
  if (status === 401) return 'Sign in, then retry the same action.';
  if (status === 403) return 'Ask the CardForge owner for access if this action should be available.';
  if (status === 404) return 'Refresh the current CardForge state before retrying.';
  if (status === 409) return 'Reload the current object, preserve stable ids, and retry against its latest revision.';
  if (status === 413) return 'Reduce the cloud payload or file size, then retry.';
  if (status === 429) return 'Wait for the retry window before sending the action again.';
  if (status >= 500) return 'Retry later without replacing known local state with an empty result.';
  return 'Correct the request using the error message, then retry.';
};

export const describeAgentBoundaryFailure = (error: unknown): AgentBoundaryFailureMetadata => {
  const status = readBoundaryFailureStatus(error);
  const record = readErrorRecord(error);
  const nestedBoundary = readErrorRecord(record.boundary);
  const suppliedKind = isBoundaryFailureKind(record.kind)
    ? record.kind
    : isBoundaryFailureKind(nestedBoundary.kind)
      ? nestedBoundary.kind
      : null;
  const suppliedNextAction = typeof record.nextAction === 'string'
    ? record.nextAction
    : typeof nestedBoundary.nextAction === 'string'
      ? nestedBoundary.nextAction
      : null;
  const suppliedLimit = (
    typeof record.limit === 'object' && record.limit !== null
      ? record.limit
      : typeof nestedBoundary.limit === 'object' && nestedBoundary.limit !== null
        ? nestedBoundary.limit
        : null
  ) as BoundaryLimit | null;
  const suppliedRetryAfterSeconds = typeof record.retryAfterSeconds === 'number'
    ? record.retryAfterSeconds
    : typeof nestedBoundary.retryAfterSeconds === 'number'
      ? nestedBoundary.retryAfterSeconds
      : null;
  return {
    status,
    kind: suppliedKind ?? inferBoundaryFailureKind(status),
    retryable: isRetryableBoundaryStatus(status),
    nextAction: suppliedNextAction ?? nextActionForStatus(status),
    ...(suppliedRetryAfterSeconds !== null ? { retryAfterSeconds: suppliedRetryAfterSeconds } : {}),
    ...(suppliedLimit ? { limit: suppliedLimit } : {}),
  };
};
