import {
  readStructuredBrowserValue,
  writeStructuredBrowserValue,
} from './structuredBrowserStorage';

export const BROWSER_PROJECT_ASSET_REFERENCE_PREFIX = 'cardforge-browser-asset://';

const DATA_URI_PATTERN = /^data:([^;,]+)(;[^,]*)?,([\s\S]+)$/u;
const CONTENT_ASSET_ID_PATTERN = /^[a-f0-9]{64}$/u;
const MAX_CONTENT_ASSET_BYTES = 32 * 1024 * 1024;
const MAX_TRAVERSAL_DEPTH = 80;

const isSupportedContentType = (value: string): boolean => (
  value.startsWith('image/')
  || value.startsWith('font/')
  || value === 'application/font-woff'
  || value === 'application/x-font-ttf'
  || value === 'application/x-font-opentype'
);

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(bytes.length, offset + chunkSize)));
  }
  return globalThis.btoa(binary);
};

const base64ToBytes = (value: string): Uint8Array => {
  const binary = globalThis.atob(value.replace(/\s+/gu, ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
};

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
};

const parsePersistableDataUri = (value: string): { mimeType: string; bytes: Uint8Array } | null => {
  const match = DATA_URI_PATTERN.exec(value);
  if (!match) return null;
  const mimeType = match[1]?.toLowerCase() ?? '';
  const parameters = match[2] ?? '';
  if (!isSupportedContentType(mimeType) || !parameters.toLowerCase().split(';').includes('base64')) return null;
  try {
    const bytes = base64ToBytes(match[3] ?? '');
    if (bytes.length <= 0) throw new Error('Project artwork contains an empty Base64 payload.');
    if (bytes.length > MAX_CONTENT_ASSET_BYTES) {
      throw new Error('One browser project asset is larger than the 32 MB persistence limit.');
    }
    return { mimeType, bytes };
  } catch (error) {
    throw error instanceof Error ? error : new Error('Project artwork contains invalid Base64 data.');
  }
};

const hashBytes = async (bytes: Uint8Array): Promise<string> => {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', toArrayBuffer(bytes));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const getReference = (assetId: string): string => `${BROWSER_PROJECT_ASSET_REFERENCE_PREFIX}${assetId}`;

export const getBrowserProjectAssetReference = (assetId: string): string => {
  if (!CONTENT_ASSET_ID_PATTERN.test(assetId)) throw new Error('Browser project asset identity is invalid.');
  return getReference(assetId);
};

export const storeBrowserProjectAssetBytes = async ({
  scope,
  assetId,
  mimeType,
  bytes,
}: {
  scope: string;
  assetId: string;
  mimeType: string;
  bytes: Uint8Array;
}): Promise<string> => {
  if (!scope || !CONTENT_ASSET_ID_PATTERN.test(assetId) || !isSupportedContentType(mimeType)) {
    throw new Error('Browser project asset metadata is invalid.');
  }
  if (bytes.byteLength <= 0 || bytes.byteLength > MAX_CONTENT_ASSET_BYTES) {
    throw new Error('Browser project artwork exceeds its safe per-asset persistence limit.');
  }
  await writeStructuredBrowserValue(
    getStorageKey(scope, assetId),
    new Blob([toArrayBuffer(bytes)], { type: mimeType }),
  );
  return getReference(assetId);
};

const getReferenceId = (value: string): string | null => {
  if (!value.startsWith(BROWSER_PROJECT_ASSET_REFERENCE_PREFIX)) return null;
  const assetId = value.slice(BROWSER_PROJECT_ASSET_REFERENCE_PREFIX.length);
  return CONTENT_ASSET_ID_PATTERN.test(assetId) ? assetId : null;
};

const getStorageKey = (scope: string, assetId: string): string => (
  `project-content-asset:${encodeURIComponent(scope)}:${assetId}`
);

export const getBrowserProjectAssetIds = (value: string): string[] => {
  const pattern = /cardforge-browser-asset:\/\/([a-f0-9]{64})/gu;
  return [...new Set(Array.from(value.matchAll(pattern), (match) => match[1]).filter((id): id is string => Boolean(id)))];
};

export const copyBrowserProjectAssets = async ({
  value,
  sourceScope,
  destinationScope,
}: {
  value: string;
  sourceScope: string;
  destinationScope: string;
}): Promise<number> => {
  const assetIds = getBrowserProjectAssetIds(value);
  for (const assetId of assetIds) {
    const blob = await readStructuredBrowserValue<Blob>(getStorageKey(sourceScope, assetId));
    if (!(blob instanceof Blob)) {
      throw new Error(`Guest workspace artwork ${assetId.slice(0, 12)}… is unavailable, so CardForge left both workspaces unchanged.`);
    }
    await writeStructuredBrowserValue(getStorageKey(destinationScope, assetId), blob);
  }
  return assetIds.length;
};

const visitValue = async (
  value: unknown,
  transformString: (value: string) => Promise<string>,
  depth = 0,
): Promise<unknown> => {
  if (depth > MAX_TRAVERSAL_DEPTH) throw new Error('Project artwork is nested too deeply to persist safely.');
  if (typeof value === 'string') return transformString(value);
  if (Array.isArray(value)) return Promise.all(value.map((entry) => visitValue(entry, transformString, depth + 1)));
  if (value && typeof value === 'object') {
    const entries = await Promise.all(Object.entries(value as Record<string, unknown>).map(async ([key, entry]) => (
      [key, await visitValue(entry, transformString, depth + 1)] as const
    )));
    return Object.fromEntries(entries);
  }
  return value;
};

export const externalizeBrowserProjectAssetJson = async (
  value: string,
  scope: string,
): Promise<{ storedValue: string; changed: boolean }> => {
  if (!value.includes(';base64,')) return { storedValue: value, changed: false };
  const parsed = JSON.parse(value) as unknown;
  const pending = new Map<string, Promise<string>>();
  let changed = false;
  const stored = await visitValue(parsed, async (entry) => {
    const decoded = parsePersistableDataUri(entry);
    if (!decoded) return entry;
    let reference = pending.get(entry);
    if (!reference) {
      reference = (async () => {
        const assetId = await hashBytes(decoded.bytes);
        await writeStructuredBrowserValue(
          getStorageKey(scope, assetId),
          new Blob([toArrayBuffer(decoded.bytes)], { type: decoded.mimeType }),
        );
        return getReference(assetId);
      })();
      pending.set(entry, reference);
    }
    changed = true;
    return reference;
  });
  return { storedValue: changed ? JSON.stringify(stored) : value, changed };
};

export const hydrateBrowserProjectAssetJson = async (
  value: string,
  scope: string,
): Promise<string> => {
  if (!value.includes(BROWSER_PROJECT_ASSET_REFERENCE_PREFIX)) return value;
  const parsed = JSON.parse(value) as unknown;
  const pending = new Map<string, Promise<string>>();
  const hydrated = await visitValue(parsed, async (entry) => {
    const assetId = getReferenceId(entry);
    if (!assetId) return entry;
    let dataUri = pending.get(assetId);
    if (!dataUri) {
      dataUri = (async () => {
        const blob = await readStructuredBrowserValue<Blob>(getStorageKey(scope, assetId));
        if (!(blob instanceof Blob)) {
          throw new Error(`Browser artwork ${assetId.slice(0, 12)}… is unavailable. Restore the project recovery copy or import a backup.`);
        }
        const bytes = new Uint8Array(await blob.arrayBuffer());
        return `data:${blob.type || 'application/octet-stream'};base64,${bytesToBase64(bytes)}`;
      })();
      pending.set(assetId, dataUri);
    }
    return dataUri;
  });
  return JSON.stringify(hydrated);
};
