import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/registryContentAssets', () => ({
  getPublishedRegistryContentRows: vi.fn(async () => []),
  readRegistryContentAsset: vi.fn(),
}));

afterEach(() => {
  vi.resetModules();
});

describe('catalog bootstrap routes', () => {
  it('serves shipped template files when the registry has no published templates', async () => {
    const { GET } = await import('@/app/api/templates/route');

    const response = await GET();
    const body = await response.json() as { defaults?: Array<{ id?: string; name?: string }> };

    expect(response.status).toBe(200);
    expect(body.defaults?.some((template) => template.id === 'default-playing-card-theme')).toBe(true);
    expect(body.defaults?.some((template) => template.id === 'default-obsidian-neon-card-back')).toBe(true);
  });

  it('serves shipped style files when the registry has no published styles', async () => {
    const { GET } = await import('@/app/api/styles/route');

    const response = await GET();
    const body = await response.json() as { styles?: Array<{ id?: string; name?: string }> };

    expect(response.status).toBe(200);
    expect(body.styles?.some((style) => style.id === 'material-arcane-forge-parchment')).toBe(true);
    expect(body.styles?.some((style) => style.id === 'divider-gem-center')).toBe(true);
  });
});
