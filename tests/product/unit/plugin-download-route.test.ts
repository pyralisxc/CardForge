import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';

const access = vi.hoisted(() => vi.fn());
const build = vi.hoisted(() => vi.fn());
vi.mock('@/features/plugin-distribution/server', () => ({
  pluginDownloadAccess: access,
  buildCurrentPlugin: build,
}));
import { GET } from '@/app/api/plugin-downloads/route';

const request = (product = 'studio', environment = 'preview', suffix = '') =>
  new Request('https://cardforges.com/api/plugin-downloads?product=' + product + '&environment=' + environment + suffix);
const zip = new Uint8Array([80, 75, 3, 4, 0, 0]);
const checksum = createHash('sha256').update(zip).digest('hex');

describe('plugin release route: real HTTP response boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    access.mockResolvedValue(200);
    build.mockResolvedValue({
      bytes: Buffer.from(zip), checksum, version: '1.0.3',
      filename: 'cardforge-studio-preview-1.0.3.zip',
      environment: 'preview', endpoint: 'https://card-forge-git-vercel-preview-pyralis-projects.vercel.app/mcp',
      appSha: 'testsha', releaseDate: null, name: 'cardforge-studio-preview',
      changes: 'Test', compatibility: ['portable'],
    });
  });
  it('rejects malformed selectors without touching authorization or bytes', async () => {
    const response = await GET(request('invalid'));
    expect(response.status).toBe(400);
    expect(access).not.toHaveBeenCalled();
    expect(build).not.toHaveBeenCalled();
  });
  it.each([401, 403] as const)('fails closed for denied %s on both listing and download', async (status) => {
    access.mockResolvedValue(status);
    for (const suffix of ['', '&download=1&sha256=' + checksum]) {
      const response = await GET(request('owner', 'production', suffix));
      expect(response.status).toBe(status);
      expect(response.headers.get('content-type')).not.toContain('application/zip');
    }
    expect(build).not.toHaveBeenCalled();
  });
  it('lists only verified latest metadata without bytes or invented history', async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.previous).toEqual([]);
    expect(data.latest.checksum).toBe(checksum);
    expect(data.latest).not.toHaveProperty('bytes');
  });
  it('serves exact ZIP bytes with their matching checksum and private cache headers', async () => {
    const response = await GET(request('studio', 'preview', '&download=1&sha256=' + checksum));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/zip');
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(response.headers.get('X-Checksum-SHA256')).toBe(checksum);
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(bytes).toEqual(zip);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(checksum);
  });
  it('refuses stale checksum and unavailable artifact', async () => {
    expect((await GET(request('studio', 'preview', '&download=1&sha256=old'))).status).toBe(409);
    build.mockRejectedValue(new Error('artifact unavailable'));
    expect((await GET(request())).status).toBe(503);
  });
});
