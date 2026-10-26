import { createHash } from 'node:crypto';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { buildPluginArchive } from '../../../scripts/plugin-package-core.mjs';

describe('one canonical ZIP recipe', () => {
  it('generates deterministic, checksummed and environment-pinned bytes for four packages', async () => {
    for (const product of ['studio', 'owner'] as const) {
      for (const environment of ['production', 'preview'] as const) {
        const first = await buildPluginArchive(product, environment);
        const second = await buildPluginArchive(product, environment);
        expect(first.bytes.equals(second.bytes)).toBe(true);
        expect(createHash('sha256').update(first.bytes).digest('hex')).toBe(first.checksum);
        const parsed = await JSZip.loadAsync(first.bytes);
        const prefix = environment === 'preview' ? first.name + '/' : '';
        const portable = JSON.parse(await parsed.file(prefix + 'mcp.json')!.async('string'));
        const legacy = JSON.parse(await parsed.file(prefix + '.mcp.json')!.async('string'));
        const expected = (environment === 'preview'
          ? 'https://card-forge-git-vercel-preview-pyralis-projects.vercel.app'
          : 'https://cardforges.com') + (product === 'owner' ? '/mcp/owner' : '/mcp');
        expect(portable.mcpServers[first.name].url).toBe(expected);
        expect(legacy.mcpServers[first.name].url).toBe(expected);
        expect(await parsed.file(prefix + 'icon.svg')!.async('string')).toContain('<svg');
        expect(parsed.file(prefix + 'plugin.json')).not.toBeNull();
        expect([...Object.keys(parsed.files)].some(file => file.includes('SKILL.md'))).toBe(true);
        expect(first.bytes.toString('utf8')).not.toContain('VERCEL_AUTOMATION_BYPASS_SECRET');
      }
    }
  });
});
