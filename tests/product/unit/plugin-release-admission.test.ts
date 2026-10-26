import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import JSZip from 'jszip';
import { buildPluginArchive } from '../../../scripts/plugin-package-core.mjs';
import { admitBuiltRelease, readRetainedRelease, listRetainedReleases, type ReleaseStore, type RetainedRelease } from '@/features/plugin-distribution/server/retainedReleaseCommands';

const sourceSha = 'a'.repeat(40);
const built = async () => {
  const b = await buildPluginArchive('studio','production');
  return { bytes: b.bytes, version: b.version, checksum: b.checksum, endpoint: b.endpoint, name: b.name };
};
function memoryStore() {
  const files = new Map<string, Uint8Array>();
  const rows = new Map<string, RetainedRelease>();
  let failUpload = false, failAdmit = false;
  const store: ReleaseStore = {
    find: async (p,e,v) => rows.get(p+e+v) ?? null,
    list: async () => [...rows.values()],
    uploadOnce: async (path,bytes) => {
      if (failUpload) throw new Error('upload failed');
      if (files.has(path)) return 'already-exists';
      files.set(path,bytes); return 'created';
    },
    readBytes: async path => { const x=files.get(path); if (!x) throw Error('missing bytes'); return x; },
    admit: async record => {
      if (failAdmit) throw new Error('insert failed');
      const key=record.product+record.environment+record.packageVersion;
      if (rows.has(key)) throw Error('duplicate version');
      rows.set(key,{ ...record, releasedAt:'2026-10-26T18:00:00Z' });
    },
  };
  return {store,files,rows,setFailUpload:(v:boolean)=>{failUpload=v},setFailAdmit:(v:boolean)=>{failAdmit=v}};
}
const args={product:'studio' as const,environment:'production' as const,changes:'Reviewed package'};
const trusted={sourceSha,build:built};
describe('retained plugin release admission (in-memory provider only)', () => {
  it('validates actual canonical ZIP, admits, lists and reads original bytes',async()=>{
    const s=memoryStore(); const result=await admitBuiltRelease(s.store,trusted,args);
    expect(result.checksumSha256).toBe((await built()).checksum);
    expect((await readRetainedRelease(s.store,result,(await built()).endpoint)).byteLength).toBeGreaterThan(0);
    expect(await listRetainedReleases(s.store,'studio','production')).toHaveLength(1);
    expect(await admitBuiltRelease(s.store,trusted,args)).toEqual(result);
  });
  it('never admits failed uploads or failed metadata writes',async()=>{
    const s=memoryStore();s.setFailUpload(true);
    await expect(admitBuiltRelease(s.store,trusted,args)).rejects.toThrow('upload failed');
    expect(s.rows.size).toBe(0);s.setFailUpload(false);s.setFailAdmit(true);
    await expect(admitBuiltRelease(s.store,trusted,args)).rejects.toThrow('insert failed');
    expect(s.rows.size).toBe(0);expect(s.files.size).toBe(1);
    s.setFailAdmit(false);
    expect((await admitBuiltRelease(s.store,trusted,args)).storagePath).toBe([...s.files.keys()][0]);
  });
  it('detects missing or mutated retained bytes without regenerating history',async()=>{
    const s=memoryStore();const row=await admitBuiltRelease(s.store,trusted,args);
    s.files.set(row.storagePath,Buffer.from('corrupt'));
    await expect(readRetainedRelease(s.store,row,(await built()).endpoint)).rejects.toThrow();
    await expect(admitBuiltRelease(s.store,trusted,args)).rejects.toThrow();
  });
  it('rejects mismatched manifest and duplicate version with different source',async()=>{
    const s=memoryStore(); await admitBuiltRelease(s.store,trusted,args);
    await expect(admitBuiltRelease(s.store,{...trusted,sourceSha:'b'.repeat(40)},args)).rejects.toThrow('Release admission readback mismatch');
    await expect(admitBuiltRelease(memoryStore().store,{...trusted,build:async()=>({...await built(),endpoint:'https://wrong.invalid/mcp'})},args)).rejects.toThrow('Release endpoint violates environment policy');
  });
  it('rejects both malformed legacy manifests and disallowed MCP transport/header variants',async()=>{
    for (const file of ['.codex-plugin/plugin.json','.mcp.json']) {
      const z=await JSZip.loadAsync((await built()).bytes);
      z.file(file,'not json');
      const bytes=await z.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
      const modified={...await built(),bytes,checksum:createHash('sha256').update(bytes).digest('hex')};
      await expect(admitBuiltRelease(memoryStore().store,{...trusted,build:async()=>modified},args)).rejects.toThrow();
    }
    for (const file of ['mcp.json','.mcp.json']) {
      const z=await JSZip.loadAsync((await built()).bytes);
      const m=JSON.parse(await z.file(file)!.async('string'));
      const key=Object.keys(m.mcpServers)[0];
      m.mcpServers[key]={...m.mcpServers[key],headers:{Authorization:'secret'},type:'wrong'};
      z.file(file,JSON.stringify(m));
      const bytes=await z.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
      await expect(admitBuiltRelease(memoryStore().store,{...trusted,build:async()=>({...await built(),bytes,checksum:createHash('sha256').update(bytes).digest('hex')})},args)).rejects.toThrow();
    }
  });
  it('rejects extra MCP servers and raw traversal ZIP entries',async()=>{
    const canonical=await built();
    const extra=await JSZip.loadAsync(canonical.bytes);
    const mcp=JSON.parse(await extra.file('mcp.json')!.async('string'));
    mcp.mcpServers.unapproved={type:'streamable-http',url:'https://wrong.invalid/mcp'};
    extra.file('mcp.json',JSON.stringify(mcp));
    const extraBytes=await extra.generateAsync({type:'nodebuffer'});
    await expect(admitBuiltRelease(memoryStore().store,{...trusted,build:async()=>({...canonical,bytes:extraBytes,checksum:createHash('sha256').update(extraBytes).digest('hex')})},args)).rejects.toThrow();

    const traversal=await JSZip.loadAsync(canonical.bytes);
    traversal.file('../plugin.json',await traversal.file('plugin.json')!.async('string'),{createFolders:false});
    const unsafe=await traversal.generateAsync({type:'nodebuffer'});
    await expect(admitBuiltRelease(memoryStore().store,{...trusted,build:async()=>({...canonical,bytes:unsafe,checksum:createHash('sha256').update(unsafe).digest('hex')})},args)).rejects.toThrow();
  });
  it('rejects divergent local and central ZIP entry names', async()=>{
    const canonical=await built();
    const bytes=Buffer.from(canonical.bytes);
    // Change only the LOCAL filename for plugin.json, preserving its byte count
    // and its central-directory entry. JSZip sees unsafeOriginalName.
    const local=bytes.indexOf(Buffer.from([0x50,0x4b,0x03,0x04]));
    expect(local).toBeGreaterThanOrEqual(0);
    const nameOffset=local+30;
    expect(bytes.subarray(nameOffset,nameOffset+11).toString()).toBe('plugin.json');
    Buffer.from('junk/../xxx').copy(bytes,nameOffset);
    await expect(admitBuiltRelease(memoryStore().store,{...trusted,build:async()=>({
      ...canonical,bytes,checksum:createHash('sha256').update(bytes).digest('hex'),
    })},args)).rejects.toThrow();
  });
  it('rejects invalid builder endpoints and authoritative metadata mutation',async()=>{
    await expect(admitBuiltRelease(memoryStore().store,{...trusted,build:async()=>({...await built(),endpoint:'https://wrong.invalid/mcp'})},args)).rejects.toThrow();
    for (const mismatch of [{sourceSha:'f'.repeat(40)},{byteLength:1},{storagePath:'wrong/path.zip'}]) {
      const s=memoryStore();const original=s.store.find;
      s.store.find=async(p,e,v)=>{const row=await original(p,e,v); return row ? {...row,...mismatch}:null;};
      await expect(admitBuiltRelease(s.store,trusted,args)).rejects.toThrow();
    }
  });
  it('rejects invalid source identity before provider operations',async()=>{
    const s=memoryStore();
    await expect(admitBuiltRelease(s.store,{...trusted,sourceSha:'untrusted'},args)).rejects.toThrow();
    expect(s.files.size).toBe(0);
  });
});
