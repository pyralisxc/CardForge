import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

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
      version: '0.9.0',
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

  it('keeps publishing out of the chat tool surface', () => {
    const route = readFileSync(resolve(process.cwd(), 'src/app/mcp/route.ts'), 'utf8');
    const access = readFileSync(resolve(process.cwd(), 'src/app/mcp/mcpStudioAccess.ts'), 'utf8');

    expect(route).toContain("'create_editable_template'");
    expect(route).toContain("'continue_template_in_pipeline'");
    expect(route).not.toContain("'publish_template'");
    expect(access).toContain("getDeveloperCockpitAccessForUserId");
    expect(access).not.toContain('getMcpAllowanceForPlan');
    expect(access).not.toContain('mcpEnabled');
    expect(route).toContain("acceptsToken: 'oauth_token'");
    expect(route).toContain("version: '0.9.0'");
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

  it('declares telemetry-writing tools as non-read-only for publication review', () => {
    const toolSources = [
      'src/app/mcp/route.ts',
      'src/features/studio-documents/server/mcpAccountWorkflowTools.ts',
      'src/features/studio-documents/server/mcpAgentCardTools.ts',
      'src/features/studio-documents/server/mcpAgentTemplateToolsCore.ts',
      'src/features/studio-documents/server/mcpCloudSetTools.ts',
    ].map((path) => readFileSync(resolve(process.cwd(), path), 'utf8')).join('\n');

    expect(toolSources).toContain('observeMcpToolExecution');
    expect(toolSources).not.toContain('readOnlyHint: true');
  });

  it('discloses private assistant documents and aggregate MCP usage', () => {
    const legal = readFileSync(
      resolve(process.cwd(), 'src/features/legal/model/legalDocument.ts'),
      'utf8',
    );

    expect(legal).toContain('private assistant working documents');
    expect(legal).toContain('aggregate MCP usage');
    expect(legal).toContain("'privacy', 'Privacy Policy', privacyBody, '2026-08-21'");
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
    expect(positiveCases).toHaveLength(5);
    expect(negativeCases).toHaveLength(3);
    for (const reviewCase of positiveCases) expect(reviewCase).toContain('- Fixture:');
    for (const reviewCase of negativeCases) expect(reviewCase).toContain('- Why it should not complete:');
    expect(submission).toContain('https://cardforges.com/mcp');
    expect(submission).toContain('https://cardforges.com/contact?kind=support');
    expect(submission).toContain('https://cardforges.com/privacy');
    expect(submission).toContain('https://cardforges.com/terms');
    expect(submission).toContain('There is no review-only authentication bypass.');
    expect(submission).toContain('globally wherever ChatGPT plugins');
    expect(submission).toContain('Initial-submission release notes for 0.9.0');
    expect(submission).toContain('ordinary Free account scope with no developer, owner, billing, or provider-console privileges');
    expect(submission).toContain('cloud-saved set named `OpenAI Review Fixture`');
    expect(submission).toContain('temporary assistant drafts are created by the review cases');
    expect(submission).not.toMatch(/password\s*[:=]\s*\S+/i);
    expect(envExample).toContain('OPENAI_APPS_CHALLENGE_TOKEN=');
    expect(operations).toContain('plugins/cardforge-studio/SUBMISSION.md');
  });

  it('returns direct Studio document links while browser Clerk owns sign-in', () => {
    const route = readFileSync(resolve(process.cwd(), 'src/app/mcp/route.ts'), 'utf8');
    const studioPage = readFileSync(resolve(process.cwd(), 'src/app/studio/page.tsx'), 'utf8');
    const handoff = readFileSync(
      resolve(process.cwd(), 'src/features/studio-documents/hooks/useStudioDocumentHandoff.ts'),
      'utf8',
    );

    expect(route).toContain('const studioDocumentUrl');
    expect(route).toContain('/studio?document=');
    expect(route).not.toContain('/sign-in?redirect_url=');
    expect(route).toContain('openInStudioUrl: studioDocumentUrl(document.id)');
    expect(studioPage).toContain('redirectToSignIn');
    expect(studioPage).toContain('returnBackUrl: `/studio?document=${encodeURIComponent(documentId)}`');
    expect(handoff).not.toContain('signInPromptedDocumentIdRef');
    expect(handoff).not.toContain('Sign in to open this draft');
    expect(handoff).toContain('inFlightRevisionKeyRef');
    expect(handoff).toContain('handledRevisionKeyRef.current = handoffKey');
  });

  it('keeps MCP server dependencies out of the Studio browser surface', () => {
    const studioPage = readFileSync(resolve(process.cwd(), 'src/app/studio/page.tsx'), 'utf8');
    const studioLoader = readFileSync(
      resolve(process.cwd(), 'src/features/app-shell/components/StudioRuntimeLoader.tsx'),
      'utf8',
    );

    expect(studioPage).not.toContain('@modelcontextprotocol');
    expect(studioPage).not.toContain('@clerk/mcp-tools');
    expect(studioPage).not.toContain('mcp-handler');
    expect(studioLoader).not.toContain('@modelcontextprotocol');
    expect(studioLoader).not.toContain('@clerk/mcp-tools');
    expect(studioLoader).not.toContain('mcp-handler');
  });
});
