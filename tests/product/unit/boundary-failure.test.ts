import { describe, expect, it } from 'vitest';

import {
  describeAgentBoundaryFailure,
  readBoundaryFailureStatus,
} from '@/shared/boundaryFailure';

describe('boundary failures', () => {
  it('describes a known limit so agents can change behavior', () => {
    expect(describeAgentBoundaryFailure({ status: 413 })).toEqual({
      status: 413,
      kind: 'limit',
      retryable: false,
      nextAction: 'Reduce the payload or file size, then retry.',
    });
  });

  it('marks provider failures as retryable without implying empty state', () => {
    expect(describeAgentBoundaryFailure({ status: 503 })).toEqual({
      status: 503,
      kind: 'unavailable',
      retryable: true,
      nextAction: 'Retry later without replacing known local state with an empty result.',
    });
  });

  it('preserves an application limit carried by a conflict error', () => {
    expect(describeAgentBoundaryFailure({
      status: 409,
      kind: 'limit',
      nextAction: 'Remove one temporary draft, then retry.',
      limit: { resource: 'assistant_documents', current: 5, maximum: 5, unit: 'documents' },
    })).toMatchObject({
      status: 409,
      kind: 'limit',
      retryable: false,
      nextAction: 'Remove one temporary draft, then retry.',
      limit: { resource: 'assistant_documents', current: 5, maximum: 5, unit: 'documents' },
    });
  });

  it('preserves the retry window for an agent rate-limit failure', () => {
    expect(describeAgentBoundaryFailure({
      status: 429,
      retryAfterSeconds: 3600,
      limit: { resource: 'actions', maximum: 60, unit: 'attempts_per_hour' },
    })).toMatchObject({
      kind: 'limit',
      retryable: true,
      retryAfterSeconds: 3600,
      limit: { resource: 'actions', maximum: 60, unit: 'attempts_per_hour' },
    });
  });

  it('does not trust invalid status-shaped values', () => {
    expect(readBoundaryFailureStatus({ status: 200 })).toBe(500);
    expect(readBoundaryFailureStatus(new Error('unknown'))).toBe(500);
  });
});
