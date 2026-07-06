import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('client bootstrap data loaders', () => {
  it('retries templates after a transient failed bootstrap request', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ defaults: [{ id: 'base-template', name: 'Base Template' }] }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const { loadBootstrapTemplates } = await import('@/lib/clientBootstrapData');

    await expect(loadBootstrapTemplates()).rejects.toThrow('Failed to load /api/templates: 500');
    await expect(loadBootstrapTemplates()).resolves.toEqual({
      defaults: [{ id: 'base-template', name: 'Base Template' }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
