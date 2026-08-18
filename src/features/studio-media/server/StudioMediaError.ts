export class StudioMediaError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 500 | 503 = 500,
  ) {
    super(message);
  }
}
