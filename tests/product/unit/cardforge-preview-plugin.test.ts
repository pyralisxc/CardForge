import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

const origin = 'https://card-forge-git-vercel-preview-pyralis-projects.vercel.app';
const script = 'scripts/package-cardforge-preview-plugins.mjs';
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const run = (cwd: string, output: string) => execFileSync(process.execPath, [script, output], { cwd, stdio: 'pipe' });

describe('private Preview plugin derivation', () => {
  it('pins isolated endpoints, preserves canonical skills and production bytes, and produces reproducible allowlisted archives', async () => {
    const root = process.cwd();
    const scratch = mkdtempSync(join(tmpdir(), 'cardforge-preview-'));
    try {
      const sources = ['studio', 'owner'].map((product) => {
        const source = join(root, 'plugins', `cardforge-${product}`);
        return {
          product, source,
          manifest: readFileSync(join(source, '.codex-plugin/plugin.json')),
          mcp: readFileSync(join(source, '.mcp.json')),
        };
      });
      const productionScripts = ['scripts/package-cardforge-plugin.mjs', 'scripts/package-cardforge-owner-plugin.mjs'];
      for (const productionScript of productionScripts) {
        execFileSync(process.execPath, [productionScript, join(scratch, 'before')], { cwd: root });
      }
      run(root, join(scratch, 'a'));
      run(root, join(scratch, 'b'));
      for (const item of sources) {
        const canonical = JSON.parse(item.manifest.toString());
        const name = `cardforge-${item.product}-preview`;
        const filename = `${name}-${canonical.version}.zip`;
        const bytes = readFileSync(join(scratch, 'a', filename));
        expect(hash(bytes)).toBe(hash(readFileSync(join(scratch, 'b', filename))));
        const zip = await JSZip.loadAsync(bytes);
        const skills = item.product === 'studio' ? [
          'skills/create-cards-and-sets/SKILL.md', 'skills/create-editable-template/SKILL.md',
        ] : [];
        expect(Object.keys(zip.files).sort()).toEqual(['.codex-plugin/plugin.json', '.mcp.json', 'mcp.json', 'plugin.json', ...skills].map((file) => `${name}/${file}`).sort());
        const manifest = JSON.parse(await zip.file(`${name}/.codex-plugin/plugin.json`)!.async('string'));
        expect(manifest).toMatchObject({
          name, version: canonical.version, mcpServers: './.mcp.json',
          interface: {
            displayName: `CardForge ${item.product === 'studio' ? 'Studio' : 'Owner'} Preview`,
            websiteURL: origin,
            capabilities: canonical.interface.capabilities,
          },
        });
        const portable = JSON.parse(await zip.file(`${name}/plugin.json`)!.async('string'));
        expect(portable).toMatchObject({ name, version: canonical.version, extensions: {
          'com.openai': { interface: manifest.interface },
        } });
        expect(portable).not.toHaveProperty('mcpServers');
        expect(portable).not.toHaveProperty('skills');
        expect(manifest.interface.shortDescription.length).toBeLessThanOrEqual(30);
        expect(manifest.interface.defaultPrompt).toEqual(canonical.interface.defaultPrompt);
        expect(manifest.interface.longDescription).not.toContain('Vercel protection');
        expect(JSON.parse(await zip.file(`${name}/mcp.json`)!.async('string'))).toEqual({
          $schema: 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',
          mcpServers: { [name]: { type: 'streamable-http', url: `${origin}/mcp${item.product === 'owner' ? '/owner' : ''}` } },
        });
        expect(manifest.interface.longDescription).toContain('Staging');
        expect(manifest.interface.longDescription).toContain('grants no Owner or Contributor permission');
        expect(manifest.interface.privacyPolicyURL).toBe(canonical.interface.privacyPolicyURL);
        expect(manifest.interface.termsOfServiceURL).toBe(canonical.interface.termsOfServiceURL);
        expect(JSON.parse(await zip.file(`${name}/.mcp.json`)!.async('string'))).toEqual({ mcpServers: {
          [name]: { type: 'http', url: `${origin}/mcp${item.product === 'owner' ? '/owner' : ''}` },
        } });
        for (const skill of skills) {
          expect(await zip.file(`${name}/${skill}`)!.async('nodebuffer')).toEqual(readFileSync(join(item.source, skill)));
        }
        expect(readFileSync(join(item.source, '.codex-plugin/plugin.json'))).toEqual(item.manifest);
        expect(readFileSync(join(item.source, '.mcp.json'))).toEqual(item.mcp);
      }
      for (const productionScript of productionScripts) {
        execFileSync(process.execPath, [productionScript, join(scratch, 'after')], { cwd: root });
      }
      for (const item of sources) {
        const filename = `cardforge-${item.product}-${JSON.parse(item.manifest.toString()).version}.zip`;
        expect(hash(readFileSync(join(scratch, 'after', filename)))).toBe(hash(readFileSync(join(scratch, 'before', filename))));
      }
    } finally { rmSync(scratch, { recursive: true, force: true }); }
  });

  it.each(['alternate-endpoint', 'query-token', 'credential-header', 'extra-server', 'skill-secret', 'invalid-metadata'])('rejects %s before creating archives', (attack) => {
    const root = mkdtempSync(join(tmpdir(), 'cardforge-preview-negative-'));
    try {
      mkdirSync(join(root, 'scripts'));
      cpSync(resolve(script), join(root, script));
      cpSync(resolve('plugins'), join(root, 'plugins'), { recursive: true });
      symlinkSync(resolve('node_modules'), join(root, 'node_modules'), 'dir');
      // Corrupt Owner so Studio has already been prepared; neither output should be emitted.
      const mcpPath = join(root, 'plugins/cardforge-owner/.mcp.json');
      const mcp = JSON.parse(readFileSync(mcpPath, 'utf8'));
      const server = mcp.mcpServers['cardforge-owner'];
      if (attack === 'alternate-endpoint') server.url = `${origin}/mcp/owner`;
      if (attack === 'query-token') server.url += '?x-vercel-protection-bypass=fake';
      if (attack === 'credential-header') server.headers = { Authorization: 'Bearer fake' };
      if (attack === 'extra-server') mcp.mcpServers.extra = { type: 'http', url: 'https://example.com/mcp' };
      writeFileSync(mcpPath, JSON.stringify(mcp));
      if (attack === 'skill-secret') writeFileSync(join(root, 'plugins/cardforge-studio/skills/create-editable-template/SKILL.md'), 'VERCEL_AUTOMATION_BYPASS_SECRET=fake');
      if (attack === 'invalid-metadata') {
        const file = join(root, 'plugins/cardforge-owner/.codex-plugin/plugin.json');
        const manifest = JSON.parse(readFileSync(file, 'utf8'));
        manifest.name = 'other';
        writeFileSync(file, JSON.stringify(manifest));
      }
      expect(() => run(root, 'out')).toThrow();
      expect(() => readFileSync(join(root, 'out/cardforge-studio-preview-1.0.1.zip'))).toThrow();
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
