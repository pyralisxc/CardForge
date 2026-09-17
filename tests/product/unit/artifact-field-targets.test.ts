import { describe, expect, it } from 'vitest';

import type { TCGCardTemplate } from '@/domain/templates';
import { buildArtifactFieldTargetMap } from '@/features/card-generator/lib/artifactFieldTargets';

const template: TCGCardTemplate = {
  id: 'template-direct-edit',
  name: 'Direct edit fixture',
  aspectRatio: '2.5:3.5',
  fieldContracts: [
    { key: 'title', elementId: 'title-layer', label: 'Card title', type: 'text' },
    { key: 'art', elementId: 'art-layer', label: 'Artwork', type: 'image' },
  ],
  freeformCanvas: {
    width: 500,
    height: 700,
    elements: [
      { id: 'background', type: 'shape', name: 'Frame', x: 0, y: 0, width: 500, height: 700, zIndex: 0 },
      { id: 'art-layer', type: 'image', name: 'Artwork', x: 30, y: 60, width: 440, height: 320, zIndex: 1, imageSource: '{{art}}' },
      { id: 'title-layer', type: 'text', name: 'Title', x: 40, y: 20, width: 420, height: 40, zIndex: 2, content: '{{title}}' },
      { id: 'hidden-layer', type: 'text', name: 'Hidden', x: 0, y: 0, width: 20, height: 20, zIndex: 3, visible: false, content: '{{hidden}}' },
    ],
  },
};

describe('buildArtifactFieldTargetMap', () => {
  it('maps rendered text and image elements to Artifact fields while preserving Template-only elements', () => {
    const result = buildArtifactFieldTargetMap(template);

    expect(new Set(result.fields.map((field) => field.key))).toEqual(new Set(['title', 'art', 'hidden']));
    expect(result.targets.map((target) => ({ id: target.element.id, kind: target.kind, keys: target.fields.map((field) => field.key) }))).toEqual([
      { id: 'background', kind: 'template-element', keys: [] },
      { id: 'art-layer', kind: 'artifact-field', keys: ['art'] },
      { id: 'title-layer', kind: 'artifact-field', keys: ['title'] },
    ]);
  });
});
