import { describe, expect, it } from 'vitest';

import { canRenderVectorShape, getVectorShapeDefinition } from '@/lib/vectorShapes';

describe('vector shape primitives', () => {
  it('defines closed vector geometry for non-divider primitives', () => {
    expect(getVectorShapeDefinition('diamond')).toEqual({
      kind: 'polygon',
      points: '50,2 98,50 50,98 2,50',
    });
    expect(getVectorShapeDefinition('hexagon')).toMatchObject({ kind: 'polygon' });
    expect(getVectorShapeDefinition('corner-frame')).toMatchObject({ kind: 'path', fillRule: 'evenodd' });
  });

  it('keeps divider lines out of the primitive vector renderer', () => {
    expect(getVectorShapeDefinition('line')).toBeNull();
    expect(canRenderVectorShape({ type: 'shape', shapeKind: 'line', shapeRole: 'divider' })).toBe(false);
    expect(canRenderVectorShape({ type: 'shape', shapeKind: 'banner', shapeRole: 'panel' })).toBe(true);
    expect(canRenderVectorShape({ type: 'image', shapeKind: 'banner', shapeRole: 'panel' })).toBe(false);
  });
});
