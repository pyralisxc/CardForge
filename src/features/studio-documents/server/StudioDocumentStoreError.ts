export class StudioDocumentStoreError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 404 | 409 | 500 | 503 = 500,
  ) {
    super(message);
  }
}
