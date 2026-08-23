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
        code: 'cloud_set_conflict',
        message: 'All cloud slots are in use.',
        kind: 'limit',
        retryable: false,
        nextAction: 'Remove a cloud save before adding another.',
        limit: { resource: 'cloud_set_slots', current: 1, maximum: 1, unit: 'sets' },
      },
      correlationId: 'request-123',
    }, { status: 409 });

    const error = await readApiError(response, 'Cloud save failed.');

    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({
      status: 409,
      code: 'cloud_set_conflict',
      kind: 'limit',
      retryable: false,
      correlationId: 'request-123',
      nextAction: 'Remove a cloud save before adding another.',
      limit: { resource: 'cloud_set_slots', current: 1, maximum: 1, unit: 'sets' },
    });
  });
});
