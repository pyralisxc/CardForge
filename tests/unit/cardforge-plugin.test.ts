import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

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
      mcpServers: './.mcp.json',
      skills: './skills/',
    });
    expect(mcp.mcpServers['cardforge-studio']).toEqual({
      type: 'http',
      url: 'https://cardforges.com/mcp',
    });
  });

  it('keeps publishing out of the chat tool surface', () => {
    const route = readFileSync(resolve(process.cwd(), 'src/app/mcp/route.ts'), 'utf8');

    expect(route).toContain("'create_editable_template'");
    expect(route).toContain("'continue_template_in_pipeline'");
    expect(route).not.toContain("'publish_template'");
    expect(route).toContain("getDeveloperCockpitAccessForUserId");
    expect(route).toContain("acceptsToken: 'oauth_token'");
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
    expect(handoff).toContain('inFlightDocumentIdRef');
    expect(handoff).toContain('handledDocumentIdRef.current = documentId');
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
