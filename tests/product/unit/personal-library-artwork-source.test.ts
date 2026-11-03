import { writeFileSync } from 'node:fs';
import { replaceStudioDocumentAssetReferences } from '@/features/studio-documents/assetReferences';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { TCGCardTemplate } from '@/domain/templates';
import type { ProjectDocumentV1 } from '@/features/project/server';
vi.mock('server-only', () => ({}));
const f = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), access: vi.fn(), from: vi.fn(), upload: vi.fn(), remove: vi.fn(), provider: vi.fn() }));
vi.mock('@/features/studio-documents/server/studioDocumentStore', () => ({ getStudioDocument: f.get, updateStudioDocument: f.update }));
vi.mock('@/features/studio-documents/server/studioDocumentAccess', () => ({ getStudioDocumentRetentionHours: async () => 24 }));
vi.mock('@/features/studio-documents/server/mcpStudioAccess', () => ({ getMcpStudioAccess: f.access, getMcpStudioReadAccess: f.access }));
vi.mock('@/features/mcp-usage/server', async original => ({ ...await original<object>(), observeMcpToolExecution: ({ execute }: { execute: () => unknown }) => execute() }));
vi.mock('@/features/project/server/googleDriveConnectionAuthority', () => ({ resolveGoogleDriveConnectionAccess: async () => ({ ok: true, accessToken: 'synthetic-private-access' }) }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: () => ({ from: f.from, storage: { from: () => ({ list: async () => ({ data: [], error: null }), upload: f.upload, remove: f.remove }) } }) }));
import { patchWorkingDocument, getWorkingDocumentOperationStatus } from '@/features/studio-documents/server/workingDocumentPatches';
import { externalizeStudioDocumentAssets } from '@/features/studio-documents/server/studioDocumentAssetStore';
import { StudioDocumentStoreError } from '@/features/studio-documents/server/StudioDocumentStoreError';
import { cardForgeMcpHandler } from '@/features/studio-documents/server/mcpServer';
import { PERSONAL_LIBRARY_ARTWORK_AUTHORIZATION } from '@/features/personal-library/model';
import { createMcpArtworkOperationBudget, normalizeMcpArtworkSource, MAX_MCP_ARTWORK_BYTES_PER_OPERATION } from '@/features/studio-documents/server/mcpArtworkSources';
import { MAX_EMBEDDED_TEMPLATE_ASSET_BYTES } from '@/features/studio-documents/server/embeddedTemplateAssets';
const makeTemplate = (): TCGCardTemplate => ({
  id: 'template-1',
  name: 'Template One',
  aspectRatio: '63:88',
  formatId: 'poker',
  trimWidthMm: 63,
  trimHeightMm: 88,
  templateSource: 'user',
  fieldContracts: [
    { key: 'name', elementId: 'name', type: 'text', required: true },
    { key: 'rules', elementId: 'rules', type: 'text', required: false },
  ],
  freeformCanvas: {
    width: 630,
    height: 880,
    elements: [
      { id: 'frame', type: 'shape', name: 'Frame', x: 0, y: 0, width: 630, height: 880, zIndex: 10 },
      { id: 'name', type: 'text', name: 'Name', x: 40, y: 40, width: 400, height: 50, zIndex: 20, content: '{{name:"Name"}}' },
      { id: 'rules', type: 'text', name: 'Rules', x: 40, y: 600, width: 400, height: 140, zIndex: 20, content: '{{rules:"Rules"}}' },
      { id: 'art-1', type: 'image', name: 'Art One', x: 60, y: 130, width: 200, height: 250, zIndex: 5 },
      { id: 'art-2', type: 'image', name: 'Art Two', x: 300, y: 130, width: 200, height: 250, zIndex: 5 },
    ],
  },
});

const makeCurrent = (revision = 60) => ({
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Efficiency Test',
  creationSource: 'gpt' as const,
  revision,
  createdAt: '2026-08-23T00:00:00.000Z',
  updatedAt: '2026-08-23T00:00:00.000Z',
  document: {
    version: 1 as const,
    userTemplates: [makeTemplate()],
    cardSets: [{ id: 'set-1', name: 'Set One' }],
    activeCardSetId: 'set-1',
    storedCards: [{
      uniqueId: 'card-1',
      templateId: 'template-1',
      backingTemplateId: null,
      setId: 'set-1',
      setName: 'Set One',
      data: { name: 'Card One', rules: 'Old rules', rarity_or_variant_marker: 'legacy' },
    }],
    appearanceStyles: [],
    exportSettings: {},
    customAssets: {
      'cardforge-maker-custom-textures': [],
      'cardforge-maker-custom-dividers': [],
      'cardforge-maker-custom-icons': [],
      'cardforge-maker-custom-images': [],
    },
    productionPlan: {
      version: 1 as const,
      decisionMode: 'confirmed' as const,
      purpose: 'Test',
      deliverable: 'Cards',
      outputSize: { width: 63, height: 88, unit: 'mm' as const },
      visualDirection: { summary: 'Test', palette: [], typography: [] },
      editableFieldKeys: ['name', 'rules'],
      assets: [
        {
          id: 'asset-1', name: 'Art One', kind: 'image' as const, role: 'artwork',
          source: 'custom-generated' as const, quantity: 1, status: 'needed' as const,
          binding: 'element.image' as const, targetElementIds: ['art-1'],
        },
        {
          id: 'asset-2', name: 'Art Two', kind: 'image' as const, role: 'artwork',
          source: 'custom-generated' as const, quantity: 1, status: 'needed' as const,
          binding: 'element.image' as const, targetElementIds: ['art-2'],
        },
      ],
    },
  },
});


const itemId = '10000000-0000-4000-8000-000000000001';
const access = { user: { id: 'oauth-user' }, entitlement: { isSignedIn: true, accountUserId: 'linked-account' }, capabilities: ['studio.ai.create'] } as unknown as Parameters<typeof patchWorkingDocument>[0]['access'];
const source = () => ({ mimeType: 'image/png' as const, personalLibrary: { itemId, expectedProviderRevision: '7', authorization: PERSONAL_LIBRARY_ARTWORK_AUTHORIZATION as typeof PERSONAL_LIBRARY_ARTWORK_AUTHORIZATION } });
const input = () => ({ documentId: current.id, expectedRevision: 60, operationId: 'original-library-copy', templateArtworks: [{ ...source(), templateId: 'template-1', binding: 'element.image' as const, targetElementIds: ['art-1'], requirementId: 'asset-1' }] });
let current = makeCurrent();
let declaredMime: 'image/png' | 'image/jpeg' | 'image/webp' = 'image/png';
let png = Buffer.alloc(0), indexRow: Record<string, unknown> = {}, objects = new Map<string, Buffer>();
let indexWrites = 0, metadataReads = 0, mediaReads = 0, drift = false, wrongIdentity = false, conflict = false, lostCommit = false, lostIndex = false, declaredSize: number | undefined, mediaBytes: Buffer | undefined;
beforeEach(async () => {
 vi.clearAllMocks(); png = await sharp({ create: { width: 20, height: 30, channels: 4, background: '#22c55e' } }).png().toBuffer();
 current = makeCurrent(); declaredMime = 'image/png'; objects = new Map(); indexWrites = metadataReads = mediaReads = 0; drift = wrongIdentity = conflict = lostCommit = lostIndex = false; declaredSize = undefined; mediaBytes = undefined;
 indexRow = { id: itemId, owner_user_id: 'linked-account', provider: 'google-drive', provider_file_id: 'drive_source_1234', provider_revision: '7', provider_resource_key: 'synthetic-resource-key', display_name: 'Private artwork.png', mime_type: 'image/png', asset_role: 'artwork', byte_size: png.length, content_hash: null };
 vi.stubEnv('CARDFORGE_GOOGLE_STORAGE_CLIENT_ID', 'synthetic-client'); vi.stubEnv('CARDFORGE_GOOGLE_STORAGE_CLIENT_SECRET', 'synthetic-secret'); vi.stubGlobal('fetch', f.provider);
 f.access.mockResolvedValue(access);
 f.get.mockImplementation(async (owner: string, id: string) => { if (owner !== 'oauth-user' || id !== current.id) throw new StudioDocumentStoreError('Exact private document unavailable.', 404); return current; });
 f.from.mockImplementation((table: string) => {
  const filters: [string, unknown][] = []; let update: Record<string, unknown> | undefined;
  const q = { select: () => q, eq: (key: string, value: unknown) => { filters.push([key, value]); return q; }, update: (value: Record<string, unknown>) => { update = value; indexWrites++; return q; }, maybeSingle: async () => ({ data: table === 'cardforge_project_storage_connections' ? { id: 'synthetic-connection' } : filters.every(([key, value]) => indexRow[key] === value) ? indexRow : null, error: null }), single: async () => { indexRow = { ...indexRow, ...update }; if (lostIndex) throw new Error('Index acknowledgement lost'); return { data: indexRow, error: null }; } }; return q;
 });
 f.provider.mockImplementation(async (url: URL | string) => {
  if (String(url).includes('alt=media')) { mediaReads++; return new Response(new Uint8Array(mediaBytes ?? png), { headers: { 'Content-Type': declaredMime } }); }
  metadataReads++;
  return Response.json({ id: wrongIdentity ? 'different_source_1234' : 'drive_source_1234', version: drift && metadataReads > 1 ? '8' : '7', name: 'Private artwork.png', mimeType: declaredMime, modifiedTime: '2026-11-02T00:00:00Z', size: String(declaredSize ?? png.length), resourceKey: 'synthetic-resource-key' });
 });
 f.upload.mockImplementation(async (path: string, bytes: Buffer) => { objects.set(path, bytes); return { error: null }; });
 f.update.mockImplementation(async (args: { ownerUserId: string; documentId: string; expectedRevision: number; document: ProjectDocumentV1 }) => {
  const stored = await externalizeStudioDocumentAssets({ ownerUserId: args.ownerUserId, documentId: args.documentId, document: args.document, cleanupOnFailure: false });
  if (conflict || current.revision !== args.expectedRevision) throw new StudioDocumentStoreError('Document CAS rejected.', 409);
  current = { ...current, revision: args.expectedRevision + 1, document: stored.document as typeof current.document };
  if (lostCommit) throw new StudioDocumentStoreError('Document acknowledgement lost.', 503);
  return current;
 });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it('uses observed Drive version, real normalization/private storage and exact authored targets; original and stored hashes differ', async () => {
 const result = await patchWorkingDocument({ access, input: input() });
 expect(result.committedRevision).toBe(61); expect(indexWrites).toBe(1); expect(metadataReads).toBe(2); expect(mediaReads).toBe(1); expect(f.update).toHaveBeenCalledOnce();
 const [path, stored] = [...objects][0]; const originalHash = createHash('sha256').update(png).digest('hex'), storedHash = createHash('sha256').update(stored).digest('hex');
 expect(storedHash).not.toBe(originalHash); expect(path).toBe(`oauth-user/${current.id}/${storedHash}.webp`);
 expect(await sharp(stored).metadata()).toMatchObject({ format: 'webp', width: 20, height: 30 });
 const art = current.document.userTemplates[0].freeformCanvas!.elements.find(e => e.id === 'art-1')!;
 expect(art.imageSource).toBe(`cardforge-studio-asset://${storedHash}`); expect(current.document.storedCards[0].data.name).toBe('Card One');
 expect(result.warnings.join(' ')).toContain(`original provider-byte SHA-256 ${originalHash}`); expect(result.warnings.join(' ')).toContain(`normalized stored-image SHA-256 ${storedHash}`);
 expect(indexRow.content_hash).toBe(originalHash); expect(f.remove).not.toHaveBeenCalled();
});
it('matching retained receipt returns before provider, index and private upload; changed source pins conflict before effects', async () => {
 const request = input(); await patchWorkingDocument({ access, input: request });
 f.provider.mockClear(); f.upload.mockClear(); f.from.mockClear(); f.update.mockClear();
 expect(await patchWorkingDocument({ access, input: request })).toMatchObject({ replayed: true, committedRevision: 61 });
 expect(f.provider).not.toHaveBeenCalled(); expect(f.from).not.toHaveBeenCalled(); expect(f.upload).not.toHaveBeenCalled(); expect(f.update).not.toHaveBeenCalled();
 const changed = structuredClone(request); changed.templateArtworks[0].personalLibrary.expectedProviderRevision = '8';
 await expect(patchWorkingDocument({ access, input: changed })).rejects.toMatchObject({ status: 409 }); expect(f.from).not.toHaveBeenCalled();
});
it('preflights capability, exact document/revision, targets, requirements and copy authorization before source work', async () => {
 const invalid = [ { ...input(), expectedRevision: 59 }, { ...input(), documentId: 'different-document' }, { ...input(), templateArtworks: [{ ...input().templateArtworks[0], targetElementIds: ['name'] }] }, { ...input(), templateArtworks: [{ ...input().templateArtworks[0], requirementId: 'missing' }] } ];
 for (const request of invalid) await expect(patchWorkingDocument({ access, input: request })).rejects.toBeDefined();
 await expect(patchWorkingDocument({ access: { ...access, capabilities: [] }, input: input() })).rejects.toMatchObject({ status: 403 });
 await expect(patchWorkingDocument({ access: { ...access, entitlement: { ...access.entitlement, accountUserId: null } }, input: input() })).rejects.toMatchObject({ status: 401 });
 const unauthorized = input(); unauthorized.templateArtworks[0].personalLibrary.authorization = 'Not authorized' as typeof PERSONAL_LIBRARY_ARTWORK_AUTHORIZATION;
 await expect(patchWorkingDocument({ access, input: unauthorized })).rejects.toMatchObject({ status: 400 });
 expect(f.provider).not.toHaveBeenCalled(); expect(f.from).not.toHaveBeenCalled(); expect(f.upload).not.toHaveBeenCalled();
});
it('requires indexed observed pin, exact linked account and provider identity; no latest or guessed version substitution', async () => {
 for (const change of [{ provider_revision: '6' }, { owner_user_id: 'other' }]) { const original = { ...indexRow }; indexRow = { ...indexRow, ...change }; await expect(patchWorkingDocument({ access, input: input() })).rejects.toBeDefined(); indexRow = original; }
 expect(f.provider).not.toHaveBeenCalled(); wrongIdentity = true;
 await expect(patchWorkingDocument({ access, input: input() })).rejects.toMatchObject({ status: 409, retryable: false }); expect(mediaReads).toBe(0); expect(indexWrites).toBe(0);
});
it('source drift refuses attachment/index write and reports attempted provider work without replay', async () => {
 drift = true; await expect(patchWorkingDocument({ access, input: input() })).rejects.toMatchObject({ status: 409, retryable: false, message: expect.stringContaining('Private-source work was attempted') });
 expect(mediaReads).toBe(1); expect(indexWrites).toBe(0); expect(f.upload).not.toHaveBeenCalled(); expect(f.update).not.toHaveBeenCalled();
});
it('enforces 2.4MB metadata/stream and 32MB incoming aggregate budgets without normalizing oversized bytes', async () => {
 declaredSize = MAX_EMBEDDED_TEMPLATE_ASSET_BYTES + 1; await expect(patchWorkingDocument({ access, input: input() })).rejects.toMatchObject({ status: 413 }); expect(mediaReads).toBe(0);
 declaredSize = undefined; mediaBytes = Buffer.alloc(MAX_EMBEDDED_TEMPLATE_ASSET_BYTES + 1); await expect(patchWorkingDocument({ access, input: input() })).rejects.toMatchObject({ status: 413 }); expect(indexWrites).toBe(0);
 mediaBytes = undefined; const budget = createMcpArtworkOperationBudget([source()]); budget.consumeRemoteBytes(MAX_MCP_ARTWORK_BYTES_PER_OPERATION - 1);
 await expect(normalizeMcpArtworkSource(source(), budget, access)).rejects.toMatchObject({ status: 413 }); expect(indexWrites).toBe(0); expect(f.upload).not.toHaveBeenCalled();
});
it('known index refresh and retained upload survive rejected document CAS; unknown index acknowledgement is not called committed', async () => {
 conflict = true; await expect(patchWorkingDocument({ access, input: input() })).rejects.toMatchObject({ status: 409, retryable: false, message: expect.stringContaining('1 index refresh(es) were acknowledged') });
 expect(current.revision).toBe(60); expect(objects.size).toBe(1); expect(f.remove).not.toHaveBeenCalled();
 conflict = false; lostIndex = true; await expect(patchWorkingDocument({ access, input: input() })).rejects.toMatchObject({ retryable: false, message: expect.stringContaining('0 index refresh(es) were acknowledged') });
 expect(current.revision).toBe(60); expect(f.remove).not.toHaveBeenCalled();
});
it('lost document ACK uses existing exact operation readback, no automatic rematerialization', async () => {
 lostCommit = true; await expect(patchWorkingDocument({ access, input: input() })).rejects.toMatchObject({ status: 503, retryable: false });
 const count = f.provider.mock.calls.length; const result = await getWorkingDocumentOperationStatus({ access, documentId: current.id, operationId: input().operationId });
 expect(result).toMatchObject({ status: 'committed', receipt: { revision: 61 } }); expect(f.provider).toHaveBeenCalledTimes(count); expect(f.remove).not.toHaveBeenCalled();
});
const http = async (id: number, method: string, params: object) => { const response = await cardForgeMcpHandler(new Request('https://cardforge.test/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) })); const text = await response.text(); return JSON.parse(text.startsWith('event:') ? text.split('\n').find(line => line.startsWith('data: '))!.slice(6) : text); };
it('initialized actual HTTP exposes the source alternative on existing tools and executes without private bytes/credentials in receipt', async () => {
 expect((await http(1, 'initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '1' } })).result.serverInfo.version).toBe('1.0.16');
 const tools = (await http(2, 'tools/list', {})).result.tools; expect(tools).toHaveLength(58);
 const attach = tools.find((t: { name: string }) => t.name === 'attach_template_artworks'); expect(attach.inputSchema.properties.artworks.items.properties.personalLibrary.additionalProperties).toBe(false);
 const request = input(); const result = (await http(3, 'tools/call', { name: 'attach_template_artworks', arguments: { documentId: request.documentId, expectedRevision: 60, operationId: request.operationId, artworks: request.templateArtworks } })).result;
 expect(result.isError, JSON.stringify(result)).not.toBe(true); expect(result.structuredContent.revision).toBe(61); expect(JSON.stringify(result)).not.toMatch(/synthetic-private-access|synthetic-resource-key|data:image|drive_source_1234/);
});
it('actual HTTP rejects conflicting sources, missing copy authorization and 65-item batch before provider work', async () => {
 const request = input();
 for (const artworks of [[{ ...request.templateArtworks[0], data: 'AAAA' }], [{ ...request.templateArtworks[0], personalLibrary: { itemId, expectedProviderRevision: '7' } }], Array.from({ length: 65 }, () => request.templateArtworks[0])]) {
  expect((await http(1, 'tools/call', { name: 'attach_template_artworks', arguments: { documentId: request.documentId, expectedRevision: 60, artworks } })).result.isError).toBe(true);
 }
 expect(f.provider).not.toHaveBeenCalled(); expect(f.from).not.toHaveBeenCalled();
});

it('corrupt source normalization discloses acknowledged index refresh but performs no private upload or document change', async () => {
 mediaBytes = Buffer.alloc(png.length);
 await expect(patchWorkingDocument({ access, input: input() })).rejects.toMatchObject({ status: 400, retryable: false, message: expect.stringContaining('1 index refresh(es) were acknowledged') });
 expect(indexWrites).toBe(1); expect(f.upload).not.toHaveBeenCalled(); expect(f.update).not.toHaveBeenCalled(); expect(current.revision).toBe(60);
});
it('actual patch HTTP lost acknowledgement is explicitly nonretryable and reconciles through the existing operation tool', async () => {
 lostCommit = true;
 const response = (await http(1, 'tools/call', { name: 'patch_working_document', arguments: input() })).result;
 expect(response.isError).toBe(true); expect(response._meta['cardforge/boundaryFailure']).toMatchObject({ status: 503, retryable: false });
 const count = f.provider.mock.calls.length;
 const read = (await http(2, 'tools/call', { name: 'get_working_document_operation_status', arguments: { documentId: current.id, operationId: input().operationId } })).result;
 expect(read.structuredContent).toMatchObject({ status: 'committed', receipt: { revision: 61 } }); expect(f.provider).toHaveBeenCalledTimes(count);
});

it('a newer current revision cannot be substituted for the original receipt image digest', async () => {
 const request = input(); await patchWorkingDocument({ access, input: request }); current = { ...current, revision: 62 };
 f.provider.mockClear(); f.upload.mockClear(); f.from.mockClear();
 const result = await patchWorkingDocument({ access, input: request });
 expect(result).toMatchObject({ replayed: true, committedRevision: 61 }); expect(result.warnings.join(' ')).toContain('normalized stored-image SHA-256 unavailable at the currently observed revision');
 expect(f.provider).not.toHaveBeenCalled(); expect(f.from).not.toHaveBeenCalled(); expect(f.upload).not.toHaveBeenCalled();
});

it('local canonical browser handoff for synthetic PNG JPEG WebP personal-source bindings', async () => {
 const packets = [];
 for (const mime of ['image/png', 'image/jpeg', 'image/webp'] as const) {
  current = makeCurrent(); objects = new Map(); metadataReads = 0; declaredMime = mime;
  const original = sharp({ create: { width: 20, height: 30, channels: 4, background: '#22c55e' } });
  png = await (mime === 'image/png' ? original.png() : mime === 'image/jpeg' ? original.jpeg({ quality: 100, chromaSubsampling: '4:4:4' }) : original.webp({ lossless: true })).toBuffer();
  indexRow = { ...indexRow, mime_type: mime, byte_size: png.length };
  current.document.userTemplates[0].freeformCanvas!.elements = current.document.userTemplates[0].freeformCanvas!.elements.map(element => element.id === 'art-1' ? { ...element, zIndex: 30 } : element);
  const beforeTemplate = structuredClone(current.document.userTemplates[0]);
  const request = input();
  const result = await patchWorkingDocument({ access, input: { ...request, templateArtworks: [{ ...request.templateArtworks[0], mimeType: mime }] } });
  expect(result.committedRevision).toBe(61);
  const assets = new Map([...objects].map(([path, bytes]) => [path.split('/').pop()!.slice(0, -5), `data:image/webp;base64,${bytes.toString('base64')}`]));
  const template = replaceStudioDocumentAssetReferences(current.document.userTemplates[0], assets);
  packets.push({ format: mime.split('/')[1], originalSha256: createHash('sha256').update(png).digest('hex'), storedAssetSha256: [...assets.keys()][0], committedRevision: result.committedRevision, beforeTemplate, template });
 }
 if (process.env.CARDFORGE_PERSONAL_RENDER_PROOF) writeFileSync(process.env.CARDFORGE_PERSONAL_RENDER_PROOF, JSON.stringify(packets));
 expect(packets).toHaveLength(3);
});
