import { describe, expect, it } from 'vitest';

import { readApiErrorMessage, requireOkResponse } from '@/infrastructure/http/clientResponses';

describe('client API responses', () => {
  it('uses the server error message for rejected responses', async () => {
    const response = Response.json({ error: { message: 'Owner approval is required.' } }, { status: 403 });

    await expect(requireOkResponse(response, 'Request failed.')).rejects.toThrow('Owner approval is required.');
  });

  it('falls back when an error response is not JSON', async () => {
    const response = new Response('upstream unavailable', { status: 503 });

    await expect(readApiErrorMessage(response, 'Request failed.')).resolves.toBe('Request failed.');
  });
});
