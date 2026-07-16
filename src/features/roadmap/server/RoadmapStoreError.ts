export class RoadmapStoreError extends Error {
  constructor(message: string, public readonly status = 500) {
    super(message);
  }
}
