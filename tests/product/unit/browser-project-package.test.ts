import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ProjectDocumentV1 } from '@/features/project/client/package-document';
import { buildCardForgeProjectSnapshot, createCardForgeProjectPackageBlob, decodeCardForgeProjectPackage, materializeBrowserProjectSnapshot, writeCardForgeProjectPackage } from '@/features/project/client/package-core';
import { createPublishedSetCopy } from '@/features/project/client/published-sets';
import { setProjectPersistenceScope } from '@/features/project/client/persistence-workspace';
import { useProjectStore } from '@/features/project/client/workspace';
import { buildBrowserCardForgeProjectSnapshot } from '@/features/project/client/project-packages';
import { readStructuredBrowserValue } from '@/features/project/persistence/structuredBrowserStorage';
import { createProjectScaleFixture } from '../../fixtures/projectScale';

const artwork = 'data:image/png;base64,aWxsdXN0cmF0ZWQtYXJ0aWZhY3Q=';

const project = (): ProjectDocumentV1 => ({
  version: 1,
  userTemplates: [{
    id: 'template-browser-package',
    name: 'Browser Package Template',
    aspectRatio: '63:88',
    templateSource: 'user',
    freeformCanvas: { width: 630, height: 880, elements: [] },
  }],
  cardSets: [{ id: 'set-browser-package', name: 'Browser Package' }],
  activeCardSetId: 'set-browser-package',
  storedCards: [{
    uniqueId: 'card-browser-package',
    templateId: 'template-browser-package',
    setId: 'set-browser-package',
    data: { artwork },
  }],
  appearanceStyles: [],
  exportSettings: {},
  customAssets: {
    'cardforge-maker-custom-textures': [],
    'cardforge-maker-custom-dividers': [],
    'cardforge-maker-custom-icons': [],
    'cardforge-maker-custom-images': [],
  },
});

describe('browser project package materialization', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    useProjectStore.setState(useProjectStore.getInitialState());
  });

  it('keeps imported package artwork as a scoped Blob reference instead of eager Base64', async () => {
    const scope = 'account:browser-package-test';
    setProjectPersistenceScope(scope);
    const snapshot = await buildCardForgeProjectSnapshot({ document: project(), name: 'Browser Package' });
    const document = await materializeBrowserProjectSnapshot(snapshot);
    const reference = String(document.storedCards[0]?.data.artwork);
    const assetId = snapshot.manifest.assets[0]!.id;

    expect(reference).toBe(`cardforge-browser-asset://${assetId}`);
    expect(JSON.stringify(document)).not.toContain(';base64,');
    const stored = await readStructuredBrowserValue<Blob>(
      `project-content-asset:${encodeURIComponent(scope)}:${assetId}`,
    );
    expect(stored).toBeInstanceOf(Blob);
    expect(stored?.type).toBe('image/png');
    expect(stored?.size).toBe(snapshot.manifest.assets[0]?.size);
  });

  it('re-embeds imported scoped Blob artwork through the canonical browser writer', async () => {
    const scope = 'account:browser-package-resave';
    setProjectPersistenceScope(scope);
    const source = await buildCardForgeProjectSnapshot({ document: project(), name: 'Imported Source' });
    const imported = await materializeBrowserProjectSnapshot(source);

    const resaved = await buildBrowserCardForgeProjectSnapshot({ document: imported, name: 'Portable Again' });
    const portableJson = JSON.stringify(resaved.manifest.project);

    expect(resaved.manifest.assets).toHaveLength(1);
    expect(portableJson).toContain('cardforge-project-asset://');
    expect(portableJson).not.toContain('cardforge-browser-asset://');
    const decoded = await decodeCardForgeProjectPackage(await createCardForgeProjectPackageBlob(resaved));
    expect(decoded.assets.get(source.manifest.assets[0]!.id)).toEqual(source.assets.get(source.manifest.assets[0]!.id));
  });

  it.each([100, 500, 1000] as const)('keeps %i illustrated Artifacts as lazy scoped Blob references at browser runtime', async (cardCount) => {
    const scope: `account:${string}` = `account:browser-package-scale-${cardCount}`;
    setProjectPersistenceScope(scope);
    const snapshot = await buildCardForgeProjectSnapshot({
      document: createProjectScaleFixture(cardCount, { uniqueArtwork: true }),
      name: `${cardCount} Illustrated Artifacts`,
    });

    const document = await materializeBrowserProjectSnapshot(snapshot);
    const references = document.storedCards.map((card) => String(card.data.artwork));
    const sampleAssetId = snapshot.manifest.assets[cardCount - 1]!.id;

    expect(references).toHaveLength(cardCount);
    expect(references.every((reference) => /^cardforge-browser-asset:\/\/[a-f0-9]{64}$/u.test(reference))).toBe(true);
    expect(JSON.stringify(document)).not.toContain(';base64,');
    expect(await readStructuredBrowserValue<Blob>(
      `project-content-asset:${encodeURIComponent(scope)}:${sampleAssetId}`,
    )).toBeInstanceOf(Blob);
  }, 60_000);

  it('hashes 1,000 browser Blobs sequentially, retains lazy sources, and resolves each source during ZIP writing', async () => {
    const scope = 'account:browser-package-lazy-write';
    setProjectPersistenceScope(scope);
    const source = await buildCardForgeProjectSnapshot({
      document: createProjectScaleFixture(1000, { uniqueArtwork: true }),
      name: '1,000 Lazy Browser Assets',
    });
    const imported = await materializeBrowserProjectSnapshot(source);
    const nativeArrayBuffer = Blob.prototype.arrayBuffer;
    let activeReads = 0;
    let peakReads = 0;
    let totalReads = 0;
    vi.spyOn(Blob.prototype, 'arrayBuffer').mockImplementation(async function (this: Blob) {
      totalReads += 1;
      activeReads += 1;
      peakReads = Math.max(peakReads, activeReads);
      await Promise.resolve();
      try {
        return await nativeArrayBuffer.call(this);
      } finally {
        activeReads -= 1;
      }
    });

    const snapshot = await buildBrowserCardForgeProjectSnapshot({
      document: imported,
      name: '1,000 Lazy Browser Assets Re-saved',
    });
    expect(snapshot.manifest.assets).toHaveLength(1000);
    expect(totalReads).toBe(1000);
    expect(peakReads).toBe(1);
    expect([...snapshot.assets.values()].every((asset) => (
      !(asset instanceof Uint8Array) && asset.kind === 'lazy'
    ))).toBe(true);

    const readsBeforeWrite = totalReads;
    let chunkCount = 0;
    await writeCardForgeProjectPackage(snapshot, new WritableStream<Uint8Array>({
      write: () => { chunkCount += 1; },
    }));

    expect(chunkCount).toBeGreaterThan(1);
    expect(totalReads - readsBeforeWrite).toBe(1000);
    expect(peakReads).toBe(1);
    expect(activeReads).toBe(0);
  }, 120_000);

  it('instantiates an immutable published package revision as independent editable identity', async () => {
    const scope = 'account:published-copy-test';
    setProjectPersistenceScope(scope);
    const source = project();
    const snapshot = await buildCardForgeProjectSnapshot({
      document: source,
      name: 'Immutable Published Set',
      savedAt: '2026-08-31T12:00:00.000Z',
    });
    const packageBlob = await createCardForgeProjectPackageBlob(snapshot);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(packageBlob, { status: 200 })));

    const result = await createPublishedSetCopy({
      packageUrl: 'https://cdn.example/published/revision.cardforge',
      expectedName: 'Editable Published Copy',
    });
    const state = useProjectStore.getState();

    expect(result.setId).not.toBe(source.cardSets[0]?.id);
    expect(result.setName).toBe('Editable Published Copy');
    expect(state.storedCards[0]?.uniqueId).not.toBe(source.storedCards[0]?.uniqueId);
    expect(state.storedCards[0]?.setId).toBe(result.setId);
    expect(snapshot.manifest.projectRevision).toMatch(/^[a-f0-9]{64}$/u);
    expect((await createCardForgeProjectPackageBlob(snapshot)).size).toBe(packageBlob.size);
  });
});

const remoteArt = 'https://assets.example/storage/v1/object/public/art/card.png';
const remoteFrame = 'https://assets.example/storage/v1/object/public/art/frame.png';
const remoteProject = () => {
  const value = project();
  value.userTemplates[0].freeformCanvas!.elements = [{ id: 'art', name: 'Artwork', type: 'image', imageSource: '{{artwork}}', x: 0, y: 0, width: 630, height: 880, zIndex: 1 }];
  value.userTemplates[0].cardBorderImageSource = remoteFrame;
  value.storedCards[0].data = { artwork: remoteArt, rank: 'K', title: 'QA REV R2 SAVED 20261021', notes: remoteArt };
  value.cardSets.push({ id: 'second-set', name: 'Other work' });
  value.storedCards.push({ ...value.storedCards[0], uniqueId: 'second-card', setId: 'second-set', data: { artwork: remoteArt, title: 'Keep other work' } });
  return value;
};

describe('remote artwork in portable browser packages', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('embeds referenced artwork and frame bytes while keeping edits, identities, all Sets and URL-looking text', async () => {
    setProjectPersistenceScope('guest');
    const source = remoteProject();
    const original = structuredClone(source);
    const fetch = vi.fn(async (url: string) => new Response(url === remoteArt ? 'card-bytes' : 'frame-bytes', { headers: { 'Content-Type': 'image/png' } }));
    vi.stubGlobal('fetch', fetch);
    const snapshot = await buildBrowserCardForgeProjectSnapshot({ document: source, name: 'Whole workspace' });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledWith(remoteArt, expect.objectContaining({ mode: 'cors', credentials: 'same-origin', redirect: 'error' }));
    expect(source).toEqual(original);
    const reopened = await decodeCardForgeProjectPackage(await createCardForgeProjectPackageBlob(snapshot));
    expect(reopened.manifest.assets).toHaveLength(2);
    expect([...reopened.assets.values()].map((bytes) => new TextDecoder().decode(bytes as Uint8Array)).sort()).toEqual(['card-bytes', 'frame-bytes']);
    const restored = await materializeBrowserProjectSnapshot(reopened);
    expect(restored.cardSets.map((set) => set.id)).toEqual(source.cardSets.map((set) => set.id));
    expect(restored.storedCards[0]).toMatchObject({ uniqueId: source.storedCards[0].uniqueId, templateId: source.storedCards[0].templateId, data: { rank: 'K', title: 'QA REV R2 SAVED 20261021', notes: remoteArt } });
    expect(restored.storedCards[0].data.artwork).toMatch(/^cardforge-browser-asset:\/\//u);
    expect(restored.userTemplates[0].cardBorderImageSource).toMatch(/^cardforge-browser-asset:\/\//u);
    expect(restored.storedCards[1].data.artwork).toBe(restored.storedCards[0].data.artwork);
  });

  it.each(['not-found', 'cors', 'timeout', 'html', 'empty', 'oversized'] as const)('refuses a portable snapshot on %s without modifying authored work', async (failure) => {
    setProjectPersistenceScope('guest');
    const source = remoteProject();
    const original = structuredClone(source);
    vi.stubGlobal('fetch', vi.fn(async () => {
      if (failure === 'cors') throw new TypeError('Failed to fetch');
      if (failure === 'timeout') throw new DOMException('Timed out', 'TimeoutError');
      return new Response(failure === 'empty' ? '' : 'bytes', { status: failure === 'not-found' ? 404 : 200, headers: { 'Content-Type': failure === 'html' ? 'text/html' : 'image/png', ...(failure === 'oversized' ? { 'Content-Length': String(33 * 1024 * 1024) } : {}) } });
    }));
    await expect(buildBrowserCardForgeProjectSnapshot({ document: source, name: 'Must fail' })).rejects.toThrow(/artwork|asset limit/iu);
    expect(source).toEqual(original);
  });

  it.each(['http://example.com/image.png', 'https://user:password@example.com/image.png', 'file:///tmp/image.png', '{{host}}/image.png', 'https://example.com/sprite.svg#specific-view'])('does not fetch unsafe or unportable media %s', async (url) => {
    setProjectPersistenceScope('guest');
    const source = remoteProject();
    source.storedCards[0].data.artwork = url;
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    await expect(buildBrowserCardForgeProjectSnapshot({ document: source, name: 'Must fail' })).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["url(data:image/png;base64,AAAA), url('/frame.png')", "url('/frame.png')", "url('//cdn.example/frame.png')", "url('https://cdn.example/frame.png')"])('rejects unresolved CSS artwork %s', async (css) => {
    setProjectPersistenceScope('guest');
    const source = project();
    source.userTemplates[0].appearance = { rawCss: { backgroundImage: css } };
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    await expect(buildBrowserCardForgeProjectSnapshot({ document: source, name: 'CSS dependency' })).rejects.toThrow('CSS artwork');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('enforces the actual streamed size even without Content-Length', async () => {
    setProjectPersistenceScope('guest');
    const cancel = vi.fn();
    const chunk = new Uint8Array(1024 * 1024);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({ pull(controller) { controller.enqueue(chunk); }, cancel }), { headers: { 'Content-Type': 'image/png' } })));
    await expect(buildBrowserCardForgeProjectSnapshot({ document: remoteProject(), name: 'Too large' })).rejects.toThrow('32 MB');
    expect(cancel).toHaveBeenCalled();
  });

  it('rejects an account switch during capture', async () => {
    setProjectPersistenceScope('guest');
    vi.stubGlobal('fetch', vi.fn(async () => {
      setProjectPersistenceScope('account:different');
      return new Response('image', { headers: { 'Content-Type': 'image/png' } });
    }));
    await expect(buildBrowserCardForgeProjectSnapshot({ document: remoteProject(), name: 'Changed owner' })).rejects.toThrow('account changed');
  });
});
