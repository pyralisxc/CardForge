import { describe, expect, it } from 'vitest';

import { buildKonvaTemplateStageConfig } from '@/lib/konvaTemplateAdapter';
import type { TCGCardTemplate } from '@/types';

const template: TCGCardTemplate = {
  id: 'konva-adapter-template',
  name: 'Konva Adapter Template',
  aspectRatio: '63:88',
  frameStyle: 'standard',
  freeformCanvas: {
    width: 630,
    height: 880,
    elements: [
      {
        id: 'parent-frame',
        type: 'shape',
        name: 'Parent Frame',
        x: 50,
        y: 80,
        width: 300,
        height: 220,
        zIndex: 0,
        shapeKind: 'rectangle',
        fillColor: '#020617',
        strokeColor: '#14f1ff',
        strokeWidth: 4,
      },
      {
        id: 'larger-child',
        type: 'shape',
        name: 'Larger Child',
        parentId: 'parent-frame',
        x: 30,
        y: 60,
        width: 340,
        height: 260,
        zIndex: 1,
        shapeKind: 'rectangle',
        fillColor: 'rgba(20,241,255,0.2)',
      },
      {
        id: 'title',
        type: 'text',
        name: 'Title',
        parentId: 'parent-frame',
        x: 80,
        y: 120,
        width: 240,
        height: 60,
        zIndex: 2,
        content: '{{CardName:"Fallback Name"}}',
        textColor: '#f8fafc',
        fontSizePx: 28,
        textAlign: 'center',
      },
    ],
  },
  backCanvas: {
    width: 630,
    height: 880,
    elements: [
      {
        id: 'back-title',
        type: 'text',
        name: 'Back Title',
        x: 100,
        y: 400,
        width: 430,
        height: 80,
        zIndex: 0,
        content: 'CARDFORGE',
        textColor: '#14f1ff',
        fontSizePx: 34,
      },
    ],
  },
};

describe('Konva template adapter', () => {
  it('builds a Konva-ready grouped stage tree from freeform template data', () => {
    const stage = buildKonvaTemplateStageConfig(template, { CardName: 'Round Trip Relic' });
    const [group] = stage.nodes;

    expect(stage.width).toBe(630);
    expect(stage.height).toBe(880);
    expect(group.kind).toBe('Group');
    expect(group.attrs.x).toBe(50);
    expect(group.attrs.y).toBe(80);
    expect(group.children?.map((node) => node.id)).toEqual([
      'parent-frame__visual',
      'larger-child',
      'title',
    ]);
    expect(group.children?.[1].attrs.x).toBe(-20);
    expect(group.children?.[1].attrs.y).toBe(-20);
    expect(group.children?.[2].attrs.text).toBe('Round Trip Relic');
  });

  it('can build from the optional back face without changing the template model', () => {
    const stage = buildKonvaTemplateStageConfig(template, {}, 'back');

    expect(stage.nodes).toHaveLength(1);
    expect(stage.nodes[0].id).toBe('back-title');
    expect(stage.nodes[0].kind).toBe('Text');
    expect(stage.nodes[0].attrs.text).toBe('CARDFORGE');
  });
});
