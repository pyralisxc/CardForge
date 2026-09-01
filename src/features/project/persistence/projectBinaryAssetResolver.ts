import { BROWSER_PROJECT_ASSET_REFERENCE_PREFIX } from './contentAddressedBrowserAssets';
import { readStructuredBrowserValue } from './structuredBrowserStorage';

export interface ProjectBinaryAssetHandle {
  url: string;
  release: () => void;
}

export interface ProjectBinaryAssetResolver {
  acquire: (reference: string) => Promise<ProjectBinaryAssetHandle>;
  dispose: () => void;
}

interface ProjectBinaryAssetResolverOptions {
  loadBlob: (assetId: string) => Promise<Blob | null>;
  urlApi?: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>;
}

interface ActiveObjectUrl {
  url: string;
  references: number;
}

const getBrowserAssetId = (reference: string): string | null => (
  reference.startsWith(BROWSER_PROJECT_ASSET_REFERENCE_PREFIX)
    ? /^[a-f0-9]{64}$/u.test(reference.slice(BROWSER_PROJECT_ASSET_REFERENCE_PREFIX.length))
      ? reference.slice(BROWSER_PROJECT_ASSET_REFERENCE_PREFIX.length)
      : null
    : null
);

export const isProjectBinaryAssetReference = (value: string | null | undefined): value is string => (
  typeof value === 'string' && getBrowserAssetId(value) !== null
);

const getScopedAssetStorageKey = (scope: string, assetId: string) => (
  `project-content-asset:${encodeURIComponent(scope)}:${assetId}`
);

export const createScopedProjectBinaryAssetResolver = (
  scope: string,
  readBlob: (key: string) => Promise<Blob | null> = readStructuredBrowserValue<Blob>,
  urlApi?: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>,
): ProjectBinaryAssetResolver => createProjectBinaryAssetResolver({
  loadBlob: (assetId) => readBlob(getScopedAssetStorageKey(scope, assetId)),
  ...(urlApi ? { urlApi } : {}),
});

export const createProjectBinaryAssetResolver = ({
  loadBlob,
  urlApi = URL,
}: ProjectBinaryAssetResolverOptions): ProjectBinaryAssetResolver => {
  const active = new Map<string, ActiveObjectUrl>();
  const pending = new Map<string, Promise<ActiveObjectUrl>>();

  const resolveObjectUrl = (assetId: string): Promise<ActiveObjectUrl> => {
    const existing = active.get(assetId);
    if (existing) return Promise.resolve(existing);
    const inFlight = pending.get(assetId);
    if (inFlight) return inFlight;
    const next = (async () => {
      const blob = await loadBlob(assetId);
      if (!(blob instanceof Blob)) {
        throw new Error(`Browser artwork ${assetId.slice(0, 12)}… is unavailable. Restore the recovery copy or import a backup.`);
      }
      const entry = { url: urlApi.createObjectURL(blob), references: 0 };
      active.set(assetId, entry);
      return entry;
    })().finally(() => pending.delete(assetId));
    pending.set(assetId, next);
    return next;
  };

  return {
    acquire: async (reference) => {
      const assetId = getBrowserAssetId(reference);
      if (!assetId) return { url: reference, release: () => undefined };
      const entry = await resolveObjectUrl(assetId);
      entry.references += 1;
      let released = false;
      return {
        url: entry.url,
        release: () => {
          if (released) return;
          released = true;
          entry.references -= 1;
          if (entry.references > 0) return;
          urlApi.revokeObjectURL(entry.url);
          active.delete(assetId);
        },
      };
    },
    dispose: () => {
      active.forEach((entry) => urlApi.revokeObjectURL(entry.url));
      active.clear();
    },
  };
};
