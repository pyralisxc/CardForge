import { createProjectWorkspaceDraft, type ProjectState } from '../store/workspaceStore';
import { getProjectPersistenceScope } from '../persistence/projectPersistenceScope';

/** The verified copy must describe the exact in-memory source being removed. */
export const removeDeviceWorkAfterVerifiedCopy = async ({ setId, expectedState, scope }: {
  setId: string;
  expectedState: ProjectState;
  scope: ReturnType<typeof getProjectPersistenceScope>;
}): Promise<void> => {
  if (getProjectPersistenceScope() !== scope) throw new Error('The account changed during the copy. The device source was retained.');
  const draft = createProjectWorkspaceDraft(expectedState);
  if (!draft.getState().deleteCardSet(setId)) throw new Error('The device Set could not be removed. The verified destination copy remains available.');
  await draft.commit([]);
};
