import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import { createHash } from 'node:crypto';
import { buildPluginArchive } from '../../../scripts/plugin-package-core.mjs';
vi.mock('server-only', () => ({}));
const f = vi.hoisted(() => ({
  account: vi.fn(), oauth: vi.fn(), download: vi.fn(), upload: vi.fn(), insert: vi.fn(), sign: vi.fn(), remove: vi.fn(), build: vi.fn(),
  rows: [] as Record<string, unknown>[], files: new Map<string, Uint8Array>(), queries: [] as unknown[][][],
  override: false, payload: undefined as unknown, queryError: false, ignoreScope: false, configured: true,
}));
vi.mock('@clerk/nextjs/server', () => ({ auth: f.oauth }));
vi.mock('@/features/account/server', async original => ({ ...await original<object>(), getAccountToolAccessForUserId: f.account }));
vi.mock('@/features/mcp-usage/server', async original => ({ ...await original<object>(), observeMcpToolExecution: ({ execute }: { execute: () => unknown }) => execute() }));
vi.mock('@/features/plugin-distribution/server/pluginReleases', () => ({ buildCurrentPlugin: f.build }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerConfigStatus: () => ({ configured: f.configured }), getSupabaseServerClient: () => f.configured ? {
  from: (table: string) => {
    const calls: unknown[][] = [['from', table]], filters: Array<[string, unknown]> = []; f.queries.push(calls);
    const result = (single: boolean) => {
      const rows = f.ignoreScope ? f.rows : f.rows.filter(row => filters.every(([key, value]) => row[key] === value));
      return { data: f.override ? f.payload : single ? rows[0] ?? null : rows, error: f.queryError ? { message: 'private storage/provider error' } : null };
    };
    const q = { select: (columns: string) => { calls.push(['select', columns]); return q; }, eq: (key: string, value: unknown) => { filters.push([key, value]); calls.push(['eq', key, value]); return q; },
      maybeSingle: async () => result(true), order: async (...args: unknown[]) => { calls.push(['order', ...args]); return result(false); }, insert: f.insert };
    return q;
  },
  storage: { from: (bucket: string) => { expect(bucket).toBe('cardforge-plugin-releases'); return { download: f.download, upload: f.upload, createSignedUrl: f.sign, remove: f.remove }; } },
} : null }));

import { listOwnerRetainedPluginReleases, verifyOwnerRetainedPluginRelease } from '@/features/plugin-distribution/server/ownerRetainedReleaseReads';
import { admitBuiltRelease, listRetainedReleases, type ReleaseStore } from '@/features/plugin-distribution/server/retainedReleaseCommands';
import { createRetainedReleaseStore } from '@/features/plugin-distribution/server/retainedReleaseStore';
import { handleRetainedReleaseRequest } from '@/features/plugin-distribution/server/retainedReleaseHttp';
import { cardForgeOwnerMcpHandler } from '@/features/owner/server/mcpOwnerServer';

type Fixture = { row: Record<string, unknown>; bytes: Uint8Array };
const fixtures: Fixture[] = [];
beforeAll(async () => {
  // Canonical archive fixtures are built ONCE for disposable local proof, never by a reader.
  for (const product of ['studio', 'owner'] as const) for (const environment of ['preview', 'production'] as const) {
    const built = await buildPluginArchive(product, environment);
    fixtures.push({ bytes: new Uint8Array(built.bytes), row: {
      product, environment, package_version: built.version, source_sha: 'a'.repeat(40), checksum_sha256: built.checksum,
      byte_length: built.bytes.byteLength, storage_path: `${product}/${environment}/${built.version}/${built.checksum}.zip`,
      released_at: '2026-11-02T00:00:00Z', changes: 'Synthetic retained archive fixture.',
    } });
  }
});
beforeEach(() => {
  vi.resetAllMocks(); f.rows = fixtures.map(fixture => ({ ...fixture.row }));
  f.files = new Map(fixtures.map(fixture => [String(fixture.row.storage_path), new Uint8Array(fixture.bytes)]));
  f.queries = []; f.override = false; f.payload = undefined; f.queryError = false; f.ignoreScope = false; f.configured = true;
  f.account.mockResolvedValue({ user: { id: 'owner' }, isOwner: true }); f.oauth.mockResolvedValue({ userId: 'oauth-owner' });
  f.download.mockImplementation(async (path: string) => {
    const bytes = f.files.get(path);
    return bytes ? { data: new Blob([new Uint8Array(bytes)]), error: null } : { data: null, error: { message: 'not found or unavailable' } };
  });
  for (const spy of [f.upload, f.insert, f.sign, f.remove, f.build]) spy.mockImplementation(() => { throw new Error('No build or release mutation allowed in read proof'); });
});
const scope = { product: 'studio', environment: 'preview' };
const selected = () => f.rows.find(row => row.product === 'studio' && row.environment === 'preview')!;
const exact = () => ({ ...scope, version: String(selected().package_version), checksum: String(selected().checksum_sha256) });
function noWrites() { for (const spy of [f.upload, f.insert, f.sign, f.remove, f.build]) expect(spy).not.toHaveBeenCalled(); }

it('history is sanitized metadata only and does not download or imply healthy bytes', async () => {
  const result = await listOwnerRetainedPluginReleases('owner', scope);
  expect(result).toMatchObject({ ...scope, verification: 'metadata_only', releases: [{ version: selected().package_version, checksum: selected().checksum_sha256 }] });
  expect(Object.keys(result.releases[0]).sort()).toEqual(['byteLength','changes','checksum','environment','name','product','releasedAt','sourceSha','version']);
  expect(JSON.stringify(result)).not.toMatch(/storagePath|storage_path|cardforge-plugin-releases|signedUrl|Uint8Array/);
  expect(f.download).not.toHaveBeenCalled(); noWrites();
  expect(f.queries[0]).toContainEqual(['eq', 'product', 'studio']); expect(f.queries[0]).toContainEqual(['eq', 'environment', 'preview']);
  expect(f.queries[0]).not.toContainEqual(['select', '*']);
});
for (const product of ['studio','owner'] as const) for (const environment of ['production','preview'] as const) it(`verifies original actual ${product}/${environment} archive and returns no bytes or private paths`, async () => {
  const row = f.rows.find(row => row.product === product && row.environment === environment)!;
  const result = await verifyOwnerRetainedPluginRelease('owner', { product, environment, version: row.package_version, checksum: row.checksum_sha256 });
  expect(result).toMatchObject({ verification: 'verified_original_stored_zip', release: { product, environment, version: row.package_version, checksum: row.checksum_sha256, sourceSha: 'a'.repeat(40), byteLength: row.byte_length } });
  expect(Object.keys(result).sort()).toEqual(['release','verification']); expect(JSON.stringify(result)).not.toMatch(/storagePath|storage_path|signedUrl|bytes|Uint8Array/);
  expect(f.download).toHaveBeenCalledExactlyOnceWith(row.storage_path); noWrites();
});
it('genuine [] is empty while null/undefined/object/error/configuration failures are unavailable', async () => {
  f.rows = []; expect((await listOwnerRetainedPluginReleases('owner', scope)).releases).toEqual([]);
  f.override = true;
  for (const payload of [null, undefined, {}, false]) { f.payload = payload; await expect(listOwnerRetainedPluginReleases('owner', scope)).rejects.toMatchObject({ status: 503 }); }
  f.override = false; f.queryError = true; await expect(listOwnerRetainedPluginReleases('owner', scope)).rejects.toMatchObject({ status: 503 });
  f.queryError = false; f.configured = false; await expect(listOwnerRetainedPluginReleases('owner', scope)).rejects.toMatchObject({ status: 503 });
  expect(f.download).not.toHaveBeenCalled(); noWrites();
});
for (const delta of [{ byte_length: 0 }, { byte_length: 16777217 }, { source_sha: 'unknown' }, { checksum_sha256: 'bad' }, { package_version: 'latest' }, { released_at: 'yesterday' }, { changes: '  ' }, { storage_path: 'owner/private/other.zip' }, { unexpected_private_field: 'never expose' }]) it(`malformed observed metadata is unavailable: ${JSON.stringify(delta)}`, async () => {
  Object.assign(selected(), delta); await expect(listOwnerRetainedPluginReleases('owner', scope)).rejects.toMatchObject({ status: 503 }); expect(f.download).not.toHaveBeenCalled(); noWrites();
});
it('wrong-scope records fail instead of disappearing in Store or canonical list', async () => {
  f.ignoreScope = true; await expect(listOwnerRetainedPluginReleases('owner', scope)).rejects.toMatchObject({ status: 503 });
  const wrong = { product:'owner',environment:'production',packageVersion:'0.8.0',sourceSha:'a'.repeat(40),checksumSha256:'b'.repeat(64),byteLength:100,storagePath:`owner/production/0.8.0/${'b'.repeat(64)}.zip`,changes:'Synthetic',releasedAt:'2026-11-02T00:00:00Z' };
  await expect(listRetainedReleases({ list: async () => [wrong] } as unknown as ReleaseStore, 'studio','preview')).rejects.toMatchObject({ status: 503 }); noWrites();
});
it('known absent version/checksum is distinct from generic Storage failure', async () => {
  await expect(verifyOwnerRetainedPluginRelease('owner',{...exact(),version:'99.0.0'})).rejects.toMatchObject({status:404});
  await expect(verifyOwnerRetainedPluginRelease('owner',{...exact(),checksum:'b'.repeat(64)})).rejects.toMatchObject({status:404}); expect(f.download).not.toHaveBeenCalled();
  f.download.mockResolvedValue({data:null,error:{message:'not found or provider unavailable'}});
  await expect(verifyOwnerRetainedPluginRelease('owner',exact())).rejects.toMatchObject({status:503}); noWrites();
});
it('exact lookup never substitutes a different valid scope or version', async () => {
  const input=exact(); f.override=true; f.payload={...selected(),package_version:'9.0.0',storage_path:`studio/preview/9.0.0/${selected().checksum_sha256}.zip`};
  await expect(verifyOwnerRetainedPluginRelease('owner',input)).rejects.toMatchObject({status:503}); expect(f.download).not.toHaveBeenCalled(); noWrites();
});
it('null exact lookup is absent; malformed observed lookup is not absence', async () => {
  const input=exact(); f.rows=[]; await expect(verifyOwnerRetainedPluginRelease('owner',input)).rejects.toMatchObject({status:404});
  f.override=true; for(const payload of [undefined,false,0,{},[]]){f.payload=payload; await expect(verifyOwnerRetainedPluginRelease('owner',input)).rejects.toMatchObject({status:503});} noWrites();
});
it('missing/changed original bytes cannot be repaired by a current build', async () => {
  const input=exact(),path=String(selected().storage_path); f.files.delete(path);
  await expect(verifyOwnerRetainedPluginRelease('owner',input)).rejects.toMatchObject({status:503});
  f.files.set(path,new Uint8Array([1,2,3])); await expect(verifyOwnerRetainedPluginRelease('owner',input)).rejects.toMatchObject({status:503}); noWrites();
});
it('matching SHA/length does not admit an invalid ZIP manifest or extra private entry', async () => {
  const row=selected(),zip=await JSZip.loadAsync(f.files.get(String(row.storage_path))!); zip.file('src/private.ts','must never be exposed');
  const bytes=await zip.generateAsync({type:'uint8array'}),checksum=createHash('sha256').update(bytes).digest('hex');
  Object.assign(row,{checksum_sha256:checksum,byte_length:bytes.byteLength,storage_path:`studio/preview/${row.package_version}/${checksum}.zip`}); f.files.set(String(row.storage_path),bytes);
  await expect(verifyOwnerRetainedPluginRelease('owner',exact())).rejects.toMatchObject({status:503}); noWrites();
});
it('fresh non-Owner denial precedes metadata or Storage reads', async () => {
  f.account.mockResolvedValue({user:{id:'other'},isOwner:false});
  await expect(listOwnerRetainedPluginReleases('other',scope)).rejects.toMatchObject({status:403}); await expect(verifyOwnerRetainedPluginRelease('other',exact())).rejects.toMatchObject({status:403});
  expect(f.queries).toEqual([]); expect(f.download).not.toHaveBeenCalled(); noWrites();
});
for(const extra of [{storagePath:'private/path'},{signedUrl:'https://example.invalid'},{actorUserId:'forged'},{admit:true},{version:'latest'},{checksum:'guess'}])it(`strict exact selector rejects ${JSON.stringify(extra)}`,async()=>{
 await expect(verifyOwnerRetainedPluginRelease('owner',{...exact(),...extra})).rejects.toMatchObject({status:400}); expect(f.queries).toEqual([]); noWrites();
});
it('canonical HTTP history uses the same sanitized projection and exact downloads keep their bytes',async()=>{
 const input=exact(); const history=await handleRetainedReleaseRequest(new URL('https://cardforge.test?history=1'),'studio','preview'); const body=await history.json(); expect(body.previous[0]).toMatchObject({version:input.version,checksum:input.checksum});expect(JSON.stringify(body)).not.toContain('storagePath');
 const response=await handleRetainedReleaseRequest(new URL(`https://cardforge.test?releaseVersion=${input.version}&sha256=${input.checksum}&download=1`),'studio','preview');expect(response.headers.get('X-Checksum-SHA256')).toBe(input.checksum);expect(new Uint8Array(await response.arrayBuffer())).toEqual(f.files.get(String(selected().storage_path))); noWrites();
});
it('native Store validates even callers outside adapters and never converts null history to []',async()=>{f.override=true;f.payload=null;await expect(createRetainedReleaseStore().list('studio','preview')).rejects.toMatchObject({status:503});});
const http=async(id:number,method:string,params:object)=>{const response=await cardForgeOwnerMcpHandler(new Request('https://cardforge.test/mcp/owner',{method:'POST',headers:{'content-type':'application/json',accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id,method,params})}));const text=await response.text();return{status:response.status,body:JSON.parse(text.startsWith('event:')?text.split('\n').find(line=>line.startsWith('data: '))!.slice(6):text)};};
it('initialized actual HTTP exposes 57 Owner tools and calls exactly both read contracts',async()=>{
 expect((await http(1,'initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'test',version:'1'}})).body.result.serverInfo.version).toBe('1.17.0');const tools=(await http(2,'tools/list',{})).body.result.tools;expect(tools).toHaveLength(57);
 const list=tools.find((tool:{name:string})=>tool.name==='list_owner_retained_plugin_releases'),verify=tools.find((tool:{name:string})=>tool.name==='verify_owner_retained_plugin_release');expect(list.inputSchema.required).toEqual(['product','environment']);expect(verify.inputSchema.required).toEqual(['product','environment','version','checksum']);
 for(const tool of [list,verify]){expect(tool.inputSchema.additionalProperties).toBe(false);expect(tool.outputSchema.additionalProperties).toBe(false);expect(tool.annotations).toMatchObject({readOnlyHint:false,destructiveHint:false});}
 expect(tools.some((tool:{name:string})=>/admit_owner_plugin|upload_owner_plugin|install_owner_plugin|activate_owner_plugin/.test(tool.name))).toBe(false);
 expect((await http(3,'tools/call',{name:'list_owner_retained_plugin_releases',arguments:scope})).body.result.structuredContent.verification).toBe('metadata_only');
 const result=(await http(4,'tools/call',{name:'verify_owner_retained_plugin_release',arguments:exact()})).body.result;expect(result.isError).not.toBe(true);expect(result.structuredContent.verification).toBe('verified_original_stored_zip');expect(JSON.stringify(result.structuredContent)).not.toMatch(/storagePath|storage_path|bytes|signedUrl/); noWrites();
});
it('actual HTTP denies non-Owner discovery/call and fresh revoked authority before product reads',async()=>{
 f.account.mockResolvedValue({user:{id:'other'},isOwner:false}); expect((await http(1,'tools/list',{})).status).toBe(403); expect((await http(2,'tools/call',{name:'verify_owner_retained_plugin_release',arguments:exact()})).status).toBe(403);
 f.account.mockResolvedValueOnce({user:{id:'owner'},isOwner:true}).mockResolvedValueOnce({user:{id:'owner'},isOwner:true}).mockResolvedValueOnce({user:{id:'other'},isOwner:false});expect((await http(3,'tools/call',{name:'list_owner_retained_plugin_releases',arguments:scope})).body.result.isError).toBe(true); expect(f.queries).toEqual([]);expect(f.download).not.toHaveBeenCalled();noWrites();
});
it('HTTP storage failure is safe unavailable, not a missing release claim or leaked provider detail',async()=>{f.download.mockRejectedValue(new Error('private/path/secret.zip'));const result=(await http(1,'tools/call',{name:'verify_owner_retained_plugin_release',arguments:exact()})).body.result;expect(result.isError).toBe(true);expect(result._meta['cardforge/boundaryFailure']).toMatchObject({kind:'unavailable'});expect(JSON.stringify(result)).not.toContain('private/path');noWrites();});

for (const [name, changes] of [
  ['600 astral characters', '😀'.repeat(600)],
  ['1000 astral characters', '😀'.repeat(1000)],
  ['ordinary-space padding', '  ' + 'x'.repeat(1000) + '  '],
  ['tab is one persisted character', '\t'],
  ['newline is one persisted character', '\n'],
  ['NBSP is one persisted character', '\u00a0'],
  ['tab plus 999 letters', '\t' + 'x'.repeat(999)],
  ['combining marks are separate characters', 'e\u0301'.repeat(500)],
] as const) it(`persisted SQL-valid note survives history and original verification: ${name}`, async () => {
  selected().changes = changes;
  const history = await listOwnerRetainedPluginReleases('owner', scope);
  expect(history.releases[0].changes).toBe(changes);
  const verified = await verifyOwnerRetainedPluginRelease('owner', exact());
  expect(verified.release.changes).toBe(changes);
  noWrites();
});
for (const [name, changes] of [
  ['empty', ''], ['ordinary spaces only', '   '],
  ['tab plus 1000 letters', '\t' + 'x'.repeat(1000)],
  ['space before terminal newline is not end padding', 'x'.repeat(999) + ' \n'],
  ['1001 astral characters', '😀'.repeat(1001)],
  ['1002 combining code points', 'e\u0301'.repeat(501)],
] as const) it(`persisted SQL-invalid note remains unavailable: ${name}`, async () => {
  selected().changes = changes;
  await expect(listOwnerRetainedPluginReleases('owner', scope)).rejects.toMatchObject({status:503});
  await expect(verifyOwnerRetainedPluginRelease('owner', exact())).rejects.toMatchObject({status:503});
  expect(f.download).not.toHaveBeenCalled(); noWrites();
});
it('persisted whitespace compatibility does not broaden the existing new-admission rule', async () => {
  const build = vi.fn();
  for (const changes of ['\t', '\n', '\u00a0']) {
    await expect(admitBuiltRelease({} as ReleaseStore, {sourceSha:'a'.repeat(40),build}, {product:'studio',environment:'preview',changes})).rejects.toThrow('Missing release description');
  }
  expect(build).not.toHaveBeenCalled(); noWrites();
});
it('finite native timestamp precision and byte-length bounds preserve their stored representation', async () => {
  selected().released_at='2026-11-02T21:00:00.123456+00:00';
  selected().byte_length=16777216;
  const history=await listOwnerRetainedPluginReleases('owner',scope);
  expect(history.releases[0]).toMatchObject({releasedAt:'2026-11-02T21:00:00.123456+00:00',byteLength:16777216});
  expect(f.download).not.toHaveBeenCalled(); noWrites();
});

for (const releasedAt of ['infinity', '-infinity', '10000-01-01T00:00:00+00:00', '2026-11-02T21:00:00']) it(`unsupported retained timestamp is unavailable, never empty: ${releasedAt}`, async () => {
  selected().released_at = releasedAt;
  await expect(listOwnerRetainedPluginReleases('owner', scope)).rejects.toMatchObject({ status: 503 });
  await expect(verifyOwnerRetainedPluginRelease('owner', exact())).rejects.toMatchObject({ status: 503 });
  expect(f.download).not.toHaveBeenCalled(); noWrites();
});
it('finite explicit-offset timestamps retain their observed value', async () => {
  selected().released_at = '2026-11-02T21:00:00.123456+05:30';
  expect((await listOwnerRetainedPluginReleases('owner', scope)).releases[0].releasedAt).toBe('2026-11-02T21:00:00.123456+05:30');
  expect((await verifyOwnerRetainedPluginRelease('owner', exact())).release.releasedAt).toBe('2026-11-02T21:00:00.123456+05:30');
  noWrites();
});
