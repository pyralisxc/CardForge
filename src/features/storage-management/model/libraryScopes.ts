export type LibraryScope = 'personal' | 'published' | 'pipeline' | 'campaigns';
export type LibraryDensity = 'gallery' | 'list' | 'expanded';

export interface LibraryScopeDefinition {
  id: LibraryScope;
  label: string;
  description: string;
  owner: string;
}

export interface LibraryScopeViewer {
  contributor: boolean;
  campaigns: boolean;
  owner: boolean;
}

export interface LibraryScopeStatus {
  kind: 'loading' | 'unavailable' | 'empty' | 'ready';
  label: string;
}

const LIBRARY_SCOPE_DEFINITIONS: readonly LibraryScopeDefinition[] = [
  {
    id: 'personal',
    label: 'Personal',
    description: 'Your Sets, projects, connected files, and temporary work.',
    owner: 'You and your providers',
  },
  {
    id: 'pipeline',
    label: 'Pipeline',
    description: 'Templates, Sets, artwork, and other shared work available to your account.',
    owner: 'CardForge Pipeline',
  },
  {
    id: 'published',
    label: 'Published',
    description: 'Your contributions currently published through the CardForge Pipeline.',
    owner: 'Your published work',
  },
  {
    id: 'campaigns',
    label: 'Campaigns',
    description: 'Campaign packages, coordinated variants, and reusable campaign media available to your granted role.',
    owner: 'Marketing workspace',
  },
];

export const getLibraryScopeDefinitions = (
  viewer: LibraryScopeViewer,
): LibraryScopeDefinition[] => LIBRARY_SCOPE_DEFINITIONS.filter((scope) => (
  (scope.id !== 'published' || viewer.contributor || viewer.owner)
  && (scope.id !== 'campaigns' || viewer.campaigns || viewer.owner)
));

export const resolveLibraryScopeForViewer = (
  scope: LibraryScope,
  viewer: LibraryScopeViewer,
): LibraryScope => (
  scope === 'published' && !viewer.contributor && !viewer.owner
    ? 'pipeline'
    : scope === 'campaigns' && !viewer.campaigns && !viewer.owner
      ? 'personal'
      : scope
);

export const shouldLoadLibraryPipelineProgram = (
  scope: LibraryScope,
  pipelineEnabled: boolean,
): boolean => pipelineEnabled && (scope === 'pipeline' || scope === 'published');

export const getLibraryScopeStatus = ({
  loading,
  itemCount,
  failure,
}: {
  loading: boolean;
  itemCount: number;
  failure: string | null;
}): LibraryScopeStatus => {
  if (loading) return { kind: 'loading', label: 'Loading' };
  if (failure) return { kind: 'unavailable', label: 'Unavailable' };
  if (itemCount === 0) return { kind: 'empty', label: 'Empty' };
  return { kind: 'ready', label: `${itemCount} object${itemCount === 1 ? '' : 's'}` };
};
