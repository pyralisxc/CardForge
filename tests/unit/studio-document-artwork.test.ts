import { describe, expect, it } from 'vitest';

import {
  collectStudioDocumentAssetIds,
  getStudioDocumentAssetReference,
  replaceStudioDocumentAssetReferences,
} from '@/features/studio-documents/assetReferences';
import { normalizeMcpArtworkSource } from '@/features/studio-documents/server/mcpArtworkSources';

describe('Studio document artwork references', () => {
  it('deduplicates content-addressed ids and hydrates every matching reference', () => {
    const first = 'a'.repeat(64);
    const second = 'b'.repeat(64);
    const value = {
      template: { image: getStudioDocumentAssetReference(first) },
      cards: [
        { artwork: getStudioDocumentAssetReference(first) },
        { artwork: getStudioDocumentAssetReference(second) },
      ],
    };

    expect(collectStudioDocumentAssetIds(value)).toEqual([first, second]);
    expect(replaceStudioDocumentAssetReferences(value, new Map([
      [first, 'data:image/webp;base64,FIRST'],
      [second, 'data:image/webp;base64,SECOND'],
    ]))).toEqual({
      template: { image: 'data:image/webp;base64,FIRST' },
      cards: [
        { artwork: 'data:image/webp;base64,FIRST' },
        { artwork: 'data:image/webp;base64,SECOND' },
      ],
    });
  });
});

describe('MCP artwork source safety', () => {
  it('requires exactly one artwork transport', async () => {
    await expect(normalizeMcpArtworkSource({ mimeType: 'image/png' })).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('exactly one source'),
    });
    await expect(normalizeMcpArtworkSource({
      mimeType: 'image/png',
      data: 'AAAA',
      sourceUrl: 'https://example.com/art.png',
    })).rejects.toMatchObject({ status: 400 });
  });

  it('rejects local URL fetches before attempting artwork download', async () => {
    await expect(normalizeMcpArtworkSource({
      mimeType: 'image/png',
      sourceUrl: 'https://localhost/art.png',
    })).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('public host'),
    });
  });
});
