import {
  BlobWriter,
  TextReader,
  Uint8ArrayReader,
  ZipWriter,
} from '@zip.js/zip.js';

import {
  CARDFORGE_PROJECT_MANIFEST_FILE,
  MAX_PROJECT_PACKAGE_BYTES,
  MAX_PROJECT_PACKAGE_METADATA_BYTES,
  type CardForgeProjectPackageSnapshot,
} from '../model/projectPackage';
import { assertProjectPackageBounds } from './projectPackageBounds';
import { ProjectPackageError } from './projectPackageError';

const addSnapshotEntries = async (
  zip: ZipWriter<unknown>,
  snapshot: CardForgeProjectPackageSnapshot,
) => {
  await zip.add(
    CARDFORGE_PROJECT_MANIFEST_FILE,
    new TextReader(JSON.stringify(snapshot.manifest, null, 2)),
    { level: 0 },
  );
  for (const descriptor of snapshot.manifest.assets) {
    const bytes = await loadSnapshotAssetBytes(snapshot, descriptor.id, descriptor.size);
    await zip.add(descriptor.path, new Uint8ArrayReader(bytes), { level: 0 });
  }
};

const hashAssetBytes = async (bytes: Uint8Array): Promise<string> => {
  if (!globalThis.crypto?.subtle) {
    throw new ProjectPackageError('Secure project fingerprinting is unavailable in this environment.');
  }
  const input = new Uint8Array(bytes.byteLength);
  input.set(bytes);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', input.buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const loadSnapshotAssetBytes = async (
  snapshot: CardForgeProjectPackageSnapshot,
  assetId: string,
  expectedSize: number,
): Promise<Uint8Array> => {
  const source = snapshot.assets.get(assetId);
  const sourceSize = source instanceof Uint8Array ? source.byteLength : source?.size;
  if (!source || sourceSize !== expectedSize) {
    throw new ProjectPackageError(`Packaged asset ${assetId.slice(0, 12)}… does not match its manifest.`);
  }
  const bytes = source instanceof Uint8Array ? source : await source.load();
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== expectedSize) {
    throw new ProjectPackageError(`Packaged asset ${assetId.slice(0, 12)}… changed size while it was being written.`);
  }
  if (await hashAssetBytes(bytes) !== assetId) {
    throw new ProjectPackageError(`Packaged asset ${assetId.slice(0, 12)}… failed its integrity check while it was being written.`);
  }
  return bytes;
};

const assertSnapshotAssetSources = (snapshot: CardForgeProjectPackageSnapshot) => {
  for (const descriptor of snapshot.manifest.assets) {
    const source = snapshot.assets.get(descriptor.id);
    const sourceSize = source instanceof Uint8Array ? source.byteLength : source?.size;
    if (!source || sourceSize !== descriptor.size) {
      throw new ProjectPackageError(`Packaged asset ${descriptor.id.slice(0, 12)}… does not match its manifest.`);
    }
  }
};

const normalizeWriterError = (error: unknown) => error instanceof ProjectPackageError
  ? error
  : new ProjectPackageError('The CardForge project package could not be written safely.');

export const writeCardForgeProjectPackage = async (
  snapshot: CardForgeProjectPackageSnapshot,
  writable: WritableStream<Uint8Array>,
): Promise<void> => {
  const destination = writable.getWriter();
  try {
    assertProjectPackageBounds(snapshot.manifest);
    assertSnapshotAssetSources(snapshot);
    let encodedBytes = 0;
    const boundedWritable = new WritableStream<Uint8Array>({
      write: async (chunk) => {
        encodedBytes += chunk.byteLength;
        if (encodedBytes > MAX_PROJECT_PACKAGE_BYTES + MAX_PROJECT_PACKAGE_METADATA_BYTES) {
          throw new ProjectPackageError('The encoded CardForge project exceeds the safe portable-file limit.');
        }
        await destination.write(chunk);
      },
      close: () => destination.close(),
      abort: (reason) => destination.abort(reason),
    });
    const zip = new ZipWriter(boundedWritable);
    await addSnapshotEntries(zip, snapshot);
    await zip.close();
  } catch (error) {
    await destination.abort(error).catch(() => undefined);
    throw normalizeWriterError(error);
  }
};

/** Complete-body fallback for fetch/File boundaries, using the same writer. */
export const createCardForgeProjectPackageBlob = async (
  snapshot: CardForgeProjectPackageSnapshot,
): Promise<Blob> => {
  const writer = new BlobWriter('application/vnd.cardforge.project+zip');
  const zip = new ZipWriter(writer);
  assertProjectPackageBounds(snapshot.manifest);
  assertSnapshotAssetSources(snapshot);
  let output: Blob;
  try {
    await addSnapshotEntries(zip, snapshot);
    output = await zip.close();
  } catch (error) {
    throw normalizeWriterError(error);
  }
  if (output.size > MAX_PROJECT_PACKAGE_BYTES + MAX_PROJECT_PACKAGE_METADATA_BYTES) {
    throw new ProjectPackageError('The encoded CardForge project exceeds the safe portable-file limit.');
  }
  return output;
};

export const encodeCardForgeProjectPackage = async (
  snapshot: CardForgeProjectPackageSnapshot,
): Promise<Uint8Array> => new Uint8Array(
  await (await createCardForgeProjectPackageBlob(snapshot)).arrayBuffer(),
);
