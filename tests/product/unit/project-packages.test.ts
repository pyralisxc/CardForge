import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import {
  buildCardForgeProjectSnapshot,
  createCardForgeProjectPackageBlob,
  decodeCardForgeProjectPackage,
  encodeCardForgeProjectPackage,
  hydrateCardForgeProjectSnapshot,
  writeCardForgeProjectPackage,
} from '@/features/project/lib/projectPackageCodec';
import {
  CARDFORGE_PROJECT_ASSET_REFERENCE_PREFIX,
  CARDFORGE_PROJECT_MANIFEST_FILE,
  CARDFORGE_PROJECT_PACKAGE_VERSION,
  MAX_PROJECT_PACKAGE_ASSETS,
  MAX_PROJECT_PACKAGE_METADATA_BYTES,
} from '@/features/project/model/projectPackage';
import type { ProjectDocumentV1 } from '@/features/project/model/projectDocument';
import { saveCardForgeProjectPackageToDevice } from '@/features/project/client/projectPackageDeviceSave';

const onePixelPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2ZxQAAAAASUVORK5CYII=';
const tinyFontData = 'data:font/woff2;base64,AAECAwQ=';

const createProject = (): ProjectDocumentV1 => ({
  version: 1,
  userTemplates: [{
    id: 'template-1',
    name: 'Template One',
    aspectRatio: '63:88',
    templateSource: 'user',
    templateLibrarySource: 'personal',
    freeformCanvas: {
      width: 630,
      height: 880,
      elements: [{
        id: 'art',
        name: 'Artwork',
        type: 'image',
        x: 0,
        y: 0,
        width: 630,
        height: 500,
        zIndex: 1,
        imageSource: onePixelPng,
      }],
    },
  }],
  cardSets: [{ id: 'set-1', name: 'Clash of Fists' }],
  activeCardSetId: 'set-1',
  storedCards: [{
    templateId: 'template-1',
    setId: 'set-1',
    setName: 'Clash of Fists',
    uniqueId: 'card-1',
    data: { name: 'Mountain King', artwork: onePixelPng },
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

describe('portable CardForge project packages', () => {
  it('deduplicates embedded artwork and round-trips one canonical .cardforge package', async () => {
    const snapshot = await buildCardForgeProjectSnapshot({
      document: createProject(),
      name: 'Clash of Fists',
      savedAt: '2026-08-23T12:00:00.000Z',
    });

    expect(snapshot.assets.size).toBe(1);
    expect(snapshot.manifest.assets).toHaveLength(1);
    expect(snapshot.manifest.projectRevision).toMatch(/^[a-f0-9]{64}$/u);
    expect(snapshot.manifest.cardforgeProject).toBe(CARDFORGE_PROJECT_PACKAGE_VERSION);
    expect(snapshot.manifest.project.artifacts[0]!.card.data.artwork).toMatch(new RegExp(`^${CARDFORGE_PROJECT_ASSET_REFERENCE_PREFIX}`));
    expect(snapshot.manifest.project.userTemplates[0]!.freeformCanvas?.elements[0]?.imageSource).toMatch(new RegExp(`^${CARDFORGE_PROJECT_ASSET_REFERENCE_PREFIX}`));

    const bytes = await encodeCardForgeProjectPackage(snapshot);
    const decoded = await decodeCardForgeProjectPackage(bytes);
    const hydrated = hydrateCardForgeProjectSnapshot(decoded);

    expect(decoded.manifest.projectRevision).toBe(snapshot.manifest.projectRevision);
    expect(hydrated.storedCards[0]!.data.artwork).toBe(onePixelPng);
    expect(hydrated.userTemplates[0]!.freeformCanvas?.elements[0]?.imageSource).toBe(onePixelPng);
  });

  it('reads the legacy v1 package while writing only the artifact-based v2 format', async () => {
    const project = createProject();
    const assets: never[] = [];
    const revisionPayload = new TextEncoder().encode(JSON.stringify({ project, assets }));
    const revision = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', revisionPayload)))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    const legacyManifest = {
      cardforgeProject: 1,
      name: 'Legacy Project',
      projectRevision: revision,
      savedAt: '2026-08-23T12:00:00.000Z',
      project,
      assets,
    };
    const zip = new JSZip();
    zip.file(CARDFORGE_PROJECT_MANIFEST_FILE, JSON.stringify(legacyManifest), { compression: 'STORE' });
    const decoded = await decodeCardForgeProjectPackage(await zip.generateAsync({ type: 'uint8array', compression: 'STORE' }));

    expect(decoded.manifest.cardforgeProject).toBe(1);
    expect(hydrateCardForgeProjectSnapshot(decoded).storedCards[0]?.uniqueId).toBe('card-1');
  });

  it('writes the canonical v2 archive to a bounded destination stream', async () => {
    const snapshot = await buildCardForgeProjectSnapshot({ document: createProject(), name: 'Streamed Project' });
    const chunks: Uint8Array[] = [];
    await writeCardForgeProjectPackage(snapshot, new WritableStream<Uint8Array>({
      write: (chunk) => {
        chunks.push(chunk.slice());
      },
    }));
    const byteLength = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
    const bytes = new Uint8Array(byteLength);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const decoded = await decodeCardForgeProjectPackage(bytes);
    expect(decoded.manifest.cardforgeProject).toBe(2);
    expect(hydrateCardForgeProjectSnapshot(decoded).storedCards[0]?.uniqueId).toBe('card-1');
  });

  it('aborts rather than closes a native destination when package validation fails', async () => {
    const snapshot = await buildCardForgeProjectSnapshot({ document: createProject(), name: 'Abort Invalid Save' });
    const firstAsset = snapshot.manifest.assets[0]!;
    const invalidSnapshot = { ...snapshot, assets: new Map(snapshot.assets) };
    invalidSnapshot.assets.set(firstAsset.id, new Uint8Array(0));
    let closed = false;
    let aborted = false;

    await expect(writeCardForgeProjectPackage(invalidSnapshot, new WritableStream<Uint8Array>({
      close: () => { closed = true; },
      abort: () => { aborted = true; },
    }))).rejects.toThrow(/does not match its manifest/u);

    expect(aborted).toBe(true);
    expect(closed).toBe(false);
  });

  it('rechecks a lazy asset hash while writing instead of trusting its prepared manifest', async () => {
    const snapshot = await buildCardForgeProjectSnapshot({ document: createProject(), name: 'Lazy Integrity' });
    const descriptor = snapshot.manifest.assets[0]!;
    const assets = new Map(snapshot.assets);
    assets.set(descriptor.id, {
      kind: 'lazy',
      size: descriptor.size,
      load: async () => new Uint8Array(descriptor.size).fill(7),
    });

    await expect(writeCardForgeProjectPackage(
      { ...snapshot, assets },
      new WritableStream<Uint8Array>(),
    )).rejects.toThrow(/integrity/u);
  });

  it('materializes provider-compatible bodies from the same canonical writer without a byte-copy contract', async () => {
    const snapshot = await buildCardForgeProjectSnapshot({ document: createProject(), name: 'Provider Body' });
    const blob = await createCardForgeProjectPackageBlob(snapshot);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/vnd.cardforge.project+zip');
    const decoded = await decodeCardForgeProjectPackage(blob);
    expect(decoded.manifest.projectRevision).toBe(snapshot.manifest.projectRevision);
  });

  it('streams a device save directly into the native file handle when available', async () => {
    const snapshot = await buildCardForgeProjectSnapshot({ document: createProject(), name: 'Native Save' });
    const chunks: Uint8Array[] = [];
    let pickerOptions: unknown;
    const mode = await saveCardForgeProjectPackageToDevice({
      fileName: 'native-save.cardforge',
      snapshot,
      pickerWindow: {
        showSaveFilePicker: async (options) => {
          pickerOptions = options;
          return {
            createWritable: async () => new WritableStream<Uint8Array>({
              write: (chunk) => {
                chunks.push(chunk.slice());
              },
            }),
          };
        },
      },
    });

    expect(mode).toBe('streamed-file');
    expect(pickerOptions).toMatchObject({ suggestedName: 'native-save.cardforge' });
    const decoded = await decodeCardForgeProjectPackage(new Blob(chunks.map((chunk) => {
      const copy = new Uint8Array(chunk.byteLength);
      copy.set(chunk);
      return copy.buffer;
    })));
    expect(decoded.manifest.projectRevision).toBe(snapshot.manifest.projectRevision);
  });

  it('streams packages beyond the retired 512-asset ceiling within aggregate byte limits', async () => {
    const project = createProject();
    project.storedCards[0]!.data = Object.fromEntries(Array.from({ length: 513 }, (_, index) => [
      `asset${index}`,
      `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg"><text>${index}</text></svg>`)}`,
    ]));

    const snapshot = await buildCardForgeProjectSnapshot({ document: project, name: 'Many Assets' });
    expect(snapshot.assets.size).toBe(514);
    const decoded = await decodeCardForgeProjectPackage(await encodeCardForgeProjectPackage(snapshot));
    const hydrated = hydrateCardForgeProjectSnapshot(decoded);
    expect(decoded.manifest.assets).toHaveLength(514);
    expect(hydrated.storedCards[0]!.data.asset512).toMatch(/^data:image\/svg\+xml;base64,/u);
  });

  it('externalizes and restores a project-owned personal font without provider URLs', async () => {
    const project = createProject();
    project.customFonts = [{
      id: 'fontasset123',
      name: 'Connected Test Font',
      value: 'font-personal-fontasset123',
      mimeType: 'font/woff2',
      dataUrl: tinyFontData,
      fileSizeBytes: 5,
      sourceProvider: 'google-drive',
      sourceItemId: 'library-item-1',
      sourceProviderFileId: 'drive_file_123',
      sourceProviderRevision: '8',
    }];

    const snapshot = await buildCardForgeProjectSnapshot({ document: project, name: 'Font Project' });
    expect(snapshot.manifest.assets.some((asset) => asset.mimeType === 'font/woff2')).toBe(true);
    expect(snapshot.manifest.project.customFonts?.[0]?.dataUrl).toMatch(new RegExp(`^${CARDFORGE_PROJECT_ASSET_REFERENCE_PREFIX}`));
    expect(JSON.stringify(snapshot.manifest)).not.toContain('googleusercontent.com');

    const decoded = await decodeCardForgeProjectPackage(await encodeCardForgeProjectPackage(snapshot));
    const hydrated = hydrateCardForgeProjectSnapshot(decoded);
    expect(hydrated.customFonts?.[0]?.dataUrl).toBe(tinyFontData);
    expect(hydrated.customFonts?.[0]?.mimeType).toBe('font/woff2');
    expect(hydrated.customFonts?.[0]?.value).toBe('font-personal-fontasset123');
  });

  it('refuses an asset whose bytes no longer match the content-addressed manifest', async () => {
    const snapshot = await buildCardForgeProjectSnapshot({ document: createProject(), name: 'Integrity Test' });
    const bytes = await encodeCardForgeProjectPackage(snapshot);
    const zip = await JSZip.loadAsync(bytes);
    const descriptor = snapshot.manifest.assets[0]!;
    zip.file(descriptor.path, new Uint8Array(descriptor.size).fill(7), { compression: 'STORE' });
    const tampered = await zip.generateAsync({ type: 'uint8array', compression: 'STORE' });

    await expect(decodeCardForgeProjectPackage(tampered)).rejects.toThrow(/integrity|unexpected size/iu);
  });

  it('refuses a manifest revision that does not match the packaged project state', async () => {
    const snapshot = await buildCardForgeProjectSnapshot({ document: createProject(), name: 'Revision Test' });
    const bytes = await encodeCardForgeProjectPackage(snapshot);
    const zip = await JSZip.loadAsync(bytes);
    const rawManifest = await zip.file(CARDFORGE_PROJECT_MANIFEST_FILE)!.async('string');
    const manifest = JSON.parse(rawManifest) as Record<string, unknown>;
    manifest.name = 'Changed without revision';
    const project = manifest.project as Record<string, unknown>;
    project.activeCardSetId = 'different-set';
    zip.file(CARDFORGE_PROJECT_MANIFEST_FILE, JSON.stringify(manifest), { compression: 'STORE' });
    const tampered = await zip.generateAsync({ type: 'uint8array', compression: 'STORE' });

    await expect(decodeCardForgeProjectPackage(tampered)).rejects.toThrow(/revision/iu);
  });

  it('rejects archive entries outside the exact manifest instead of accepting hidden payloads', async () => {
    const snapshot = await buildCardForgeProjectSnapshot({ document: createProject(), name: 'Unexpected Entry' });
    const zip = await JSZip.loadAsync(await encodeCardForgeProjectPackage(snapshot));
    zip.file('unexpected/bomb.bin', 'not part of the manifest', { compression: 'DEFLATE' });

    await expect(decodeCardForgeProjectPackage(
      await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }),
    )).rejects.toThrow(/unexpected entries/iu);
  });

  it('rejects pathological archive entry counts before reading payloads', async () => {
    const zip = new JSZip();
    for (let index = 0; index < MAX_PROJECT_PACKAGE_ASSETS + 3; index += 1) {
      zip.file(`entry-${index}.txt`, '');
    }

    await expect(decodeCardForgeProjectPackage(
      await zip.generateAsync({ type: 'uint8array', compression: 'STORE' }),
    )).rejects.toThrow(/too many entries/iu);
  }, 30_000);

  it('rejects an oversized manifest before parsing or allocating project assets', async () => {
    const zip = new JSZip();
    zip.file(CARDFORGE_PROJECT_MANIFEST_FILE, 'x'.repeat(MAX_PROJECT_PACKAGE_METADATA_BYTES + 1), { compression: 'STORE' });

    await expect(decodeCardForgeProjectPackage(
      await zip.generateAsync({ type: 'uint8array', compression: 'STORE' }),
    )).rejects.toThrow(/manifest is too large/iu);
  }, 30_000);
});
