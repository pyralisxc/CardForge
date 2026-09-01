export interface ProjectSourceRevisionPair {
  projectRevision: string | null;
  providerRevision?: string | null;
}

export type ProjectSourceConflictKind =
  | 'missing-expected-project-revision'
  | 'missing-current-project-revision'
  | 'project-revision-changed'
  | 'missing-current-provider-revision'
  | 'provider-revision-changed';

export interface ProjectSourceConflict {
  kind: ProjectSourceConflictKind;
  expected: ProjectSourceRevisionPair;
  current: ProjectSourceRevisionPair;
}

/**
 * Compares source revisions without assuming which adapter owns them. Browser
 * folders normally have only a CardForge project revision; connected providers
 * may require both their native revision and the package revision.
 */
export const getProjectSourceConflict = ({
  expected,
  current,
}: {
  expected: ProjectSourceRevisionPair;
  current: ProjectSourceRevisionPair;
}): ProjectSourceConflict | null => {
  if (!expected.projectRevision) {
    return { kind: 'missing-expected-project-revision', expected, current };
  }
  if (!current.projectRevision) {
    return { kind: 'missing-current-project-revision', expected, current };
  }
  if (expected.projectRevision !== current.projectRevision) {
    return { kind: 'project-revision-changed', expected, current };
  }
  if (expected.providerRevision) {
    if (!current.providerRevision) {
      return { kind: 'missing-current-provider-revision', expected, current };
    }
    if (expected.providerRevision !== current.providerRevision) {
      return { kind: 'provider-revision-changed', expected, current };
    }
  }
  return null;
};
