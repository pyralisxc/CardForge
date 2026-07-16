import type { FreeformCanvas } from '@/domain/templates';

interface ResolveElementPlacementInput {
  canvas: Pick<FreeformCanvas, 'width' | 'height' | 'elements'>;
  height: number;
  presetPosition?: { x?: number; y?: number };
  requestedPlacement?: { x: number; y: number };
  width: number;
}

export const resolveElementPlacement = ({
  canvas,
  height,
  presetPosition,
  requestedPlacement,
  width,
}: ResolveElementPlacementInput): { x: number; y: number } => {
  const centered = {
    x: Math.max(0, Math.round((canvas.width - width) / 2)),
    y: Math.max(0, Math.round((canvas.height - height) / 2)),
  };
  if (requestedPlacement) return requestedPlacement;
  if (presetPosition?.x !== undefined || presetPosition?.y !== undefined) {
    return { x: presetPosition.x ?? centered.x, y: presetPosition.y ?? centered.y };
  }
  const maxX = Math.max(0, canvas.width - width);
  const maxY = Math.max(0, canvas.height - height);
  const overlaps = (point: { x: number; y: number }) => canvas.elements.some((element) => (
    !element.locked
    && point.x < element.x + element.width
    && point.x + width > element.x
    && point.y < element.y + element.height
    && point.y + height > element.y
  ));
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const point = {
      x: Math.min(maxX, centered.x + attempt * 24),
      y: Math.min(maxY, centered.y + attempt * 24),
    };
    if (!overlaps(point)) return point;
  }
  return centered;
};
