import { describe, expect, it } from 'vitest';

import {
  collectStudioDocumentAssetIds,
  getStudioDocumentAssetReference,
  replaceStudioDocumentAssetReferences,
} from '@/features/studio-documents/assetReferences';
import {
  createMcpArtworkOperationBudget,
  MAX_MCP_ARTWORK_ITEMS_PER_OPERATION,
  normalizeMcpArtworkSource,
} from '@/features/studio-documents/server/mcpArtworkSources';

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
  it('bounds artwork count and aggregate bytes for one MCP write', () => {
    const source = { mimeType: 'image/png' as const, sourceUrl: 'https://example.com/art.png' };
    expect(() => createMcpArtworkOperationBudget(
      Array.from({ length: MAX_MCP_ARTWORK_ITEMS_PER_OPERATION + 1 }, () => source),
    )).toThrow(/at most/i);

    expect(() => createMcpArtworkOperationBudget([
      { mimeType: 'image/png', data: 'A'.repeat(24 * 1024 * 1024) },
      { mimeType: 'image/png', data: 'A'.repeat(24 * 1024 * 1024) },
    ])).toThrow(/aggregate/i);
  });

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
