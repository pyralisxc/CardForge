import { createHash } from 'node:crypto';

import JSZip from 'jszip';
import { describe, expect, it, vi } from 'vitest';

import { buildDeterministicStarterSetPackage, storeStarterSetPackage, publishStarterSetItem, collectStarterSetItems, backfillPipelineRegistryMedia, verifyReplayShowcaseBytes } from '../../../scripts/sync-pipeline-defaults.mjs';

describe('Pipeline default synchronization', () => {
  it('builds byte-identical starter packages independently of execution time', async () => {
    const manifest = {
      cardforgeProject: 2,
      name: 'Deterministic Set',
      savedAt: '2026-09-02T00:00:00.000Z',
      projectRevision: 'revision-1',
      project: { artifacts: [] },
      assets: [],
    };

    const first = await buildDeterministicStarterSetPackage(manifest);
    const second = await buildDeterministicStarterSetPackage(manifest);
    const decoded = await JSZip.loadAsync(first);

    expect(decoded.file('cardforge-project.json')?.date.toISOString()).toBe(manifest.savedAt);
    expect(createHash('sha256').update(first).digest('hex'))
      .toBe(createHash('sha256').update(second).digest('hex'));
  });
});


describe('existing Pipeline media backfill', () => {
  const fixture = (reference: string, corrupt = false, placeholder = false) => {
    const objects = new Map<string, Uint8Array>();
    const upload = vi.fn(async (path: string, bytes: Uint8Array) => {
      objects.set(path, bytes); return { error: null };
    });
    const rpc = vi.fn(async (_name: string, _args: Record<string, unknown>) => ({ error: null }));
    const registry = [{ asset_id: 'arcane-forge-frame-creature-premium',
      url: '/card-assets/textures/arcane-forge/frame-creature-premium.webp',
      metadata: {} }, { asset_id: 'existing-recipe', url: '/api/styles#existing-recipe',
      metadata: { style: { imageSource: reference } } }];
    const client = {
      from: (table: string) => ({ select: () => table === 'cardforge_contributor_asset_submissions'
        ? { eq: async () => ({ data: [{ source_payload: { frame: reference, ...(placeholder ? { id: 'default-name-card-theme', templatePreviewData: { CompanyLogo: '/card-assets/images/default-company-logo.svg' } } : {}) } }], error: null }) }
        : Promise.resolve({ data: table === 'cardforge_asset_registry' ? registry : [], error: null }) }),
      storage: { from: () => ({ upload,
        getPublicUrl: (path: string) => ({ data: { publicUrl: `http://127.0.0.1:54321/storage/v1/object/public/cardforge-contributor-assets/${path}` } }),
        download: async (path: string) => ({ data: new Blob([corrupt ? new Uint8Array([0]) : Uint8Array.from(objects.get(path)!)]), error: null }),
      }) }, rpc,
    };
    return { client, rpc, upload };
  };
  it('materializes a canonical alias and rewrites existing metadata without publishing missing entries', async () => {
    const { client, rpc, upload } = fixture('/card-assets/textures/arcane-forge/frame-creature-premium.webp');
    const proof = await backfillPipelineRegistryMedia(client);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(proof.verifiedMedia[0].path).toBe('owner-defaults/images/frames/front/frame-creature-premium.webp');
    expect(proof.verifiedMedia[0].bytes).toBeGreaterThan(0);
    expect(rpc.mock.calls.map(call => call[0])).toEqual([
      'cardforge_migrate_pipeline_registry_storage', 'cardforge_migrate_pipeline_registry_metadata_urls',
    ]);
    expect(JSON.stringify(rpc.mock.calls[1])).not.toContain('/card-assets/');
  });
  it('resolves the historical showcase alias to real fallback bytes without importing a registry identity', async () => {
    const { client, rpc, upload } = fixture('/card-assets/showcase/playing-cards/ace-of-spades.webp');
    const initializeShowcase = vi.fn(async (_item: { asset_id: string }) => {});
    const proof = await backfillPipelineRegistryMedia(client, { initializeShowcase });
    expect(initializeShowcase).toHaveBeenCalledTimes(1);
    expect(initializeShowcase.mock.calls[0][0].asset_id).toBe('showcase-playing-cards-ace-of-spades');
    expect(upload).toHaveBeenCalledTimes(1);
    expect(proof.verifiedMedia[0].path).toBe('owner-defaults/site-fallbacks/showcase/playing-cards/ace-of-spades.webp');
    expect(proof.verifiedMedia[0].bytes).toBeGreaterThan(0);
    expect(rpc.mock.calls.map(call => call[0])).toEqual(['cardforge_migrate_pipeline_registry_metadata_urls']);
  });
  it('rejects hash-mismatched historical showcase bytes', () => {
    expect(() => verifyReplayShowcaseBytes(Buffer.from('different media'))).toThrow('do not match');
  });
  it('defers only the known native-removal sample field without rewriting its payload', async () => {
    const { client, rpc } = fixture('/card-assets/textures/arcane-forge/frame-creature-premium.webp', false, true);
    await expect(backfillPipelineRegistryMedia(client)).rejects.toThrow('dependency is missing');
    expect(rpc).not.toHaveBeenCalled();
    await backfillPipelineRegistryMedia(client, { deferHistoricalPreviewPlaceholders: true });
    expect(rpc.mock.calls.map(call => call[0])).toEqual([
      'cardforge_migrate_pipeline_registry_storage', 'cardforge_migrate_pipeline_registry_metadata_urls',
    ]);
  });
  it('refuses missing dependencies before changing any row', async () => {
    const { client, rpc } = fixture('/card-assets/textures/missing-replay-resource.svg');
    await expect(backfillPipelineRegistryMedia(client)).rejects.toMatchObject({
      code: 'PIPELINE_DEPENDENCY_MISSING',
      dependencies: [
        { identity: 'existing-recipe', owner: 'registry-metadata', paths: ['textures/missing-replay-resource.svg'] },
        { identity: 'unknown-template', owner: 'submission-payload', paths: ['textures/missing-replay-resource.svg'] },
      ],
    });
    expect(rpc).not.toHaveBeenCalled();
  });
  it('refuses a Storage byte mismatch before changing any row', async () => {
    const { client, rpc } = fixture('/card-assets/textures/arcane-forge/frame-creature-premium.webp', true);
    await expect(backfillPipelineRegistryMedia(client)).rejects.toThrow('readback differs');
    expect(rpc).not.toHaveBeenCalled();
  });
});


describe('starter Set exact package storage', () => {
  const fixture = (stored: Uint8Array | null, uploadError: unknown = null) => {
    const upload = vi.fn(async () => ({ error: uploadError }));
    const download = vi.fn(async () => ({ data: stored && new Blob([Uint8Array.from(stored)]), error: null }));
    const bucket = { upload, download, getPublicUrl: (path: string) => ({ data: { publicUrl: `https://example.invalid/${path}` } }) };
    return { client: { storage: { from: () => bucket } }, upload, download };
  };
  const bytes = Buffer.from('synthetic exact package');
  it.each([null, { message: 'Asset Already Exists' }, { message: 'response lost' }])('verifies exact bytes before returning a receipt (%j)', async (error) => {
    const { client, upload, download } = fixture(bytes, error);
    const result = await storeStarterSetPackage(client, 'test-set', bytes);
    expect(result.storagePath).toBe(`owner-defaults/sets/test-set/${createHash('sha256').update(bytes).digest('hex')}.cardforge`);
    expect(upload).toHaveBeenCalledWith(result.storagePath, bytes, { contentType: 'application/octet-stream', upsert: false });
    expect(download).toHaveBeenCalledWith(result.storagePath);
    expect(result.fileSizeBytes).toBe(bytes.length);
  });
  it.each([Buffer.from('different bytes'), Buffer.alloc(bytes.length, 1)])('rejects conflicting readback without overwriting it', async (wrong) => {
    const { client, upload } = fixture(wrong);
    await expect(storeStarterSetPackage(client, 'test-set', bytes)).rejects.toThrow('differs');
    expect(upload).toHaveBeenCalledTimes(1);
  });
  it('does not turn an unavailable readback into publication proof', async () => {
    const { client } = fixture(null, { message: 'unknown upload outcome' });
    await expect(storeStarterSetPackage(client, 'test-set', bytes)).rejects.toThrow('readback unavailable');
  });
  it('separates changed bytes instead of replacing a version-named object', async () => {
    const a = await storeStarterSetPackage(fixture(bytes).client, 'test-set', bytes);
    const changed = Buffer.from('changed package');
    const b = await storeStarterSetPackage(fixture(changed).client, 'test-set', changed);
    expect(a.storagePath).not.toBe(b.storagePath);
  });
});


describe('native starter Set publication binding', () => {
  const set = { id:'set-proof', name:'Proof', description:'Synthetic', packageUrl:'https://example.invalid/proof',
    previewUrl:'', storagePath:'exact-path', fileSizeBytes:42, packageSha256:'a'.repeat(64), specialtyTags:['games'],useCaseTags:['playing-cards'],sourceNotes:'Synthetic',
    packageInterpretation:{contractVersion:1,packageSha256:'a'.repeat(64),fileSizeBytes:42,complete:false,references:{identities:[],sources:[]},opaqueReasons:['external_or_unbound_source']} };
  it('passes the verified exact source interpretation to the existing native publisher, including opacity', async () => {
    const rpc=vi.fn(async () => ({error:null}));
    await publishStarterSetItem({rpc},set,{clerk_user_id:'owner',email:'owner@example.invalid'});
    expect(rpc).toHaveBeenCalledWith('cardforge_publish_official_starter_set',expect.objectContaining({
      p_package_interpretation:set.packageInterpretation,p_package_sha256:set.packageSha256,p_storage_path:set.storagePath,p_file_size_bytes:42,
    }));
  });
  it.each([{packageSha256:'b'.repeat(64)},{fileSizeBytes:41},{packageInterpretation:null}])('rejects a mismatched source/object receipt before publication', async change => {
    const rpc=vi.fn();
    await expect(publishStarterSetItem({rpc},{...set,...change},{clerk_user_id:'owner'})).rejects.toThrow('does not match');
    expect(rpc).not.toHaveBeenCalled();
  });
  it('does not retry an uncertain native publication or delete its source', async () => {
    const error=new Error('native response lost'); const rpc=vi.fn(async () => ({error}));
    await expect(publishStarterSetItem({rpc},set,{clerk_user_id:'owner'})).rejects.toBe(error);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});


it('runs the actual starter package compiler/readback/native publication seam with provider stubs', async () => {
  const objects = new Map<string, Uint8Array>();
  const bucket = {
    upload: vi.fn(async (path: string, bytes: Uint8Array, options: {upsert:boolean}) => {
      expect(options.upsert).toBe(false); objects.set(path,bytes); return {error:null};
    }),
    download: async (path: string) => ({data:new Blob([Uint8Array.from(objects.get(path)!)]),error:null}),
    getPublicUrl: (path: string) => ({data:{publicUrl:`https://example.invalid/storage/v1/object/public/cardforge-contributor-assets/${path}`}}),
  };
  const rpc = vi.fn(async () => ({error:null}));
  const client = {storage:{from:() => bucket},rpc};
  const sets = await collectStarterSetItems(client,new Map());
  expect(sets.length).toBeGreaterThan(0);
  for (const set of sets) {
    expect(set.packageInterpretation.packageSha256).toBe(set.packageSha256);
    expect(set.packageInterpretation.fileSizeBytes).toBe(objects.get(set.storagePath)!.byteLength);
    expect(set.packageInterpretation.sourceManifest.project.artifacts).toHaveLength(52);
    await publishStarterSetItem(client,set,{clerk_user_id:'synthetic-owner',email:''});
  }
  expect(rpc).toHaveBeenCalledTimes(sets.length);
  expect(rpc).toHaveBeenLastCalledWith('cardforge_publish_official_starter_set',expect.objectContaining({p_package_interpretation:sets.at(-1)!.packageInterpretation}));
});
