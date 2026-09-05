import type { LocalLibraryResource } from '@/features/project/client/library-resources';
import type { LibraryPickerResource } from './libraryPicker';

export const toLocalLibraryPickerResources = (resources: readonly LocalLibraryResource[]): LibraryPickerResource[] => (
  resources.filter((resource) => resource.status === 'available').map((resource) => ({
    id: resource.id,
    objectId: resource.objectId,
    name: resource.name,
    kind: resource.collection === 'image' ? 'image' : resource.kind,
    role: resource.collection === 'image' ? resource.kind === 'frame' || resource.kind === 'border' ? 'frame' : 'artwork' : resource.kind,
    source: 'project',
    sourceLabel: 'This device',
    ...(resource.mimeType ? { mimeType: resource.mimeType } : {}),
    previewUrl: resource.kind === 'font' ? null : resource.previewSource,
    materialization: 'already-local',
  }))
);
