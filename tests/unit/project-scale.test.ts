import { describe, expect, it } from 'vitest';

import { createProjectScaleFixture } from '../fixtures/projectScale';
import {
  CARDFORGE_PROJECT_PACKAGE_VERSION,
  buildCardForgeProjectSnapshot,
  decodeCardForgeProjectPackage,
  hydrateCardForgeProjectSnapshot,
  parseProjectDocumentValue,
  writeCardForgeProjectPackage,
} from '@/features/project/client';

describe('Project scale fixtures', () => {
  it.each([100, 500, 1000] as const)('keeps all %i authored cards and positions through document parsing', (cardCount) => {
    const fixture = createProjectScaleFixture(cardCount);
    const parsed = parseProjectDocumentValue(JSON.parse(JSON.stringify(fixture)));

    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error(parsed.error);
    expect(parsed.document.storedCards).toHaveLength(cardCount);
    expect(Object.keys(parsed.document.cardSets[0]?.organization?.positions ?? {})).toHaveLength(cardCount);
    expect(new Set(parsed.document.storedCards.map((card) => card.uniqueId)).size).toBe(cardCount);
    expect(parsed.document.storedCards.at(-1)?.data.cardName).toBe(`Scale Card ${String(cardCount).padStart(4, '0')}`);
  });

  it('round-trips 1,000 unique illustrated Artifacts through the streaming package writer', async () => {
    const fixture = createProjectScaleFixture(1000, { uniqueArtwork: true });

    const snapshot = await buildCardForgeProjectSnapshot({
      document: fixture,
      name: '1,000 Illustrated Artifacts',
      savedAt: '2026-08-31T12:00:00.000Z',
    });
    expect(snapshot.manifest.cardforgeProject).toBe(CARDFORGE_PROJECT_PACKAGE_VERSION);
    expect(snapshot.manifest.assets).toHaveLength(1000);

    const chunks: ArrayBuffer[] = [];
    await writeCardForgeProjectPackage(snapshot, new WritableStream<Uint8Array>({
      write: (chunk) => {
        const copy = new Uint8Array(chunk.byteLength);
        copy.set(chunk);
        chunks.push(copy.buffer);
      },
    }));
    const encodedBytes = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
    const largestChunkBytes = Math.max(...chunks.map((chunk) => chunk.byteLength));
    expect(chunks.length).toBeGreaterThan(1);
    expect(largestChunkBytes).toBeLessThan(encodedBytes);
    const decoded = await decodeCardForgeProjectPackage(new Blob(chunks));
    const hydrated = hydrateCardForgeProjectSnapshot(decoded);

    expect(hydrated.storedCards).toHaveLength(1000);
    expect(hydrated.storedCards[999]?.data.artwork).toBe(fixture.storedCards[999]?.data.artwork);
    expect(decoded.manifest.projectRevision).toBe(snapshot.manifest.projectRevision);
  }, 60_000);
});
