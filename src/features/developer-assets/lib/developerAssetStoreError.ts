import type { BoundaryFailureKind, BoundaryLimit } from '@/shared/boundaryFailure';

export class DeveloperAssetStoreError extends Error {
  constructor(
    message: string,
    public readonly status = 500,
    public readonly boundary: {
      kind?: BoundaryFailureKind;
      nextAction?: string;
      limit?: BoundaryLimit;
    } = {},
  ) {
    super(message);
  }
}
