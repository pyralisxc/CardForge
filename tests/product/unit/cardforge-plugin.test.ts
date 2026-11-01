import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import JSZip from 'jszip';
import sharp from 'sharp';

import { describe, expect, it } from 'vitest';

import { DEFAULT_LEGAL_DOCUMENTS } from '@/features/legal/client';
import { getCardForgePluginSkillCatalog } from '@/features/studio-documents/server/mcpPluginSkills';

describe('CardForge Studio plugin', () => {
  it('builds a deterministic standalone ZIP from the plugin-only allowlist', async () => {
    const manifest = JSON.parse(readFileSync(
      resolve(process.cwd(), 'plugins/cardforge-studio/.codex-plugin/plugin.json'),
      'utf8',
    )) as { version: string; mcpServers: string; skills: string };
    const firstDirectory = mkdtempSync(join(tmpdir(), 'cardforge-plugin-a-'));
    const secondDirectory = mkdtempSync(join(tmpdir(), 'cardforge-plugin-b-'));
    try {
      execFileSync(process.execPath, ['scripts/package-cardforge-plugin.mjs', firstDirectory], {
        cwd: process.cwd(),
        stdio: 'pipe',
      });
      execFileSync(process.execPath, ['scripts/package-cardforge-plugin.mjs', secondDirectory], {
        cwd: process.cwd(),
        stdio: 'pipe',
      });
      const fileName = `cardforge-studio-${manifest.version}.zip`;
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
        'assets/icon.png',
        'assets/logo.png',
        'icon.svg',
        'mcp.json',
        'plugin.json',
        'skills/create-cards-and-sets/SKILL.md',
        'skills/create-editable-template/SKILL.md',
      ]);
      expect(files).not.toContain('SUBMISSION.md');
      expect(files).not.toContain('REVIEW_CASES.json');
      expect(files.some((file) => file.includes('.env') || file.startsWith('src/') || file.startsWith('tests/'))).toBe(false);

      const packagedManifest = JSON.parse(await zip.file('.codex-plugin/plugin.json')!.async('string')) as {
        version: string; mcpServers: string; skills: string;
      };
      const packagedMcp = JSON.parse(await zip.file('.mcp.json')!.async('string')) as {
        mcpServers: { 'cardforge-studio': { url: string } };
      };
      expect(packagedManifest).toMatchObject({
        version: manifest.version,
        mcpServers: './.mcp.json',
        skills: './skills/',
      });
      expect(packagedMcp.mcpServers['cardforge-studio'].url).toBe('https://cardforges.com/mcp');

      for (const skill of ['create-editable-template', 'create-cards-and-sets']) {
        const source = readFileSync(resolve(process.cwd(), 'plugins/cardforge-studio/skills', skill, 'SKILL.md'), 'utf8');
        expect(await zip.file(`skills/${skill}/SKILL.md`)!.async('string')).toBe(source);
      }
    } finally {
      rmSync(firstDirectory, { recursive: true, force: true });
      rmSync(secondDirectory, { recursive: true, force: true });
    }
  });

  it('packages the authenticated production MCP server for ChatGPT and Codex', () => {
    const manifest = JSON.parse(readFileSync(
      resolve(process.cwd(), 'plugins/cardforge-studio/.codex-plugin/plugin.json'),
      'utf8',
    )) as Record<string, unknown>;
    const mcp = JSON.parse(readFileSync(
      resolve(process.cwd(), 'plugins/cardforge-studio/.mcp.json'),
      'utf8',
    )) as { mcpServers: { 'cardforge-studio': { type: string; url: string } } };

    expect(manifest).toMatchObject({
      name: 'cardforge-studio',
      version: '1.0.4',
      author: { name: 'Cameron Locke' },
      mcpServers: './.mcp.json',
      skills: './skills/',
      interface: { developerName: 'Cameron Locke' },
    });
    expect(mcp.mcpServers['cardforge-studio']).toEqual({
      type: 'http',
      url: 'https://cardforges.com/mcp',
    });
  });

  it('serves submission-time skill manifests with exact content digests', () => {
    const catalog = getCardForgePluginSkillCatalog();
    expect(catalog.map((skill) => skill.frontmatter.name)).toEqual([
      'create-editable-template',
      'create-cards-and-sets',
    ]);

    for (const skill of catalog) {
      const content = readFileSync(resolve(
        process.cwd(),
        'plugins/cardforge-studio/skills',
        skill.frontmatter.name,
        'SKILL.md',
      ), 'utf8');
      expect(skill.resources).toEqual([{
        uri: skill.uri,
        digest: `sha256:${createHash('sha256').update(content, 'utf8').digest('hex')}`,
      }]);
    }
  });

  it('discloses private assistant documents and aggregate MCP usage', () => {
    const privacy = DEFAULT_LEGAL_DOCUMENTS.find((document) => document.slug === 'privacy');

    expect(privacy?.body).toContain('private assistant working documents');
    expect(privacy?.body).toContain('aggregate MCP usage');
  });

  it('keeps a reviewer-ready submission source without committing credentials', async () => {
    const submission = readFileSync(
      resolve(process.cwd(), 'plugins/cardforge-studio/SUBMISSION.md'),
      'utf8',
    );
    const envExample = readFileSync(resolve(process.cwd(), '.env.example'), 'utf8');
    const operations = readFileSync(resolve(process.cwd(), 'docs/operations.md'), 'utf8');

    const cases = JSON.parse(readFileSync(resolve(process.cwd(), 'plugins/cardforge-studio/REVIEW_CASES.json'), 'utf8')) as {
      version: string;
      positive: Array<{ description: string; prompt: string; tools_triggered: string; expected_behavior: string; setup: string; status: string }>;
      negative: Array<{ description: string; prompt: string; expected_behavior: string; setup: string; status: string }>;
    };
    expect(cases.version).toBe('1.0.4');
    expect(cases.positive).toHaveLength(5);
    expect(cases.negative).toHaveLength(5);
    for (const item of [...cases.positive, ...cases.negative]) {
      expect(item.prompt.trim().length).toBeGreaterThan(0);
      expect(item.description.trim().length).toBeGreaterThan(0);
      expect(item.setup).toBeTruthy();
      expect(item.status).toBe('Not run');
    }
    const packaged = await (await import('../../../scripts/plugin-package-core.mjs')).buildPluginArchive('studio', 'production');
    const zip = await JSZip.loadAsync(packaged.bytes);
    const portable = JSON.parse(await zip.file('plugin.json')!.async('string'));
    const codex = JSON.parse(await zip.file('.codex-plugin/plugin.json')!.async('string'));
    const listing = portable.extensions['com.openai'].interface;
    expect(listing.shortDescription.length).toBeLessThanOrEqual(30);
    expect(listing.displayName.length).toBeLessThanOrEqual(30);
    expect(listing.developerName.length).toBeLessThanOrEqual(80);
    expect(listing.longDescription.length).toBeLessThanOrEqual(4000);
    for (const name of ['websiteURL','supportURL','privacyPolicyURL','termsOfServiceURL']) expect(String(listing[name]).startsWith('https://')).toBe(true);
    expect(listing.defaultPrompt).toHaveLength(3);
    for (const prompt of listing.defaultPrompt) expect(prompt.length).toBeLessThanOrEqual(128);
    expect(portable.extensions['com.openai'].review.test_cases.positive).toHaveLength(5);
    expect(portable.extensions['com.openai'].review.test_cases.negative).toHaveLength(3);
    expect(listing.category).toBe('Creativity');
    for (const [index, negative] of portable.extensions['com.openai'].review.test_cases.negative.entries()) {
      expect(negative.description).toContain(cases.negative[index].setup);
      expect(negative.description).toContain(cases.negative[index].expected_behavior);
      expect(negative).not.toHaveProperty('setup');
      expect(negative).not.toHaveProperty('expected_behavior');
    }
    expect(cases.positive[1].setup).toContain('creates the first private fixture');
    const embeddedPng = cases.positive[1].setup.match(/raw base64 ([A-Za-z0-9+/=]+)/)?.[1];
    expect(embeddedPng).toBeTruthy();
    const decoded = await sharp(Buffer.from(embeddedPng!, 'base64')).raw().toBuffer({ resolveWithObject: true });
    expect(decoded.info.width).toBe(2);
    expect(decoded.info.height).toBe(2);
    expect(decoded.data.length).toBeGreaterThan(0);
    expect(codex.extensions['com.openai'].review.test_cases).toEqual(portable.extensions['com.openai'].review.test_cases);
    expect(listing.logo).toBe('./assets/logo.png');
    expect(listing.composerIcon).toBe('./assets/icon.png');
    const packet = await (await import('../../../scripts/plugin-review-packet-core.mjs')).buildStudioReviewerPacket('production','1.0.4');
    expect(packet).toContain('P5');
    expect(packet).toContain('N5');
    expect(packet).toContain('Not run');
    expect(packet).not.toContain('password:');
    expect(submission).toContain('https://cardforges.com/mcp');
    expect(submission).toContain('https://cardforges.com/contact?kind=support');
    expect(submission).toContain('https://cardforges.com/privacy');
    expect(submission).toContain('https://cardforges.com/terms');
    expect(submission).toContain('There is no review-only authentication bypass.');
    expect(submission).toContain('Requested availability: public, wherever ChatGPT plugins');
    expect(submission).toContain('Historical hardening release notes for 1.0.2');
    expect(submission).toContain('Requested availability: public,');
    expect(submission).not.toContain('Requested availability: public beta');
    expect(submission).not.toContain('authenticated beta');
    expect(submission).toContain('ordinary Free account scope with no contributor, owner, billing, or provider-console privileges');
    expect(submission).toContain('REVIEW_CASES.json');
    expect(submission).toContain('Not run');
    expect(submission).not.toMatch(/password\s*[:=]\s*\S+/i);
    expect(envExample).toContain('OPENAI_APPS_CHALLENGE_TOKEN=');
    expect(operations).toContain('plugins/cardforge-studio/SUBMISSION.md');
  });
});