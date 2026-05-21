"use client";

import { BlobReader, BlobWriter, ZipWriter } from '@zip.js/zip.js';

export interface BlobZipArchive {
  addBlob: (path: string, blob: Blob) => Promise<void>;
  close: () => Promise<Blob>;
}

export function createBlobZipArchive(type = 'application/zip'): BlobZipArchive {
  const writer = new ZipWriter(new BlobWriter(type), {
    bufferedWrite: true,
  });

  return {
    addBlob: async (path, blob) => {
      await writer.add(path, new BlobReader(blob));
    },
    close: () => writer.close(),
  };
}
