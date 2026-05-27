import type { FreeformCardElement, FreeformShapeKind } from '@/types';

export type VectorShapeDefinition =
  | { kind: 'rect'; rx?: number }
  | { kind: 'ellipse' }
  | { kind: 'polygon'; points: string }
  | { kind: 'path'; d: string; fillRule?: 'evenodd' | 'nonzero' };

const CORNER_FRAME_PATH = [
  'M2 2 H34 V9 H9 V34 H2 Z',
  'M66 2 H98 V34 H91 V9 H66 Z',
  'M66 91 H91 V66 H98 V98 H66 Z',
  'M2 66 H9 V91 H34 V98 H2 Z',
].join(' ');

const BRACKET_FRAME_PATH = [
  'M2 2 H24 V10 H10 V90 H24 V98 H2 Z',
  'M76 2 H98 V98 H76 V90 H90 V10 H76 Z',
].join(' ');

export const getVectorShapeDefinition = (
  shapeKind: FreeformShapeKind | undefined,
): VectorShapeDefinition | null => {
  switch (shapeKind) {
    case undefined:
    case 'rectangle':
      return { kind: 'rect', rx: 4 };
    case 'capsule':
      return { kind: 'rect', rx: 50 };
    case 'ellipse':
      return { kind: 'ellipse' };
    case 'diamond':
      return { kind: 'polygon', points: '50,2 98,50 50,98 2,50' };
    case 'hexagon':
      return { kind: 'polygon', points: '25,2 75,2 98,50 75,98 25,98 2,50' };
    case 'banner':
      return { kind: 'polygon', points: '2,6 90,6 98,50 90,94 2,94 10,50' };
    case 'notch-panel':
      return { kind: 'polygon', points: '8,2 92,2 98,14 98,86 92,98 8,98 2,86 2,14' };
    case 'bracket-frame':
      return { kind: 'path', d: BRACKET_FRAME_PATH, fillRule: 'evenodd' };
    case 'corner-frame':
      return { kind: 'path', d: CORNER_FRAME_PATH, fillRule: 'evenodd' };
    case 'line':
      return null;
    default:
      return { kind: 'rect', rx: 4 };
  }
};

export const canRenderVectorShape = (element: Pick<FreeformCardElement, 'type' | 'shapeKind' | 'shapeRole'>): boolean =>
  element.type === 'shape' && element.shapeKind !== 'line' && element.shapeRole !== 'divider';
