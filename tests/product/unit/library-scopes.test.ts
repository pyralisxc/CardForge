import { describe, expect, it } from 'vitest';

import {
  getLibraryScopeDefinitions,
  getLibraryScopeStatus,
  resolveLibraryScopeForViewer,
  shouldLoadLibraryPipelineProgram,
  type LibraryScope,
} from '@/features/storage-management/model/libraryScopes';

describe('Library scopes', () => {
  it('keeps Personal and Pipeline visible while protecting contributor publication history', () => {
    expect(getLibraryScopeDefinitions({ contributor: false, campaigns: false, owner: false }).map((scope) => scope.id))
      .toEqual(['personal', 'pipeline']);
    expect(getLibraryScopeDefinitions({ contributor: true, campaigns: true, owner: false }).map((scope) => scope.id))
      .toEqual(['personal', 'pipeline', 'published', 'campaigns']);
    expect(getLibraryScopeDefinitions({ contributor: false, campaigns: false, owner: true }).map((scope) => scope.id))
      .toEqual(['personal', 'pipeline', 'published', 'campaigns']);
  });

  it('returns a downgraded same-session viewer to Personal immediately', () => {
    expect(resolveLibraryScopeForViewer('pipeline', { contributor: true, campaigns: true, owner: false })).toBe('pipeline');
    expect(resolveLibraryScopeForViewer('pipeline', { contributor: false, campaigns: false, owner: false })).toBe('pipeline');
    expect(resolveLibraryScopeForViewer('pipeline', { contributor: false, campaigns: false, owner: true })).toBe('pipeline');
    expect(resolveLibraryScopeForViewer('published', { contributor: false, campaigns: false, owner: false })).toBe('pipeline');
    expect(resolveLibraryScopeForViewer('campaigns', { contributor: true, campaigns: false, owner: false })).toBe('personal');
  });

  it('names each scope in creator language', () => {
    const definitions = getLibraryScopeDefinitions({ contributor: true, campaigns: true, owner: false });
    expect(definitions).toMatchObject([
      { id: 'personal', label: 'Personal', owner: 'You and your providers' },
      { id: 'pipeline', label: 'Pipeline', owner: 'CardForge Pipeline' },
      { id: 'published', label: 'Published', owner: 'Your published work' },
      { id: 'campaigns', label: 'Campaigns', owner: 'Marketing workspace' },
    ]);
  });

  it('loads contributor lineage data for both Pipeline and Published', () => {
    expect(shouldLoadLibraryPipelineProgram('personal', true)).toBe(false);
    expect(shouldLoadLibraryPipelineProgram('pipeline', true)).toBe(true);
    expect(shouldLoadLibraryPipelineProgram('published', true)).toBe(true);
    expect(shouldLoadLibraryPipelineProgram('published', false)).toBe(false);
  });

  it('reports loading, unavailable, empty, and ready without flattening boundaries', () => {
    const statuses: Array<[LibraryScope, ReturnType<typeof getLibraryScopeStatus>['kind']]> = [
      ['personal', getLibraryScopeStatus({ loading: true, itemCount: 0, failure: null }).kind],
      ['published', getLibraryScopeStatus({ loading: false, itemCount: 0, failure: 'Catalog unavailable' }).kind],
      ['pipeline', getLibraryScopeStatus({ loading: false, itemCount: 0, failure: null }).kind],
      ['personal', getLibraryScopeStatus({ loading: false, itemCount: 3, failure: null }).kind],
    ];
    expect(statuses).toEqual([
      ['personal', 'loading'],
      ['published', 'unavailable'],
      ['pipeline', 'empty'],
      ['personal', 'ready'],
    ]);
  });
});
