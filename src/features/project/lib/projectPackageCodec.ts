import {
  BlobReader,
  TextWriter,
  Uint8ArrayWriter,
  ZipReader,
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
  type ProjectPackageAssetSource,
  type ProjectPackageAssetMimeType,
  type ResolvedProjectPackageAssetReference,
} from '../model/projectPackage';
import {
  parseProjectDocumentFile,
  parseProjectDocumentValue,
  type ProjectDocumentV1,
} from '../model/projectDocument';
import { assertProjectPackageBounds } from './projectPackageBounds';
import { ProjectPackageError } from './projectPackageError';

export { ProjectPackageError } from './projectPackageError';
export {
  createCardForgeProjectPackageBlob,
  encodeCardForgeProjectPackage,
  writeCardForgeProjectPackage,
} from './projectPackageWriter';

const encoder = new TextEncoder();

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
  assets: Map<string, { descriptor: ProjectPackageAssetDescriptor; source: ProjectPackageAssetSource }>,
  resolveAssetReference?: (reference: string) => Promise<ResolvedProjectPackageAssetReference | null>,
  referenceResults = new Map<string, Promise<string>>(),
  depth = 0,
): Promise<unknown> => {
  if (depth > 80) throw new ProjectPackageError('This project is nested too deeply to package safely.');
  if (typeof value === 'string') {
    const prepare = async () => {
      const embedded = decodeEmbeddedDataUri(value);
      const resolved: ResolvedProjectPackageAssetReference | null = embedded
        ? { mimeType: embedded.mimeType, bytes: embedded.bytes }
        : await resolveAssetReference?.(value) ?? null;
      if (!resolved && value.startsWith('cardforge-browser-asset://')) {
        throw new ProjectPackageError('Browser project artwork could not be materialized into this portable file.');
      }
      if (!resolved) return value;
      const source: ProjectPackageAssetSource = 'bytes' in resolved ? resolved.bytes : resolved.source;
      const declaredSize = source instanceof Uint8Array ? source.byteLength : source.size;
      if (!isProjectPackageAssetMimeType(resolved.mimeType)
        || declaredSize <= 0
        || declaredSize > MAX_PROJECT_PACKAGE_ASSET_BYTES) {
        throw new ProjectPackageError(`Portable project assets must use a supported type and be ${Math.round(MAX_PROJECT_PACKAGE_ASSET_BYTES / 1024 / 1024)} MB or smaller per file.`);
      }
      const verificationBytes = source instanceof Uint8Array ? source : await source.load();
      if (!(verificationBytes instanceof Uint8Array) || verificationBytes.byteLength !== declaredSize) {
        throw new ProjectPackageError('One portable project asset changed while its package manifest was being prepared.');
      }
      const id = await hashBytes(verificationBytes);
      if (!assets.has(id)) {
        if (assets.size >= MAX_PROJECT_PACKAGE_ASSETS) {
          throw new ProjectPackageError(`A portable CardForge project can contain at most ${MAX_PROJECT_PACKAGE_ASSETS} embedded asset files.`);
        }
        assets.set(id, {
          descriptor: {
            id,
            mimeType: resolved.mimeType,
            size: declaredSize,
            path: `assets/${id}.${getProjectPackageAssetExtension(resolved.mimeType)}`,
          },
          source,
        });
      }
      return getProjectPackageAssetReference(id);
    };
    const cacheable = value.startsWith('data:') || value.startsWith('cardforge-browser-asset://');
    if (!cacheable) return prepare();
    let result = referenceResults.get(value);
    if (!result) {
      result = prepare();
      referenceResults.set(value, result);
    }
    return result;
  }
  if (Array.isArray(value)) {
    const entries: unknown[] = [];
    for (const entry of value) {
      entries.push(await externalizeProjectAssets(entry, assets, resolveAssetReference, referenceResults, depth + 1));
    }
    return entries;
  }
  if (isRecord(value)) {
    const entries: Array<[string, unknown]> = [];
    for (const [key, entry] of Object.entries(value)) {
      entries.push([key, await externalizeProjectAssets(entry, assets, resolveAssetReference, referenceResults, depth + 1)]);
    }
    return Object.fromEntries(entries);
  }
  return value;
};

const hydrateProjectAssets = (
  value: unknown,
  descriptors: ReadonlyMap<string, ProjectPackageAssetDescriptor>,
  assets: CardForgeProjectPackageSnapshot['assets'],
  depth = 0,
): unknown => {
  if (depth > 80) throw new ProjectPackageError('This project is nested too deeply to open safely.');
  if (typeof value === 'string') {
    const id = getProjectPackageAssetIdFromReference(value);
    if (!id) return value;
    const descriptor = descriptors.get(id);
    const source = assets.get(id);
    if (!descriptor || !(source instanceof Uint8Array)) {
      throw new ProjectPackageError(`This project is missing required asset ${id.slice(0, 12)}….`);
    }
    const bytes = source;
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
  assertProjectPackageBounds(manifest);
  return manifest;
};

export const buildCardForgeProjectSnapshot = async ({
  document,
  name,
  resolveAssetReference,
  savedAt = new Date().toISOString(),
}: {
  document: ProjectDocumentV1;
  name: string;
  resolveAssetReference?: (reference: string) => Promise<ResolvedProjectPackageAssetReference | null>;
  savedAt?: string;
}): Promise<CardForgeProjectPackageSnapshotV2> => {
  const assets = new Map<string, { descriptor: ProjectPackageAssetDescriptor; source: ProjectPackageAssetSource }>();
  const externalized = await externalizeProjectAssets(toPortableProjectDocument(document), assets, resolveAssetReference) as PortableProjectDocumentV2;
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
  assertProjectPackageBounds(manifest);
  return {
    manifest,
    assets: new Map([...assets.entries()].map(([id, asset]) => [id, asset.source])),
  };
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
    if (entries.length > MAX_PROJECT_PACKAGE_ASSETS + 2) {
      throw new ProjectPackageError('This project archive contains too many entries to open safely.');
    }
    const entriesByName = new Map(entries.map((entry) => [entry.filename, entry]));
    if (entriesByName.size !== entries.length) {
      throw new ProjectPackageError('This project archive contains duplicate entry paths.');
    }
    const declaredExpandedBytes = entries.reduce((total, entry) => {
      const size = entry.uncompressedSize ?? 0;
      if (!Number.isSafeInteger(size) || size < 0) {
        throw new ProjectPackageError('This project archive contains an invalid entry size.');
      }
      return total + size;
    }, 0);
    if (declaredExpandedBytes > MAX_PROJECT_PACKAGE_BYTES + MAX_PROJECT_PACKAGE_METADATA_BYTES) {
      throw new ProjectPackageError('This project archive expands beyond the safe portable-file limit.');
    }
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
    const expectedEntryPaths = new Set([
      CARDFORGE_PROJECT_MANIFEST_FILE,
      ...manifest.assets.map((asset) => asset.path),
    ]);
    const expectedDirectoryPaths = new Set(
      manifest.assets.flatMap((asset) => {
        const separator = asset.path.lastIndexOf('/');
        return separator > 0 ? [asset.path.slice(0, separator + 1)] : [];
      }),
    );
    const payloadEntryPaths = new Set(entries.filter((entry) => !entry.directory).map((entry) => entry.filename));
    if (payloadEntryPaths.size !== expectedEntryPaths.size
      || [...payloadEntryPaths].some((path) => !expectedEntryPaths.has(path))
      || entries.some((entry) => entry.directory && !expectedDirectoryPaths.has(entry.filename))) {
      throw new ProjectPackageError('This project archive contains unexpected entries.');
    }
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
