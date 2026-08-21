import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/.well-known/openai-apps-challenge/route';

describe('OpenAI plugin domain challenge', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('stays unavailable until the submission portal provides a token', async () => {
    vi.stubEnv('OPENAI_APPS_CHALLENGE_TOKEN', '');

    const response = await GET();

    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('returns only the configured token as plain text without caching', async () => {
    vi.stubEnv('OPENAI_APPS_CHALLENGE_TOKEN', 'openai-verification-token');

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.text()).resolves.toBe('openai-verification-token');
  });

  it('rejects multiline values instead of returning extra challenge content', async () => {
    vi.stubEnv('OPENAI_APPS_CHALLENGE_TOKEN', 'token\nsecond-token');

    await expect(GET()).resolves.toMatchObject({ status: 404 });
  });
});
