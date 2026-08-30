import type { BoundaryFailureKind, BoundaryLimit } from '@/shared/boundaryFailure';

export class PipelineStoreError extends Error {
  constructor(
    message: string,
    public readonly status = 500,
    public readonly boundary: {
      kind?: BoundaryFailureKind;
      nextAction?: string;
      limit?: BoundaryLimit;
      code?: string;
    } = {},
  ) {
    super(message);
  }
}
