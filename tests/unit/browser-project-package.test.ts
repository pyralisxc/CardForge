import 'fake-indexeddb/auto';

import { describe, expect, it } from 'vitest';

import type { ProjectDocumentV1 } from '@/features/project/client';
import {
  buildCardForgeProjectSnapshot,
  materializeBrowserProjectSnapshot,
  setProjectPersistenceScope,
} from '@/features/project/client';
import { readStructuredBrowserValue } from '@/features/project/persistence/structuredBrowserStorage';

const artwork = 'data:image/png;base64,aWxsdXN0cmF0ZWQtYXJ0aWZhY3Q=';

const project = (): ProjectDocumentV1 => ({
  version: 1,
  userTemplates: [],
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
});
