import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const f = vi.hoisted(() => ({ access: vi.fn(), get: vi.fn(), create: vi.fn(), capability: vi.fn() }));
vi.mock('@/features/studio-documents/server/mcpStudioAccess', () => ({ getMcpStudioAccess: f.access, getMcpStudioReadAccess: f.access }));
vi.mock('@/features/account/server', async (original) => ({ ...await original<object>(), requireAccountToolCapability: f.capability }));
vi.mock('@/features/studio-documents/server/studioDocumentStore', async (original) => ({ ...await original<object>(), getStudioDocument: f.get, createStudioOutputIntent: f.create }));
vi.mock('@/features/mcp-usage/server', async (original) => ({ ...await original<object>(), observeMcpToolExecution: ({ execute }: { execute: () => unknown }) => execute() }));
import { cardForgeMcpHandler } from '@/features/studio-documents/server/mcpServer';
const id = 'a2393740-a748-42cc-a942-1aa7c16641db';
const intent = { documentId: id, revision: 2, setId: 'set', cardIds: ['b','a'], paper: 'A4 (210×297 mm)', marginMm: 7, spacingMm: 2, cutLines: true, duplex: 'same-page', mode: 'physical', quality: 150 };
const raw = { cardSets: [{ id: 'set' }], storedCards: [{ uniqueId: 'a', setId: 'set', templateId: 'front', data: {} }, { uniqueId: 'b', setId: 'set', templateId: 'front', data: {}, backingTemplateId: 'back', backingData: {} }], userTemplates: [{ id: 'front' }, { id: 'back', templateUsage: 'back-preset' }] };
const read = async (response: Response) => { const text = await response.text(); return JSON.parse(response.headers.get('content-type')?.includes('text/event-stream') ? text.split('\n').find((line) => line.startsWith('data: '))!.slice(6) : text); };
const request = (id: number, method: string, params: object = {}) => cardForgeMcpHandler(new Request('https://cardforge.test/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) }));
beforeEach(() => { vi.clearAllMocks(); f.access.mockResolvedValue({ user: { id: 'account' }, entitlement: { isSignedIn: true, accountUserId: 'account' } }); f.create.mockResolvedValue('10000000-0000-4000-8000-000000000001'); f.get.mockImplementation(async (_owner, _id, _retention, check) => { check(raw); return { revision: 2 }; }); });
it('prepares exact ordered sheet intent through the actual MCP call without generating a file', async () => {
  const result = await read(await request(1, 'tools/call', { name: 'prepare_output_handoff', arguments: intent }));
  expect(result.result.isError).not.toBe(true); const receipt = result.result.structuredContent;
  expect(receipt).toMatchObject({ status: 'prepared', documentId: id, revision: 2, reference: '10000000-0000-4000-8000-000000000001' });
  const url = new URL(receipt.openInStudioUrl); expect(url.searchParams.get('outputRef')).toBe('10000000-0000-4000-8000-000000000001'); expect(url.searchParams.has('outputIntent')).toBe(false); expect(f.create).toHaveBeenCalledWith('account', expect.objectContaining({ ...intent, layout: 'sheet' }));
  expect(f.get).toHaveBeenCalledOnce(); expect(f.capability).toHaveBeenCalledOnce();
});
it('rejects stale revision, invalid raw source and denied access without a prepared link', async () => {
  f.get.mockImplementationOnce(async (_owner, _id, _retention, check) => { check(raw); return { revision: 3 }; });
  expect((await read(await request(1, 'tools/call', { name: 'prepare_output_handoff', arguments: intent }))).result.isError).toBe(true);
  f.get.mockImplementationOnce(async (_owner, _id, _retention, check) => { check({ ...raw, userTemplates: [{ id: 'front' }] }); return { revision: 2 }; });
  expect((await read(await request(2, 'tools/call', { name: 'prepare_output_handoff', arguments: intent }))).result.isError).toBe(true);
  f.access.mockRejectedValueOnce(new Error('not permitted'));
  expect((await read(await request(3, 'tools/call', { name: 'prepare_output_handoff', arguments: intent }))).result.isError).toBe(true);
  expect(f.get).toHaveBeenCalledTimes(2);
});
it('accepts a complete 10,000-card body and returns only a short reference', async () => {
  const cardIds = Array.from({ length: 10000 }, (_, index) => `card-${String(index).padStart(5, '0')}`);
  const largeRaw = { cardSets: [{ id: 'set' }], userTemplates: [{ id: 'front' }], storedCards: cardIds.map((uniqueId) => ({ uniqueId, setId: 'set', templateId: 'front', data: {} })) };
  f.get.mockImplementationOnce(async (_owner, _id, _retention, check) => { check(largeRaw); return { revision: 2 }; });
  const response = await read(await request(4, 'tools/call', { name: 'prepare_output_handoff', arguments: { ...intent, cardIds } }));
  expect(response.result.isError).not.toBe(true);
  expect(response.result.structuredContent.openInStudioUrl.length).toBeLessThan(250);
  expect(f.create.mock.calls[0][1].cardIds).toEqual(cardIds);
});
