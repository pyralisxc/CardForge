import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  getLibraryScopeDefinitions,
  getLibraryScopeStatus,
  resolveLibraryScopeForViewer,
  type LibraryScope,
} from '@/features/storage-management/model/libraryScopes';

describe('Library scopes', () => {
  const library = readFileSync(resolve(process.cwd(), 'src/features/storage-management/components/UnifiedAccountLibrary.tsx'), 'utf8');
  const sharedProjection = readFileSync(resolve(process.cwd(), 'src/features/storage-management/hooks/useLibrarySharedProjection.ts'), 'utf8');
  it('keeps Personal and Published visible while protecting Pipeline', () => {
    expect(getLibraryScopeDefinitions({ contributor: false, owner: false }).map((scope) => scope.id))
      .toEqual(['personal', 'published']);
    expect(getLibraryScopeDefinitions({ contributor: true, owner: false }).map((scope) => scope.id))
      .toEqual(['personal', 'published', 'pipeline']);
    expect(getLibraryScopeDefinitions({ contributor: false, owner: true }).map((scope) => scope.id))
      .toEqual(['personal', 'published', 'pipeline']);
  });

  it('returns a downgraded same-session viewer to Personal immediately', () => {
    expect(resolveLibraryScopeForViewer('pipeline', { contributor: true, owner: false })).toBe('pipeline');
    expect(resolveLibraryScopeForViewer('pipeline', { contributor: false, owner: false })).toBe('personal');
    expect(resolveLibraryScopeForViewer('pipeline', { contributor: false, owner: true })).toBe('pipeline');
  });

  it('names each scope in creator language', () => {
    const definitions = getLibraryScopeDefinitions({ contributor: true, owner: false });
    expect(definitions).toMatchObject([
      { id: 'personal', label: 'Personal', owner: 'You and your providers' },
      { id: 'published', label: 'Published', owner: 'CardForge catalog' },
      { id: 'pipeline', label: 'Pipeline', owner: 'Forge Review' },
    ]);
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

  it('renders real catalog media and structured appearance styles before generic fallbacks', () => {
    expect(sharedProjection).toContain('style: asset.style ?? null');
    expect(library).toContain('appearanceToStyle(style.appearance)');
    expect(library).toContain('className={styles.stylePreview}');
    expect(library).toContain('item.pipeline.style');
  });
});
