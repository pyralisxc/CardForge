import { describe, expect, it } from 'vitest';

import {
  createLibraryPickerResult,
  getCompatibleLibraryPickerResources,
  type LibraryPickerRequest,
  type LibraryPickerResource,
} from '@/features/library-picker/client';

const kinds = ['image', 'frame', 'icon', 'texture', 'divider', 'font'] as const;
const resources: LibraryPickerResource[] = kinds.flatMap((kind, index) => ([
  {
    id: `project:${kind}`,
    objectId: `local-${kind}`,
    name: `Local ${kind}`,
    kind,
    role: kind === 'image' ? 'artwork' : kind,
    source: 'project',
    sourceLabel: 'This project',
    materialization: 'already-local',
  },
  {
    id: `personal:${kind}`,
    objectId: `drive-${kind}`,
    name: `Connected ${kind}`,
    kind,
    role: kind === 'image' ? 'artwork' : kind,
    source: 'personal',
    sourceLabel: 'My Library · Google Drive',
    revision: index + 1,
    materialization: 'project-copy',
  },
]));

const requestFor = (kind: typeof kinds[number]): LibraryPickerRequest => ({
  purpose: `template.${kind}-source`,
  title: `Choose ${kind}`,
  acceptedKinds: [kind],
  acceptedRoles: [kind === 'image' ? 'artwork' : kind],
  sources: ['project', 'personal', 'pipeline', 'published', 'provider'],
  selectionMode: 'single',
  target: { kind: kind === 'font' ? 'template-element' : 'template', ids: ['target-1'] },
  requiresProjectMaterialization: false,
});

describe('visual resource Picker contract', () => {
  it.each(kinds)('routes %s selection through the same compatible-resource result contract', (kind) => {
    const request = requestFor(kind);
    const compatible = getCompatibleLibraryPickerResources(request, resources);

    expect(compatible.map((resource) => resource.id)).toEqual([`project:${kind}`, `personal:${kind}`]);
    expect(createLibraryPickerResult(request, resources, [`personal:${kind}`])).toEqual({
      purpose: `template.${kind}-source`,
      target: request.target,
      selections: [expect.objectContaining({
        id: `personal:${kind}`,
        objectId: `drive-${kind}`,
        materialization: 'project-copy',
        source: 'personal',
      })],
    });
  });

  it('does not leak a resource chosen for one visual role into another role', () => {
    expect(getCompatibleLibraryPickerResources(requestFor('divider'), resources)
      .some((resource) => resource.kind === 'texture')).toBe(false);
    expect(getCompatibleLibraryPickerResources(requestFor('font'), resources)
      .some((resource) => resource.kind === 'image')).toBe(false);
  });
});
