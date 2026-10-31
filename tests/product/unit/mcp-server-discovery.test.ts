import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { cardForgeMcpHandler } from '@/features/studio-documents/server/mcpServer';
import { CARDFORGE_MCP_CONTRACT_VERSION } from '@/features/studio-documents/server/mcpContractVersion';

describe('Studio MCP HTTP discovery', () => {
  it('initializes the real server and exposes registered tool schemas without executing tools', async () => {
    const readMessage = async (response: Response) => {
      const text = await response.text();
      return JSON.parse(response.headers.get('content-type')?.includes('text/event-stream')
        ? text.split('\n').find((line) => line.startsWith('data: '))!.slice(6)
        : text);
    };
    const request = (id: number, method: string, params: object = {}) => cardForgeMcpHandler(new Request('https://cardforge.test/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
    }));
    const initialized = await request(1, 'initialize', {
      protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'discovery-contract', version: '1.0.0' },
    });
    expect(initialized.status).toBe(200);
    const initialization = await readMessage(initialized);
    expect(initialization.result.serverInfo).toEqual({ name: 'cardforge-studio', version: CARDFORGE_MCP_CONTRACT_VERSION });
    const listed = await request(2, 'tools/list');
    expect(listed.status).toBe(200);
    const result = await readMessage(listed);
    expect(result.error).toBeUndefined();
    type ObjectSchema = { type: string; properties: Record<string, unknown>; required?: string[] };
    const tools = result.result.tools as Array<{ name: string; inputSchema: ObjectSchema; outputSchema?: ObjectSchema }>;
    expect(tools.map((tool) => tool.name)).toEqual(expect.arrayContaining([
      'get_pipeline_revision_deletion', 'delete_pipeline_revision_now',
      'get_pipeline_revision_recovery', 'change_pipeline_revision_recovery',
      'discover_pipeline_previews', 'inspect_saved_source', 'preview_saved_source', 'export_saved_source',
    ]));
    expect(tools).toHaveLength(40);
    expect(tools.map((tool) => tool.name).sort()).toMatchInlineSnapshot(`
      [
        "attach_template_artwork",
        "attach_template_artworks",
        "change_catalog_trash",
        "change_pipeline_revision_recovery",
        "checkout_project",
        "commit_project",
        "continue_template_in_pipeline",
        "create_editable_template",
        "delete_card_set",
        "delete_cards",
        "delete_pipeline_revision_now",
        "discover_pipeline_previews",
        "export_saved_source",
        "get_agent_install_status",
        "get_card_generation_contract",
        "get_cardforge_capabilities",
        "get_catalog_trash",
        "get_editable_template",
        "get_pipeline_revision_deletion",
        "get_pipeline_revision_recovery",
        "get_studio_creation_guide",
        "get_working_document_operation_status",
        "inspect_saved_source",
        "list_agent_working_documents",
        "list_connected_projects",
        "list_editable_templates",
        "move_cards",
        "patch_cards",
        "patch_working_document",
        "preview_card_set",
        "preview_cards",
        "preview_saved_source",
        "preview_template_draft",
        "search_personal_library",
        "search_studio_library",
        "update_editable_template",
        "upsert_card",
        "upsert_card_set",
        "upsert_cards",
        "validate_working_document",
      ]
    `);
    expect(new Set(tools.map((tool) => tool.name)).size).toBe(tools.length);
    for (const tool of tools) {
      expect(tool.inputSchema.type, tool.name).toBe('object');
      expect(tool.inputSchema.properties, tool.name).toBeDefined();
      for (const schema of [tool.inputSchema, tool.outputSchema].filter((value): value is ObjectSchema => Boolean(value))) {
        expect(schema.type, tool.name).toBe('object');
        expect((schema.required ?? []).filter(key => !(key in schema.properties)), tool.name).toEqual([]);
      }
    }
    const deletion = tools.find((tool) => tool.name === 'delete_pipeline_revision_now')!;
    expect(Object.keys(deletion.inputSchema.properties).sort()).toEqual(['name', 'storagePath', 'submissionId']);
    expect(deletion.inputSchema.required).toEqual(['submissionId', 'name', 'storagePath']);
    expect(deletion.inputSchema.properties.submissionId).toMatchObject({ type: 'string', format: 'uuid' });
    expect(deletion.inputSchema.properties.storagePath).toMatchObject({ type: ['string', 'null'] });
  });
});
