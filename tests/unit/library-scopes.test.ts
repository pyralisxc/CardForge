import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  getLibraryScopeDefinitions,
  getLibraryScopeStatus,
  type LibraryScope,
} from '@/features/storage-management/model/libraryScopes';

describe('Library scopes', () => {
  const library = readFileSync(resolve(process.cwd(), 'src/features/storage-management/components/UnifiedAccountLibrary.tsx'), 'utf8');
  const sharedProjection = readFileSync(resolve(process.cwd(), 'src/features/storage-management/hooks/useLibrarySharedProjection.ts'), 'utf8');
  it('keeps Personal and Published visible while protecting Pipeline', () => {
    expect(getLibraryScopeDefinitions({ developer: false, owner: false }).map((scope) => scope.id))
      .toEqual(['personal', 'published']);
    expect(getLibraryScopeDefinitions({ developer: true, owner: false }).map((scope) => scope.id))
      .toEqual(['personal', 'published', 'pipeline']);
    expect(getLibraryScopeDefinitions({ developer: false, owner: true }).map((scope) => scope.id))
      .toEqual(['personal', 'published', 'pipeline']);
  });

  it('names each scope in creator language', () => {
    const definitions = getLibraryScopeDefinitions({ developer: true, owner: false });
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
