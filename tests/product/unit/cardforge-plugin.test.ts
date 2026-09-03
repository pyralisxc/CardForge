import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { DEFAULT_LEGAL_DOCUMENTS } from '@/features/legal/client';
import { getCardForgePluginSkillCatalog } from '@/features/studio-documents/server/mcpPluginSkills';

describe('CardForge Studio plugin', () => {
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
      version: '1.0.1',
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

  it('keeps a reviewer-ready submission source without committing credentials', () => {
    const submission = readFileSync(
      resolve(process.cwd(), 'plugins/cardforge-studio/SUBMISSION.md'),
      'utf8',
    );
    const envExample = readFileSync(resolve(process.cwd(), '.env.example'), 'utf8');
    const operations = readFileSync(resolve(process.cwd(), 'docs/operations.md'), 'utf8');

    const positiveCases = submission.match(/^### Positive \d+[\s\S]*?(?=^### Positive \d+|^## Negative)/gm) ?? [];
    const negativeCases = submission.match(/^### Negative \d+[\s\S]*?(?=^### Negative \d+|^## Domain)/gm) ?? [];
    expect(positiveCases).toHaveLength(7);
    expect(negativeCases).toHaveLength(3);
    for (const reviewCase of positiveCases) expect(reviewCase).toContain('- Fixture:');
    for (const reviewCase of negativeCases) expect(reviewCase).toContain('- Why it should not complete:');
    expect(submission).toContain('https://cardforges.com/mcp');
    expect(submission).toContain('https://cardforges.com/contact?kind=support');
    expect(submission).toContain('https://cardforges.com/privacy');
    expect(submission).toContain('https://cardforges.com/terms');
    expect(submission).toContain('There is no review-only authentication bypass.');
    expect(submission).toContain('globally wherever ChatGPT plugins');
    expect(submission).toContain('Hardening release notes for 1.0.1');
    expect(submission).toContain('ordinary Free account scope with no contributor, owner, billing, or provider-console privileges');
    expect(submission).toContain('temporary working Set named OpenAI Review Fixture');
    expect(submission).toContain('temporary assistant drafts are created by the review cases');
    expect(submission).not.toMatch(/password\s*[:=]\s*\S+/i);
    expect(envExample).toContain('OPENAI_APPS_CHALLENGE_TOKEN=');
    expect(operations).toContain('plugins/cardforge-studio/SUBMISSION.md');
  });
});
