import { describe, expect, it } from 'vitest';

import {
  createLibraryPickerAssignments,
  createLibraryPickerResult,
  getCompatibleLibraryPickerResources,
  getNextLibraryPickerActiveIndex,
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

  it('broadcasts one resource to every target and maps equal multi-selections in target order', () => {
    const target = { kind: 'Artifact', ids: ['card-1', 'card-2'] };
    expect(createLibraryPickerAssignments({
      purpose: 'artifact.bulk-revision.image-field',
      target,
      selections: [resources[0]!],
    })).toEqual([
      { targetId: 'card-1', selection: resources[0] },
      { targetId: 'card-2', selection: resources[0] },
    ]);

    expect(createLibraryPickerAssignments({
      purpose: 'artifact.bulk-revision.image-field',
      target,
      selections: [resources[0]!, resources[1]!],
    })).toEqual([
      { targetId: 'card-1', selection: resources[0] },
      { targetId: 'card-2', selection: resources[1] },
    ]);
  });

  it('rejects partial multi-resource mappings instead of guessing', () => {
    expect(() => createLibraryPickerAssignments({
      purpose: 'artifact.bulk-revision.image-field',
      target: { kind: 'Artifact', ids: ['card-1', 'card-2', 'card-3'] },
      selections: [resources[0]!, resources[1]!],
    })).toThrow('Choose one resource for every selected Artifact');
  });

  it('keeps keyboard listbox navigation inside the compatible option set', () => {
    expect(getNextLibraryPickerActiveIndex({ currentIndex: 0, itemCount: 3, key: 'ArrowLeft' })).toBe(0);
    expect(getNextLibraryPickerActiveIndex({ currentIndex: 0, itemCount: 3, key: 'ArrowRight' })).toBe(1);
    expect(getNextLibraryPickerActiveIndex({ currentIndex: 1, itemCount: 3, key: 'End' })).toBe(2);
    expect(getNextLibraryPickerActiveIndex({ currentIndex: 2, itemCount: 3, key: 'ArrowDown' })).toBe(2);
    expect(getNextLibraryPickerActiveIndex({ currentIndex: 2, itemCount: 3, key: 'Home' })).toBe(0);
  });
});
