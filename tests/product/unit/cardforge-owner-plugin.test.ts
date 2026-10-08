import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

describe('CardForge Owner plugin', () => {
  it('packages a deterministic Owner-only MCP plugin without Studio skills or source', async () => {
    const manifest = JSON.parse(readFileSync(
      resolve(process.cwd(), 'plugins/cardforge-owner/.codex-plugin/plugin.json'),
      'utf8',
    )) as { version: string; mcpServers: string };
    const firstDirectory = mkdtempSync(join(tmpdir(), 'cardforge-owner-plugin-a-'));
    const secondDirectory = mkdtempSync(join(tmpdir(), 'cardforge-owner-plugin-b-'));
    try {
      execFileSync(process.execPath, ['scripts/package-cardforge-owner-plugin.mjs', firstDirectory], {
        cwd: process.cwd(),
        stdio: 'pipe',
      });
      execFileSync(process.execPath, ['scripts/package-cardforge-owner-plugin.mjs', secondDirectory], {
        cwd: process.cwd(),
        stdio: 'pipe',
      });
      const fileName = 'cardforge-owner-' + manifest.version + '.zip';
      const firstBytes = readFileSync(join(firstDirectory, fileName));
      const secondBytes = readFileSync(join(secondDirectory, fileName));
      expect(createHash('sha256').update(firstBytes).digest('hex')).toBe(
        createHash('sha256').update(secondBytes).digest('hex'),
      );

      const zip = await JSZip.loadAsync(firstBytes);
      const files = Object.values(zip.files).filter((entry) => !entry.dir).map((entry) => entry.name).sort();
      expect(files).toEqual([
        '.codex-plugin/plugin.json',
        '.mcp.json',
      ]);
      expect(files.some((file) => file.includes('cardforge-studio') || file.startsWith('src/') || file.startsWith('tests/'))).toBe(false);

      const packagedManifest = JSON.parse(await zip.file('.codex-plugin/plugin.json')!.async('string')) as Record<string, unknown>;
      const packagedMcp = JSON.parse(await zip.file('.mcp.json')!.async('string')) as {
        mcpServers: { 'cardforge-owner': { type: string; url: string } };
      };
      expect(packagedManifest).toMatchObject({
        name: 'cardforge-owner',
        version: '0.2.0',
        mcpServers: './.mcp.json',
        interface: {
          displayName: 'CardForge Owner',
          developerName: 'Cameron Locke',
          capabilities: ['Read', 'Write'],
        },
      });
      expect(packagedManifest).not.toHaveProperty('skills');
      expect(packagedMcp.mcpServers['cardforge-owner']).toEqual({
        type: 'http',
        url: 'https://cardforges.com/mcp/owner',
      });
    } finally {
      rmSync(firstDirectory, { recursive: true, force: true });
      rmSync(secondDirectory, { recursive: true, force: true });
    }
  });

  it('keeps the Owner plugin separated from Studio authoring', () => {
    const manifest = readFileSync(
      resolve(process.cwd(), 'plugins/cardforge-owner/.codex-plugin/plugin.json'),
      'utf8',
    );
    const tools = readFileSync(
      resolve(process.cwd(), 'src/features/owner/server/mcpOwnerTools.ts'),
      'utf8',
    );

    expect(manifest).toContain('Operate the CardForge property');
    expect(tools).toContain("'get_owner_site_snapshot'");
    expect(tools).toContain("'get_owner_provider_readiness'");
    expect(tools).toContain("'get_owner_activity'");
    expect(tools).toContain("'publish_owner_site_copy'");
    expect(tools).toContain('expectedUpdatedAt');
    expect(tools).not.toContain('create_editable_template');
    expect(tools).not.toContain('update_owner_setting');
  });
});