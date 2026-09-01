import { describe, expect, it } from 'vitest';

import { createProjectScaleFixture } from '../fixtures/projectScale';
import {
  CARDFORGE_PROJECT_PACKAGE_VERSION,
  buildCardForgeProjectSnapshot,
  createCardForgeProjectPackageBlob,
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

  it.each([100, 500, 1000] as const)('round-trips %i unique illustrated Artifacts and streams output without retaining archive chunks', async (cardCount) => {
    const fixture = createProjectScaleFixture(cardCount, { uniqueArtwork: true });

    const snapshot = await buildCardForgeProjectSnapshot({
      document: fixture,
      name: `${cardCount} Illustrated Artifacts`,
      savedAt: '2026-08-31T12:00:00.000Z',
    });
    expect(snapshot.manifest.cardforgeProject).toBe(CARDFORGE_PROJECT_PACKAGE_VERSION);
    expect(snapshot.manifest.assets).toHaveLength(cardCount);

    let chunkCount = 0;
    let encodedBytes = 0;
    let largestChunkBytes = 0;
    await writeCardForgeProjectPackage(snapshot, new WritableStream<Uint8Array>({
      write: (chunk) => {
        chunkCount += 1;
        encodedBytes += chunk.byteLength;
        largestChunkBytes = Math.max(largestChunkBytes, chunk.byteLength);
      },
    }));
    expect(chunkCount).toBeGreaterThan(1);
    expect(largestChunkBytes).toBeLessThan(encodedBytes);
    const decoded = await decodeCardForgeProjectPackage(await createCardForgeProjectPackageBlob(snapshot));
    const hydrated = hydrateCardForgeProjectSnapshot(decoded);

    expect(hydrated.storedCards).toHaveLength(cardCount);
    expect(hydrated.storedCards[cardCount - 1]?.data.artwork).toBe(fixture.storedCards[cardCount - 1]?.data.artwork);
    expect(decoded.manifest.projectRevision).toBe(snapshot.manifest.projectRevision);
  }, 60_000);
});
