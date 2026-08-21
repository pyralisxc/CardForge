export class StudioDocumentStoreError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 404 | 409 | 413 | 500 | 503 = 500,
  ) {
    super(message);
  }
}
