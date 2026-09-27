import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchSupabaseServerRead } from '@/infrastructure/database/supabaseServer';

const originalFetch = globalThis.fetch;

afterEach(() => {
  vi.useRealTimers();
  globalThis.fetch = originalFetch;
});

describe('Supabase server reads', () => {
  it('retries the transient PostgREST future-issued JWT error on a GET', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'PGRST303', message: 'JWT issued at future' }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = request;

    const response = await fetchSupabaseServerRead('https://example.test/rest/v1/settings');

    expect(response.status).toBe(200);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1]?.[1]).toMatchObject({ cache: 'no-store' });
  });

  it('tolerates repeated future-issued JWT responses across the bounded clock-skew window', async () => {
    vi.useFakeTimers();
    const futureJwt = () => new Response(JSON.stringify({ code: 'PGRST303', message: 'JWT issued at future' }), { status: 401 });
    const request = vi.fn()
      .mockResolvedValueOnce(futureJwt())
      .mockResolvedValueOnce(futureJwt())
      .mockResolvedValueOnce(futureJwt())
      .mockResolvedValueOnce(futureJwt())
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = request;

    const responsePromise = fetchSupabaseServerRead('https://example.test/rest/v1/settings');
    await vi.runAllTimersAsync();
    const response = await responsePromise;

    expect(response.status).toBe(200);
    expect(request).toHaveBeenCalledTimes(5);
    expect(request.mock.calls.slice(1).every(([, init]) => init?.cache === 'no-store')).toBe(true);
  });

  it('returns the final provider failure after the bounded future-JWT retry window is exhausted', async () => {
    vi.useFakeTimers();
    const futureJwt = () => new Response(JSON.stringify({ code: 'PGRST303', message: 'JWT issued at future' }), { status: 401 });
    const request = vi.fn().mockImplementation(async () => futureJwt());
    globalThis.fetch = request;

    const responsePromise = fetchSupabaseServerRead('https://example.test/rest/v1/settings');
    await vi.runAllTimersAsync();
    const response = await responsePromise;

    expect(response.status).toBe(401);
    expect(request).toHaveBeenCalledTimes(5);
  });

  it('does not retry a different authentication failure or a write', async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'PGRST301', message: 'Invalid JWT' }), { status: 401 }));
    globalThis.fetch = request;
    expect((await fetchSupabaseServerRead('https://example.test/rest/v1/settings')).status).toBe(401);
    expect(request).toHaveBeenCalledTimes(1);

    request.mockResolvedValue(new Response(JSON.stringify({ code: 'PGRST303', message: 'JWT issued at future' }), { status: 401 }));
    expect((await fetchSupabaseServerRead('https://example.test/rest/v1/settings', { method: 'POST' })).status).toBe(401);
    expect(request).toHaveBeenCalledTimes(2);
  });
});
