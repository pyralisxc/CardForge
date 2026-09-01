import {
  BlobReader,
  BlobWriter,
  TextReader,
  TextWriter,
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipReader,
  ZipWriter,
  type Entry,
} from '@zip.js/zip.js';

import { createCardArtifact, getCardFromArtifact } from '@/domain/artifacts';

import {
  CARDFORGE_PROJECT_MANIFEST_FILE,
  CARDFORGE_PROJECT_PACKAGE_VERSION,
  LEGACY_CARDFORGE_PROJECT_PACKAGE_VERSION,
  MAX_PROJECT_PACKAGE_ASSET_BYTES,
  MAX_PROJECT_PACKAGE_ASSETS,
  MAX_PROJECT_PACKAGE_BYTES,
  MAX_PROJECT_PACKAGE_METADATA_BYTES,
  getProjectPackageAssetExtension,
  getProjectPackageAssetIdFromReference,
  getProjectPackageAssetReference,
  isProjectPackageAssetId,
  isProjectPackageAssetMimeType,
  normalizeProjectFileName,
  type CardForgeProjectManifest,
  type CardForgeProjectManifestV2,
  type CardForgeProjectPackageSnapshot,
  type CardForgeProjectPackageSnapshotV2,
  type PortableProjectDocumentV2,
  type ProjectPackageAssetDescriptor,
  type ProjectPackageAssetMimeType,
} from '../model/projectPackage';
import {
  parseProjectDocumentFile,
  parseProjectDocumentValue,
  type ProjectDocumentV1,
} from '../model/projectDocument';

const encoder = new TextEncoder();

export class ProjectPackageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectPackageError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const bytesToHex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

const hashBytes = async (bytes: Uint8Array): Promise<string> => {
  if (!globalThis.crypto?.subtle) throw new ProjectPackageError('Secure project fingerprinting is unavailable in this environment.');
  const input = new Uint8Array(bytes.byteLength);
  input.set(bytes);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', input.buffer);
  return bytesToHex(new Uint8Array(digest));
};

const decodeBase64 = (value: string): Uint8Array => {
  try {
    const binary = globalThis.atob(value.replace(/\s+/gu, ''));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new ProjectPackageError('One embedded project asset contains invalid base64 data.');
  }
};

const encodeBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(bytes.length, offset + chunkSize));
    binary += String.fromCharCode(...chunk);
  }
  return globalThis.btoa(binary);
};

const decodeEmbeddedDataUri = (value: string): { mimeType: ProjectPackageAssetMimeType; bytes: Uint8Array } | null => {
  if (!value.startsWith('data:')) return null;
  const commaIndex = value.indexOf(',');
  if (commaIndex < 0) return null;
  const metadata = value.slice(5, commaIndex).split(';');
  const mimeType = metadata[0]?.toLowerCase() ?? '';
  if (!isProjectPackageAssetMimeType(mimeType)) return null;
  const payload = value.slice(commaIndex + 1);
  const bytes = metadata.some((entry) => entry.toLowerCase() === 'base64')
    ? decodeBase64(payload)
    : encoder.encode(decodeURIComponent(payload));
  if (bytes.length <= 0 || bytes.length > MAX_PROJECT_PACKAGE_ASSET_BYTES) {
    throw new ProjectPackageError(`Portable project assets must be ${Math.round(MAX_PROJECT_PACKAGE_ASSET_BYTES / 1024 / 1024)} MB or smaller per embedded file.`);
  }
  return { mimeType, bytes };
};

const externalizeProjectAssets = async (
  value: unknown,
  assets: Map<string, { descriptor: ProjectPackageAssetDescriptor; bytes: Uint8Array }>,
  depth = 0,
): Promise<unknown> => {
  if (depth > 80) throw new ProjectPackageError('This project is nested too deeply to package safely.');
  if (typeof value === 'string') {
    const decoded = decodeEmbeddedDataUri(value);
    if (!decoded) return value;
    const id = await hashBytes(decoded.bytes);
    if (!assets.has(id)) {
      if (assets.size >= MAX_PROJECT_PACKAGE_ASSETS) {
        throw new ProjectPackageError(`A portable CardForge project can contain at most ${MAX_PROJECT_PACKAGE_ASSETS} embedded asset files.`);
      }
      assets.set(id, {
        descriptor: {
          id,
          mimeType: decoded.mimeType,
          size: decoded.bytes.length,
          path: `assets/${id}.${getProjectPackageAssetExtension(decoded.mimeType)}`,
        },
        bytes: decoded.bytes,
      });
    }
    return getProjectPackageAssetReference(id);
  }
  if (Array.isArray(value)) {
    return Promise.all(value.map((entry) => externalizeProjectAssets(entry, assets, depth + 1)));
  }
  if (isRecord(value)) {
    const entries = await Promise.all(Object.entries(value).map(async ([key, entry]) => (
      [key, await externalizeProjectAssets(entry, assets, depth + 1)] as const
    )));
    return Object.fromEntries(entries);
  }
  return value;
};

const hydrateProjectAssets = (
  value: unknown,
  descriptors: ReadonlyMap<string, ProjectPackageAssetDescriptor>,
  assets: ReadonlyMap<string, Uint8Array>,
  depth = 0,
): unknown => {
  if (depth > 80) throw new ProjectPackageError('This project is nested too deeply to open safely.');
  if (typeof value === 'string') {
    const id = getProjectPackageAssetIdFromReference(value);
    if (!id) return value;
    const descriptor = descriptors.get(id);
    const bytes = assets.get(id);
    if (!descriptor || !bytes) throw new ProjectPackageError(`This project is missing required asset ${id.slice(0, 12)}….`);
    return `data:${descriptor.mimeType};base64,${encodeBase64(bytes)}`;
  }
  if (Array.isArray(value)) return value.map((entry) => hydrateProjectAssets(entry, descriptors, assets, depth + 1));
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => (
      [key, hydrateProjectAssets(entry, descriptors, assets, depth + 1)]
    )));
  }
  return value;
};

const getRevisionPayload = (project: unknown, assets: ProjectPackageAssetDescriptor[]) => JSON.stringify({ project, assets });

const calculateProjectRevision = async (
  project: unknown,
  assets: ProjectPackageAssetDescriptor[],
): Promise<string> => hashBytes(encoder.encode(getRevisionPayload(project, assets)));

const getManifestByteLength = (manifest: CardForgeProjectManifest): number => encoder.encode(JSON.stringify(manifest)).length;

const assertPackageBounds = (manifest: CardForgeProjectManifest) => {
  const metadataBytes = getManifestByteLength(manifest);
  if (metadataBytes > MAX_PROJECT_PACKAGE_METADATA_BYTES) {
    throw new ProjectPackageError(`This project has more than ${Math.round(MAX_PROJECT_PACKAGE_METADATA_BYTES / 1024 / 1024)} MB of non-asset data.`);
  }
  const totalBytes = metadataBytes + manifest.assets.reduce((total, asset) => total + asset.size, 0);
  if (totalBytes > MAX_PROJECT_PACKAGE_BYTES) {
    throw new ProjectPackageError(`This portable project is larger than the ${Math.round(MAX_PROJECT_PACKAGE_BYTES / 1024 / 1024)} MB safe package limit.`);
  }
};

const normalizeAssetDescriptor = (value: unknown): ProjectPackageAssetDescriptor | null => {
  if (!isRecord(value)) return null;
  const id = typeof value.id === 'string' ? value.id : '';
  const mimeType = typeof value.mimeType === 'string' ? value.mimeType : '';
  const size = typeof value.size === 'number' ? value.size : Number.NaN;
  const path = typeof value.path === 'string' ? value.path : '';
  if (!isProjectPackageAssetId(id) || !isProjectPackageAssetMimeType(mimeType)) return null;
  if (!Number.isInteger(size) || size <= 0 || size > MAX_PROJECT_PACKAGE_ASSET_BYTES) return null;
  const expectedPath = `assets/${id}.${getProjectPackageAssetExtension(mimeType)}`;
  if (path !== expectedPath) return null;
  return { id, mimeType, size, path };
};

const toPortableProjectDocument = (document: ProjectDocumentV1): PortableProjectDocumentV2 => {
  const { storedCards, ...project } = document;
  return {
    ...project,
    version: 2,
    artifacts: storedCards.map(createCardArtifact),
  };
};

const toRuntimeProjectDocument = (document: PortableProjectDocumentV2): ProjectDocumentV1 => {
  const { artifacts, ...project } = document;
  return {
    ...project,
    version: 1,
    storedCards: artifacts.map(getCardFromArtifact),
  };
};

const parsePortableProjectDocument = (value: unknown): PortableProjectDocumentV2 | null => {
  if (!isRecord(value) || value.version !== 2 || !Array.isArray(value.artifacts)) return null;
  const artifacts = value.artifacts.flatMap((artifact) => {
    if (!isRecord(artifact)
      || artifact.artifactType !== 'card'
      || typeof artifact.artifactId !== 'string'
      || typeof artifact.setId !== 'string'
      || !isRecord(artifact.card)) return [];
    return [artifact];
  });
  if (artifacts.length !== value.artifacts.length) return null;
  const runtime = parseProjectDocumentValue({
    ...value,
    version: 1,
    storedCards: artifacts.map((artifact) => artifact.card),
  });
  if (!runtime.success) return null;
  return toPortableProjectDocument(runtime.document);
};

const parseManifest = async (value: unknown): Promise<CardForgeProjectManifest> => {
  if (!isRecord(value)
    || (value.cardforgeProject !== CARDFORGE_PROJECT_PACKAGE_VERSION
      && value.cardforgeProject !== LEGACY_CARDFORGE_PROJECT_PACKAGE_VERSION)) {
    throw new ProjectPackageError('Unsupported CardForge project package version.');
  }
  const name = typeof value.name === 'string' ? normalizeProjectFileName(value.name) : '';
  const projectRevision = typeof value.projectRevision === 'string' ? value.projectRevision : '';
  const savedAt = typeof value.savedAt === 'string' ? value.savedAt : '';
  const rawAssets = Array.isArray(value.assets) ? value.assets : [];
  if (!name || !isProjectPackageAssetId(projectRevision) || Number.isNaN(Date.parse(savedAt))) {
    throw new ProjectPackageError('The CardForge project manifest is incomplete or invalid.');
  }
  if (rawAssets.length > MAX_PROJECT_PACKAGE_ASSETS) {
    throw new ProjectPackageError(`This project contains more than ${MAX_PROJECT_PACKAGE_ASSETS} packaged assets.`);
  }
  const assets = rawAssets.map(normalizeAssetDescriptor);
  if (assets.some((asset) => asset === null)) throw new ProjectPackageError('The CardForge project contains an invalid asset manifest entry.');
  const normalizedAssets = assets as ProjectPackageAssetDescriptor[];
  const ids = new Set(normalizedAssets.map((asset) => asset.id));
  const paths = new Set(normalizedAssets.map((asset) => asset.path));
  if (ids.size !== normalizedAssets.length || paths.size !== normalizedAssets.length) {
    throw new ProjectPackageError('The CardForge project contains duplicate packaged assets.');
  }
  const isLegacy = value.cardforgeProject === LEGACY_CARDFORGE_PROJECT_PACKAGE_VERSION;
  const parsedProject = isLegacy ? parseProjectDocumentValue(value.project) : null;
  const portableProject = isLegacy ? null : parsePortableProjectDocument(value.project);
  if (isLegacy && !parsedProject?.success) {
    throw new ProjectPackageError(parsedProject?.error ?? 'The CardForge project document is invalid.');
  }
  if (!isLegacy && !portableProject) {
    throw new ProjectPackageError('The CardForge project artifact document is invalid.');
  }
  const expectedRevision = await calculateProjectRevision(value.project, normalizedAssets);
  if (expectedRevision !== projectRevision) {
    throw new ProjectPackageError('The CardForge project manifest changed without a matching project revision.');
  }
  let manifest: CardForgeProjectManifest;
  if (isLegacy) {
    if (!parsedProject?.success) throw new ProjectPackageError('The CardForge project document is invalid.');
    manifest = {
      cardforgeProject: LEGACY_CARDFORGE_PROJECT_PACKAGE_VERSION,
      name,
      projectRevision,
      savedAt,
      project: parsedProject.document,
      assets: normalizedAssets,
    };
  } else {
    if (!portableProject) throw new ProjectPackageError('The CardForge project artifact document is invalid.');
    manifest = {
      cardforgeProject: CARDFORGE_PROJECT_PACKAGE_VERSION,
      name,
      projectRevision,
      savedAt,
      project: portableProject,
      assets: normalizedAssets,
    };
  }
  assertPackageBounds(manifest);
  return manifest;
};

export const buildCardForgeProjectSnapshot = async ({
  document,
  name,
  savedAt = new Date().toISOString(),
}: {
  document: ProjectDocumentV1;
  name: string;
  savedAt?: string;
}): Promise<CardForgeProjectPackageSnapshotV2> => {
  const assets = new Map<string, { descriptor: ProjectPackageAssetDescriptor; bytes: Uint8Array }>();
  const externalized = await externalizeProjectAssets(toPortableProjectDocument(document), assets) as PortableProjectDocumentV2;
  const descriptors = [...assets.values()].map(({ descriptor }) => descriptor).sort((left, right) => left.id.localeCompare(right.id));
  const projectRevision = await calculateProjectRevision(externalized, descriptors);
  const manifest: CardForgeProjectManifestV2 = {
    cardforgeProject: CARDFORGE_PROJECT_PACKAGE_VERSION,
    name: normalizeProjectFileName(name),
    projectRevision,
    savedAt,
    project: externalized,
    assets: descriptors,
  };
  assertPackageBounds(manifest);
  return {
    manifest,
    assets: new Map([...assets.entries()].map(([id, asset]) => [id, asset.bytes])),
  };
};

export const encodeCardForgeProjectPackage = async (
  snapshot: CardForgeProjectPackageSnapshot,
): Promise<Uint8Array> => {
  assertPackageBounds(snapshot.manifest);
  const writer = new BlobWriter('application/zip');
  const zip = new ZipWriter(writer);
  await addSnapshotEntries(zip, snapshot);
  const output = await zip.close();
  const encoded = new Uint8Array(await output.arrayBuffer());
  if (encoded.byteLength > MAX_PROJECT_PACKAGE_BYTES + MAX_PROJECT_PACKAGE_METADATA_BYTES) {
    throw new ProjectPackageError('The encoded CardForge project exceeds the safe portable-file limit.');
  }
  return encoded;
};

const addSnapshotEntries = async (
  zip: ZipWriter<unknown>,
  snapshot: CardForgeProjectPackageSnapshot,
) => {
  try {
    await zip.add(
      CARDFORGE_PROJECT_MANIFEST_FILE,
      new TextReader(JSON.stringify(snapshot.manifest, null, 2)),
      { level: 0 },
    );
    for (const descriptor of snapshot.manifest.assets) {
      const bytes = snapshot.assets.get(descriptor.id);
      if (!bytes || bytes.length !== descriptor.size) {
        throw new ProjectPackageError(`Packaged asset ${descriptor.id.slice(0, 12)}… does not match its manifest.`);
      }
      await zip.add(descriptor.path, new Uint8ArrayReader(bytes), { level: 0 });
    }
  } catch (error) {
    await zip.close().catch(() => undefined);
    if (error instanceof ProjectPackageError) throw error;
    throw new ProjectPackageError('The CardForge project package could not be written safely.');
  }
};

/**
 * Writes directly to a browser/file-provider stream. The Uint8Array encoder is
 * retained as the bounded compatibility fallback for providers that require a
 * complete request body.
 */
export const writeCardForgeProjectPackage = async (
  snapshot: CardForgeProjectPackageSnapshot,
  writable: WritableStream<Uint8Array>,
): Promise<void> => {
  assertPackageBounds(snapshot.manifest);
  const destination = writable.getWriter();
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
};

export const decodeCardForgeProjectPackage = async (
  input: Uint8Array | ArrayBuffer | Blob,
): Promise<CardForgeProjectPackageSnapshot> => {
  const inputBytes = input instanceof Blob ? input.size : input.byteLength;
  if (inputBytes <= 0 || inputBytes > MAX_PROJECT_PACKAGE_BYTES + MAX_PROJECT_PACKAGE_METADATA_BYTES) {
    throw new ProjectPackageError('This CardForge project file is empty or exceeds the safe portable-file limit.');
  }
  let inputBlob: Blob;
  if (input instanceof Blob) inputBlob = input;
  else if (input instanceof Uint8Array) {
    const copied = new Uint8Array(input.byteLength);
    copied.set(input);
    inputBlob = new Blob([copied.buffer]);
  } else inputBlob = new Blob([input]);
  let zip: ZipReader<Blob>;
  let entries: Entry[];
  try {
    zip = new ZipReader(new BlobReader(inputBlob), { strictness: 'strict' });
    entries = await zip.getEntries();
  } catch {
    throw new ProjectPackageError('This file is not a readable CardForge project package.');
  }
  try {
    const entriesByName = new Map(entries.map((entry) => [entry.filename, entry]));
    const manifestEntry = entriesByName.get(CARDFORGE_PROJECT_MANIFEST_FILE);
    if (!manifestEntry) throw new ProjectPackageError(`This package is missing ${CARDFORGE_PROJECT_MANIFEST_FILE}.`);
    if (manifestEntry.directory) throw new ProjectPackageError(`This package has an invalid ${CARDFORGE_PROJECT_MANIFEST_FILE} entry.`);
    if ((manifestEntry.uncompressedSize ?? 0) > MAX_PROJECT_PACKAGE_METADATA_BYTES) {
      throw new ProjectPackageError('The CardForge project manifest is too large to open safely.');
    }
    const manifestText = await manifestEntry.getData!(new TextWriter());
    if (encoder.encode(manifestText).length > MAX_PROJECT_PACKAGE_METADATA_BYTES) {
      throw new ProjectPackageError('The CardForge project manifest is too large to open safely.');
    }
    let manifestValue: unknown;
    try {
      manifestValue = JSON.parse(manifestText);
    } catch {
      throw new ProjectPackageError('The CardForge project manifest contains invalid JSON.');
    }
    const manifest = await parseManifest(manifestValue);
    const assets = new Map<string, Uint8Array>();
    let totalAssetBytes = 0;
    for (const descriptor of manifest.assets) {
      const entry = entriesByName.get(descriptor.path);
      if (!entry) throw new ProjectPackageError(`This package is missing ${descriptor.path}.`);
      if (entry.directory) throw new ProjectPackageError(`This package has an invalid ${descriptor.path} entry.`);
      if (entry.uncompressedSize !== descriptor.size) {
        throw new ProjectPackageError(`Packaged asset ${descriptor.id.slice(0, 12)}… has an unexpected size.`);
      }
      const bytes = await entry.getData!(new Uint8ArrayWriter());
      if (bytes.length !== descriptor.size || bytes.length > MAX_PROJECT_PACKAGE_ASSET_BYTES) {
        throw new ProjectPackageError(`Packaged asset ${descriptor.id.slice(0, 12)}… has an unexpected size.`);
      }
      const actualId = await hashBytes(bytes);
      if (actualId !== descriptor.id) throw new ProjectPackageError(`Packaged asset ${descriptor.id.slice(0, 12)}… failed its integrity check.`);
      totalAssetBytes += bytes.length;
      if (totalAssetBytes + encoder.encode(manifestText).length > MAX_PROJECT_PACKAGE_BYTES) {
        throw new ProjectPackageError('This project expands beyond the safe portable-file limit.');
      }
      assets.set(descriptor.id, bytes);
    }
    return { manifest, assets };
  } finally {
    await zip.close().catch(() => undefined);
  }
};

export const hydrateCardForgeProjectSnapshot = (
  snapshot: CardForgeProjectPackageSnapshot,
): ProjectDocumentV1 => {
  const descriptors = new Map(snapshot.manifest.assets.map((asset) => [asset.id, asset]));
  const hydrated = hydrateProjectAssets(snapshot.manifest.project, descriptors, snapshot.assets);
  const runtime = snapshot.manifest.cardforgeProject === LEGACY_CARDFORGE_PROJECT_PACKAGE_VERSION
    ? hydrated
    : toRuntimeProjectDocument(hydrated as PortableProjectDocumentV2);
  const parsed = parseProjectDocumentValue(runtime);
  if (!parsed.success) throw new ProjectPackageError(parsed.error);
  return parsed.document;
};

export type DecodedProjectFile = {
  document: ProjectDocumentV1;
  name: string;
  sourceRevision: string | null;
  format: 'cardforge-package' | 'legacy-json';
};

export const decodeProjectFile = async (file: File): Promise<DecodedProjectFile> => {
  if (file.name.toLowerCase().endsWith('.cardforge')) {
    const snapshot = await decodeCardForgeProjectPackage(file);
    return {
      document: hydrateCardForgeProjectSnapshot(snapshot),
      name: snapshot.manifest.name,
      sourceRevision: snapshot.manifest.projectRevision,
      format: 'cardforge-package',
    };
  }
  const parsed = parseProjectDocumentFile(await file.text());
  if (!parsed.success) throw new ProjectPackageError(parsed.error);
  return {
    document: parsed.document,
    name: normalizeProjectFileName(file.name.replace(/\.json$/iu, '')),
    sourceRevision: null,
    format: 'legacy-json',
  };
};
