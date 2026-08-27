import { describe, expect, it } from 'vitest';

import { ApiClientError, readApiError, readApiErrorMessage, requireOkResponse } from '@/infrastructure/http/clientResponses';

describe('client API responses', () => {
  it('uses the server error message for rejected responses', async () => {
    const response = Response.json({ error: { message: 'Owner approval is required.' } }, { status: 403 });

    await expect(requireOkResponse(response, 'Request failed.')).rejects.toThrow('Owner approval is required.');
  });

  it('falls back when an error response is not JSON', async () => {
    const response = new Response('upstream unavailable', { status: 503 });

    await expect(readApiErrorMessage(response, 'Request failed.')).resolves.toBe('Request failed.');
  });

  it('preserves machine-readable boundary metadata for users and agents', async () => {
    const response = Response.json({
      ok: false,
      error: {
        code: 'studio_document_conflict',
        message: 'The working document changed.',
        kind: 'limit',
        retryable: false,
        nextAction: 'Reload the current revision before retrying.',
      },
      correlationId: 'request-123',
    }, { status: 409 });

    const error = await readApiError(response, 'Working document update failed.');

    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({
      status: 409,
      code: 'studio_document_conflict',
      kind: 'limit',
      retryable: false,
      correlationId: 'request-123',
      nextAction: 'Reload the current revision before retrying.',
    });
  });
});
