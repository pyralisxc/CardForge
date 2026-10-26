import { createHash } from 'node:crypto';

import JSZip from 'jszip';
import { describe, expect, it, vi } from 'vitest';

import { buildDeterministicStarterSetPackage, backfillPipelineRegistryMedia, verifyReplayShowcaseBytes } from '../../../scripts/sync-pipeline-defaults.mjs';

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
