import { BlobReader, TextWriter, ZipReader } from '@zip.js/zip.js';
import { describe, expect, it } from 'vitest';

import { createBlobZipArchive } from '@/lib/zipArchive';

describe('zip archive helper', () => {
  it('writes named blob entries that can be read back', async () => {
    const archive = createBlobZipArchive();

    await archive.addBlob('cards/card-001-front.txt', new Blob(['front face']));
    await archive.addBlob('cards/card-001-back.txt', new Blob(['back face']));

    const zipBlob = await archive.close();
    const reader = new ZipReader(new BlobReader(zipBlob));
    const entries = await reader.getEntries();
    const names = entries.map((entry) => entry.filename).sort();
    const frontEntry = entries.find((entry) => entry.filename === 'cards/card-001-front.txt');
    const frontText = frontEntry && 'getData' in frontEntry
      ? await frontEntry.getData(new TextWriter())
      : undefined;
    await reader.close();

    expect(zipBlob.type).toBe('application/zip');
    expect(names).toEqual(['cards/card-001-back.txt', 'cards/card-001-front.txt']);
    expect(frontText).toBe('front face');
  });
});
