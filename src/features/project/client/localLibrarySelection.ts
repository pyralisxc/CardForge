import { createScopedProjectBinaryAssetResolver } from '@/features/project/client/persistence-binaries';
import { getProjectPersistenceScope } from '@/features/project/client/persistence-workspace';
import { getLocalLibrarySelectionValue, type LocalLibraryResource } from '../model/localLibraryResources';

/** A mounted preview is optional; selecting a binary still verifies its native source. */
export const resolveLocalLibrarySelectionValue = async (resources: readonly LocalLibraryResource[], selectionId: string): Promise<string> => {
  const value = getLocalLibrarySelectionValue(resources, selectionId);
  const resource = resources.find((candidate) => candidate.id === selectionId)!;
  const resolver = createScopedProjectBinaryAssetResolver(getProjectPersistenceScope());
  const handle = await resolver.acquire(resource.source);
  handle.release();
  return value;
};
