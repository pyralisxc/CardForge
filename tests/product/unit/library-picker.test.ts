import { describe, expect, it } from 'vitest';

import {
  createLibraryPickerResult,
  getCompatibleLibraryPickerResources,
  type LibraryPickerRequest,
  type LibraryPickerResource,
} from '@/features/library-picker/client';

const request: LibraryPickerRequest = {
  purpose: 'template.image-source',
  title: 'Choose a picture',
  acceptedKinds: ['image'],
  acceptedRoles: ['artwork'],
  sources: ['project', 'pipeline'],
  selectionMode: 'single',
  target: { kind: 'template-element', ids: ['element-1'] },
  requiresProjectMaterialization: false,
};

const resources: LibraryPickerResource[] = [
  { id: 'project:image-1', objectId: 'image-1', name: 'Local art', kind: 'image', role: 'artwork', source: 'project', sourceLabel: 'This project', materialization: 'already-local' },
  { id: 'pipeline:image-2:r3', objectId: 'image-2', name: 'Candidate art', kind: 'image', role: 'artwork', source: 'pipeline', sourceLabel: 'Pipeline', revision: 3, materialization: 'reference' },
  { id: 'published:icon-1', objectId: 'icon-1', name: 'Wrong kind', kind: 'icon', role: 'symbol', source: 'published', sourceLabel: 'Published', materialization: 'reference' },
];

describe('Library Picker contract', () => {
  it('filters by caller-declared source, kind, and role', () => {
    expect(getCompatibleLibraryPickerResources(request, resources).map((item) => item.id)).toEqual([
      'project:image-1',
      'pipeline:image-2:r3',
    ]);
  });

  it('returns exact source identity, revision, materialization, and target context', () => {
    const result = createLibraryPickerResult(request, resources, ['pipeline:image-2:r3']);
    expect(result).toEqual({
      purpose: 'template.image-source',
      target: { kind: 'template-element', ids: ['element-1'] },
      selections: [resources[1]],
    });
  });

  it('rejects multiple selections for a single-selection request', () => {
    expect(() => createLibraryPickerResult(request, resources, ['project:image-1', 'pipeline:image-2:r3'])).toThrow('accepts one object');
  });
});
