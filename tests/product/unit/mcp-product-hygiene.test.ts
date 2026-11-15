import type { createMcpHandler } from 'mcp-handler';
import { describe, expect, it, vi } from 'vitest';

import { createStableAgentCardId } from '@/features/studio-documents/server/cardSetWorkingDocuments';

type Registration = Parameters<typeof createMcpHandler>[0];
type ToolDefinition = {
  outputSchema?: unknown;
  annotations?: { destructiveHint?: boolean; openWorldHint?: boolean };
};

const transport = vi.hoisted(() => ({ register: undefined as Registration | undefined }));
vi.mock('server-only', () => ({}));
vi.mock('mcp-handler', async importOriginal => ({
  ...await importOriginal<typeof import('mcp-handler')>(),
  createMcpHandler: (register: Registration) => {
    transport.register = register;
    return vi.fn();
  },
  }));

describe('CardForge MCP contract', () => {
  it('registers the published actions and structured contracts through the server owner', async () => {
    await import('@/features/studio-documents/server/mcpServer');
    const register = transport.register;
    if (!register) throw new Error('The MCP transport did not receive its server registration.');

    const tools = new Map<string, ToolDefinition>();
    await register({
      registerTool: (name: string, definition: ToolDefinition) => {
        expect(tools.has(name), name).toBe(false);
        tools.set(name, definition);
      },
      registerResource: vi.fn(),
      server: { setRequestHandler: vi.fn() },
    } as unknown as Parameters<Registration>[0]);

    const coreActions = [
      'attach_template_artwork',
      'attach_template_artworks',
      'checkout_project',
      'commit_project',
      'continue_template_in_pipeline',
      'create_editable_template',
      'delete_card_set',
      'delete_cards',
      'get_agent_install_status',
      'get_card_generation_contract',
      'get_cardforge_capabilities',
      'get_editable_template',
      'get_studio_creation_guide',
      'get_working_document_operation_status',
      'list_agent_working_documents',
      'list_connected_projects',
      'list_editable_templates',
      'move_cards',
      'patch_cards',
      'patch_working_document',
      'preview_card_set',
      'preview_cards',
      'preview_template_draft',
      'search_personal_library',
      'search_studio_library',
      'update_editable_template',
      'upsert_card',
      'upsert_card_set',
      'upsert_cards',
      'validate_working_document',
    ];
    const structuredActions = [
      ...coreActions,
      'list_pipeline_submissions', 'get_pipeline_revision', 'get_pipeline_content_health',
      'get_pipeline_engagement', 'vote_pipeline_revision', 'set_pipeline_heart',
      'discover_pipeline_previews', 'inspect_saved_source', 'preview_saved_source', 'export_saved_source',
    ];
    expect([...tools.keys()]).toEqual(expect.arrayContaining(structuredActions));
    for (const name of structuredActions) expect(tools.get(name)?.outputSchema, name).toBeDefined();

    const destructiveActions = new Set([
      'attach_template_artwork', 'attach_template_artworks', 'commit_project',
      'delete_card_set', 'delete_cards', 'move_cards', 'patch_cards',
      'patch_working_document', 'update_editable_template', 'upsert_card',
      'upsert_card_set', 'upsert_cards',
    ]);
    const openWorldActions = new Set([
      'attach_template_artworks', 'patch_working_document', 'upsert_card', 'upsert_cards',
    ]);
    for (const name of coreActions) {
      expect(tools.get(name)?.annotations, name).toMatchObject({
        destructiveHint: destructiveActions.has(name),
        openWorldHint: openWorldActions.has(name),
      });
    }
  });

  it('rejects anonymous requests at the MCP transport boundary', async () => {
    const { POST } = await import('@/app/mcp/route');
    const response = await POST(new Request('https://cardforge.test/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    }));
    expect(response.status).toBe(401);
  });

  it('derives stable fallback card ids independent of object key order', () => {
    const left = createStableAgentCardId('set-1', {
      data: { card_name: 'ROCK', rules_text: 'Crushes scissors.' },
    }, 0);
    const right = createStableAgentCardId('set-1', {
      data: { rules_text: 'Crushes scissors.', card_name: 'ROCK' },
    }, 0);
    const secondCopy = createStableAgentCardId('set-1', {
      data: { card_name: 'ROCK', rules_text: 'Crushes scissors.' },
    }, 1);

    expect(left).toBe(right);
    expect(secondCopy).not.toBe(left);
  });
});
