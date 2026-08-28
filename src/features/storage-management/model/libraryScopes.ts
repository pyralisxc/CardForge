export type LibraryScope = 'personal' | 'published' | 'pipeline';
export type LibraryDensity = 'gallery' | 'list' | 'expanded';

export interface LibraryScopeDefinition {
  id: LibraryScope;
  label: string;
  description: string;
  owner: string;
}

export interface LibraryScopeViewer {
  developer: boolean;
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
    id: 'published',
    label: 'Published',
    description: 'Current Templates, artwork, styles, and fonts ready for Studio.',
    owner: 'CardForge catalog',
  },
  {
    id: 'pipeline',
    label: 'Pipeline',
    description: 'Your submissions and the work currently available for Forge Review.',
    owner: 'Forge Review',
  },
];

export const getLibraryScopeDefinitions = (
  viewer: LibraryScopeViewer,
): LibraryScopeDefinition[] => LIBRARY_SCOPE_DEFINITIONS.filter((scope) => (
  scope.id !== 'pipeline' || viewer.developer || viewer.owner
));

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
