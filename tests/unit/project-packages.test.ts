import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import {
  buildCardForgeProjectSnapshot,
  decodeCardForgeProjectPackage,
  encodeCardForgeProjectPackage,
  hydrateCardForgeProjectSnapshot,
} from '@/features/project/lib/projectPackageCodec';
import {
  CARDFORGE_PROJECT_ASSET_REFERENCE_PREFIX,
  CARDFORGE_PROJECT_MANIFEST_FILE,
} from '@/features/project/model/projectPackage';
import type { ProjectDocumentV1 } from '@/features/project/model/projectDocument';

const onePixelPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2ZxQAAAAASUVORK5CYII=';

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
  cardSets: [{ id: 'set-1', name: 'Clash of Fists', frontTemplateId: 'template-1', backingTemplateId: null }],
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
    expect(snapshot.manifest.project.storedCards[0]!.data.artwork).toMatch(new RegExp(`^${CARDFORGE_PROJECT_ASSET_REFERENCE_PREFIX}`));
    expect(snapshot.manifest.project.userTemplates[0]!.freeformCanvas?.elements[0]?.imageSource).toMatch(new RegExp(`^${CARDFORGE_PROJECT_ASSET_REFERENCE_PREFIX}`));

    const bytes = await encodeCardForgeProjectPackage(snapshot);
    const decoded = await decodeCardForgeProjectPackage(bytes);
    const hydrated = hydrateCardForgeProjectSnapshot(decoded);

    expect(decoded.manifest.projectRevision).toBe(snapshot.manifest.projectRevision);
    expect(hydrated.storedCards[0]!.data.artwork).toBe(onePixelPng);
    expect(hydrated.userTemplates[0]!.freeformCanvas?.elements[0]?.imageSource).toBe(onePixelPng);
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

  it('keeps folder access local-only and never exposes a filesystem path to the server contract', () => {
    const localAdapter = readFileSync(
      resolve(process.cwd(), 'src/features/project/client/localProjectFolder.ts'),
      'utf8',
    );
    const packageModel = readFileSync(
      resolve(process.cwd(), 'src/features/project/model/projectPackage.ts'),
      'utf8',
    );

    expect(localAdapter).toContain('showDirectoryPicker');
    expect(localAdapter).toContain('serverReachable: false');
    expect(localAdapter).toContain('FileSystemDirectoryHandle');
    expect(packageModel).toContain("'browser' | 'local-folder' | 'google-drive'");
    expect(localAdapter).not.toContain('directory.path');
  });
});
