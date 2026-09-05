import type { CardAssetOption } from '@/domain/templates';
import type { ProjectFontAsset } from './projectFont';

export const LOCAL_LIBRARY_COLLECTIONS = ['texture', 'divider', 'icon', 'image', 'font'] as const;
export type LocalLibraryCollection = typeof LOCAL_LIBRARY_COLLECTIONS[number];

export interface LocalLibraryResource {
  id: string;
  objectId: string;
  collection: LocalLibraryCollection;
  kind: CardAssetOption['kind'] | 'font';
  name: string;
  source: string;
  previewSource: string;
  fontValue?: string;
  mimeType?: string;
  sizeBytes: number | null;
  status: 'available' | 'missing-source' | 'unavailable';
}

const knownSize = (size: number | undefined): number | null => (
  Number.isInteger(size) && Number(size) > 0 ? Number(size) : null
);

export const projectLocalLibraryAsset = (collection: Exclude<LocalLibraryCollection, 'font'>, asset: CardAssetOption): LocalLibraryResource => {
  if (!asset || typeof asset.id !== 'string' || !asset.id.trim() || typeof asset.name !== 'string') {
    throw new Error(`The local ${collection} collection contains an invalid resource. Restore a backup before changing it.`);
  }
  const source = typeof asset.url === 'string' ? asset.url.trim() : '';
  return {
    id: `local-resource:${collection}:${asset.id}`,
    objectId: asset.id,
    collection,
    kind: asset.kind ?? collection,
    name: asset.name || `Unnamed ${collection}`,
    source,
    previewSource: typeof asset.previewUrl === 'string' && asset.previewUrl.trim() ? asset.previewUrl : source,
    sizeBytes: knownSize(asset.fileSizeBytes),
    status: source ? 'available' : 'missing-source',
  };
};

export const projectLocalLibraryFont = (font: ProjectFontAsset): LocalLibraryResource => ({
  id: `local-resource:font:${font.id}`,
  objectId: font.id,
  collection: 'font',
  kind: 'font',
  name: font.name,
  source: font.dataUrl,
  previewSource: font.dataUrl,
  fontValue: font.value,
  mimeType: font.mimeType,
  sizeBytes: knownSize(font.fileSizeBytes),
  status: font.dataUrl ? 'available' : 'missing-source',
});

/** Retain failed collections for inspection, but do not offer stale entries for use. */
export const retainLocalLibraryResources = (
  previous: readonly LocalLibraryResource[],
  refreshed: readonly LocalLibraryResource[],
  failedCollections: readonly LocalLibraryCollection[],
): LocalLibraryResource[] => [
  ...refreshed,
  ...previous.filter((resource) => failedCollections.includes(resource.collection))
    .map((resource) => ({ ...resource, status: 'unavailable' as const })),
];

export const getLocalLibrarySelectionValue = (resources: readonly LocalLibraryResource[], selectionId: string): string => {
  const resource = resources.find((candidate) => candidate.id === selectionId);
  if (!resource || resource.status !== 'available' || !resource.source) {
    throw new Error('This local Library resource is unavailable. Refresh the Library or restore its source before using it.');
  }
  return resource.kind === 'font' ? resource.fontValue! : resource.source;
};
