import type { FreeformCardElement, FreeformShapeKind } from '@/types';

export type InspectorSection =
  | 'content'
  | 'layout'
  | 'appearance'
  | 'texture'
  | 'border'
  | 'effects'
  | 'data'
  | 'advanced'
  | 'typography'
  | 'image'
  | 'icon'
  | 'shape'
  | 'divider';

export const SHAPE_PRIMITIVE_OPTIONS: Array<{ value: FreeformShapeKind; label: string }> = [
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'ellipse', label: 'Ellipse' },
  { value: 'capsule', label: 'Capsule' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'hexagon', label: 'Hexagon' },
  { value: 'banner', label: 'Banner' },
  { value: 'notch-panel', label: 'Notch Panel' },
  { value: 'bracket-frame', label: 'Bracket Frame' },
  { value: 'corner-frame', label: 'Corner Frame' },
];

export const isDividerElement = (element?: Partial<FreeformCardElement> | null): boolean =>
  Boolean(element?.type === 'shape' && (
    element.shapeRole === 'divider' ||
    element.appearance?.shapeRole === 'divider' ||
    element.shapeKind === 'line'
  ));

export const getElementCapabilities = (element?: Partial<FreeformCardElement> | null): InspectorSection[] => {
  if (!element) return [];
  if (isDividerElement(element)) return ['layout', 'appearance', 'divider', 'effects'];

  switch (element.type) {
    case 'text':
      return ['content', 'layout', 'appearance', 'texture', 'border', 'effects', 'typography', 'data'];
    case 'image':
      return ['content', 'layout', 'appearance', 'border', 'effects', 'image', 'data'];
    case 'icon':
      return ['content', 'layout', 'appearance', 'border', 'effects', 'icon', 'data'];
    case 'shape':
      return ['layout', 'appearance', 'texture', 'border', 'effects', 'shape'];
    default:
      return [];
  }
};

export const hasElementCapability = (
  element: Partial<FreeformCardElement> | null | undefined,
  section: InspectorSection,
): boolean => getElementCapabilities(element).includes(section);
