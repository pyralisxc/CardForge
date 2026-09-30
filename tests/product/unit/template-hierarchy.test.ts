import { describe, expect, it } from 'vitest';

import {
  FREEFORM_HIERARCHY_VERSION,
  reconstructFreeformCanvas,
  resolveCanvasElementWorldGeometry,
  resolveCanvasElementsForRender,
} from '@/domain/templates';
import { buildArtifactFieldTargetMap } from '@/features/card-generator/client';

const group = {
  id: 'group',
  type: 'shape' as const,
  name: 'Group',
  x: 100,
  y: 80,
  width: 200,
  height: 180,
  zIndex: 1,
  visible: true,
};
const child = {
  id: 'child',
  type: 'text' as const,
  name: 'Child',
  x: 130,
  y: 120,
  width: 60,
  height: 40,
  zIndex: 2,
  visible: true,
  parentId: 'group',
  content: '{{name}}',
};

describe('Template parent-local hierarchy', () => {
  it('migrates legacy absolute child positions once during canvas reconstruction', () => {
    const canvas = reconstructFreeformCanvas({
      width: 630,
      height: 880,
      elements: [group, child],
    });
    expect(canvas.hierarchyVersion).toBe(FREEFORM_HIERARCHY_VERSION);
    expect(canvas.elements.find((element) => element.id === 'child')).toMatchObject({
      parentId: 'group',
      x: 30,
      y: 40,
    });
    expect(resolveCanvasElementWorldGeometry(canvas.elements[1]!, canvas.elements)).toMatchObject({
      x: 130,
      y: 120,
    });
  });

  it('keeps canonical render geometry stable when a parent moves', () => {
    const elements = [
      { ...group, x: 140, y: 110 },
      { ...child, x: 30, y: 40 },
    ];
    const resolved = resolveCanvasElementsForRender(elements);
    expect(resolved.find((element) => element.id === 'child')).toMatchObject({ x: 170, y: 150 });
    expect(elements[1]).toMatchObject({ x: 30, y: 40 });
  });

  it('projects Artifact Edit targets through the same parent-local transform', () => {
    const template = {
      id: 'hierarchy-template',
      name: 'Hierarchy',
      aspectRatio: '63:88',
      freeformCanvas: {
        hierarchyVersion: 2 as const,
        width: 630,
        height: 880,
        elements: [
          { ...group, x: 100, y: 80 },
          { ...child, x: 30, y: 40 },
        ],
      },
    };
    const targets = buildArtifactFieldTargetMap(template);
    expect(targets.targets.find((target) => target.element.id === 'child')?.element).toMatchObject({
      x: 130,
      y: 120,
    });
  });
});
