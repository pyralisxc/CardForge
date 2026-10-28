import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ read: vi.fn(), change: vi.fn(), invalidate: vi.fn() }));
vi.mock('@/features/pipeline/server', () => ({ readCatalogTrash: mocks.read, changeCatalogTrash: mocks.change, revalidateCardForgeCatalog: mocks.invalidate }));
vi.mock('@/features/mcp-usage/server', () => ({ observeMcpToolExecution: ({ execute }: { execute: () => unknown }) => execute() }));
import { registerCatalogTrashTools } from '@/features/studio-documents/server/mcpCatalogTrashTools';
type Options = Parameters<typeof registerCatalogTrashTools>[0];
const callbacks = new Map<string, (input: unknown) => Promise<unknown>>();
const schemas = new Map<string, unknown>();
const getAccess = vi.fn();
const toolError = vi.fn((error: unknown) => ({ isError: true, content: [{ type: 'text' as const, text: String(error) }] }));
beforeEach(() => {
  vi.clearAllMocks(); callbacks.clear(); schemas.clear(); getAccess.mockResolvedValue({ user: { id: 'oauth-owner' } });
  const server = { registerTool: (name: string, schema: {outputSchema:unknown}, callback: (input: unknown) => Promise<unknown>) => { schemas.set(name,schema.outputSchema); callbacks.set(name, callback); } };
  registerCatalogTrashTools({ server: server as unknown as Options['server'], getAccess, toolError, publicOrigin: 'http://localhost' });
});
describe('Studio MCP catalog recovery parity', () => {
  it('uses the authenticated OAuth identity and the same canonical read/command', async () => {
    const receipt = { name: 'Native', state: { held: true } }; mocks.change.mockResolvedValue(receipt); mocks.read.mockResolvedValue(receipt);
    await callbacks.get('get_catalog_trash')!({ submissionId: 'exact' });
    expect(mocks.read).toHaveBeenCalledWith('oauth-owner', 'exact');
    const command = { action: 'hold', expected: { identity: { submissionId: 'exact' } }, held: true };
    const result = await callbacks.get('change_catalog_trash')!(command);
    expect(mocks.change).toHaveBeenCalledWith('oauth-owner', command);
    expect(result).toMatchObject({ structuredContent: receipt });
    expect(mocks.invalidate).toHaveBeenCalledOnce();
  });
  it('preserves native failures and does not retry or call cleanup', async () => {
    const failure = new Error('catalog_trash_already_claimed'); mocks.change.mockRejectedValue(failure);
    expect(await callbacks.get('change_catalog_trash')!({ action: 'restore' })).toMatchObject({ isError: true });
    expect(toolError).toHaveBeenCalledWith(failure); expect(mocks.change).toHaveBeenCalledOnce();
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });
});

it('accepts full native diagnostics in both strict MCP output schemas', async () => {
  const receipt = {name:'Synthetic',state:{},retentionDays:30,reasons:[],entryReasons:['json_consumer_inventory_unverified'],
    inventoryDetails:[{origin:'registry',recordId:'opaque-set',payloadKind:'set',conditions:['set_package_not_natively_decoded']}]};
  for (const schema of schemas.values()) {
    const result = await (schema as {'~standard':{validate:(value:unknown)=>PromiseLike<{issues?:unknown[]}>}})['~standard'].validate(receipt);
    expect(result).not.toHaveProperty('issues');
  }
});
