import { describe, expect, it } from 'vitest';

import {
  createLibraryPickerResult,
  getCompatibleLibraryPickerResources,
  type LibraryPickerRequest,
  type LibraryPickerResource,
} from '@/features/library-picker/client';

const kinds = ['image', 'frame', 'icon', 'texture', 'divider', 'font'] as const;
const resources: LibraryPickerResource[] = [
  ...kinds.flatMap((kind, index): LibraryPickerResource[] => ([
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
  ])),
  {
    id: 'builtin:font-cinzel',
    objectId: 'font-cinzel',
    name: 'Fantasy Display (Cinzel)',
    kind: 'font',
    role: 'font',
    source: 'builtin',
    sourceLabel: 'Built-in compatibility',
    materialization: 'reference',
  },
  {
    id: 'published:built-in-icon:Sparkles',
    objectId: 'Sparkles',
    name: 'Sparkles',
    kind: 'icon',
    role: 'icon',
    source: 'published',
    sourceLabel: 'Built into CardForge',
    materialization: 'reference',
  },
];

const requestFor = (kind: typeof kinds[number]): LibraryPickerRequest => ({
  purpose: `template.${kind}-source`,
  title: `Choose ${kind}`,
  acceptedKinds: [kind],
  acceptedRoles: [kind === 'image' ? 'artwork' : kind],
  sources: ['builtin', 'project', 'personal', 'pipeline', 'published', 'provider'],
  selectionMode: 'single',
  target: { kind: kind === 'font' ? 'template-element' : 'template', ids: ['target-1'] },
  requiresProjectMaterialization: false,
});

describe('visual resource Picker contract', () => {
  it.each(kinds)('routes %s selection through the same compatible-resource result contract', (kind) => {
    const request = requestFor(kind);
    const compatible = getCompatibleLibraryPickerResources(request, resources);

    expect(compatible.map((resource) => resource.id)).toEqual([
      `project:${kind}`,
      `personal:${kind}`,
      ...(kind === 'icon' ? ['published:built-in-icon:Sparkles'] : []),
      ...(kind === 'font' ? ['builtin:font-cinzel'] : []),
    ]);
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

  it('distinguishes built-in font fallbacks from actual published Pipeline resources', () => {
    const compatible = getCompatibleLibraryPickerResources(requestFor('font'), resources);
    const fallback = compatible.find((item) => item.objectId === 'font-cinzel');
    expect(fallback).toMatchObject({ source: 'builtin', sourceLabel: 'Built-in compatibility', materialization: 'reference' });
    expect(compatible.some((item) => item.objectId === 'font-cinzel' && item.source === 'published')).toBe(false);
  });

  it('does not leak a resource chosen for one visual role into another role', () => {
    expect(getCompatibleLibraryPickerResources(requestFor('divider'), resources)
      .some((resource) => resource.kind === 'texture')).toBe(false);
    expect(getCompatibleLibraryPickerResources(requestFor('font'), resources)
      .some((resource) => resource.kind === 'image')).toBe(false);
  });
});
