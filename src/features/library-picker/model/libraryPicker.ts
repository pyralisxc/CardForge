export type LibraryPickerSource = 'project' | 'personal' | 'pipeline' | 'published' | 'provider';
export type LibraryPickerSelectionMode = 'single' | 'multiple';
export type LibraryPickerMaterialization = 'already-local' | 'reference' | 'project-copy';

export interface LibraryPickerRequest {
  purpose: string;
  title: string;
  description?: string;
  acceptedKinds: readonly string[];
  acceptedRoles?: readonly string[];
  acceptedMimeTypes?: readonly string[];
  sources: readonly LibraryPickerSource[];
  selectionMode: LibraryPickerSelectionMode;
  target: {
    kind: string;
    ids: readonly string[];
  };
  requiresProjectMaterialization: boolean;
}

export interface LibraryPickerResource {
  id: string;
  objectId: string;
  name: string;
  kind: string;
  source: LibraryPickerSource;
  sourceLabel: string;
  role?: string;
  mimeType?: string;
  revision?: number;
  previewUrl?: string | null;
  materialization: LibraryPickerMaterialization;
}

export type LibraryPickerSelection = LibraryPickerResource;

export interface LibraryPickerResult {
  purpose: string;
  target: LibraryPickerRequest['target'];
  selections: LibraryPickerSelection[];
}

const includes = (accepted: readonly string[] | undefined, value: string | undefined) => (
  !accepted?.length || Boolean(value && accepted.includes(value))
);

export const getCompatibleLibraryPickerResources = (
  request: LibraryPickerRequest,
  resources: readonly LibraryPickerResource[],
): LibraryPickerResource[] => resources.filter((resource) => (
  request.sources.includes(resource.source)
  && includes(request.acceptedKinds, resource.kind)
  && includes(request.acceptedRoles, resource.role)
  && includes(request.acceptedMimeTypes, resource.mimeType)
  && (!request.requiresProjectMaterialization || resource.materialization !== 'reference')
));

export const createLibraryPickerResult = (
  request: LibraryPickerRequest,
  resources: readonly LibraryPickerResource[],
  selectedIds: readonly string[],
): LibraryPickerResult => {
  const compatible = new Map(getCompatibleLibraryPickerResources(request, resources).map((resource) => [resource.id, resource]));
  const selections = [...new Set(selectedIds)].map((id) => compatible.get(id)).filter((resource): resource is LibraryPickerResource => Boolean(resource));
  if (request.selectionMode === 'single' && selections.length > 1) {
    throw new Error('This Library request accepts one object.');
  }
  return { purpose: request.purpose, target: request.target, selections };
};
