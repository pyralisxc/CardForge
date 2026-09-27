export interface SpatialAuthoredPosition {
  id: string;
  x: number;
  y: number;
}

export interface SpatialOriginShift {
  x: number;
  y: number;
}

export interface SpatialWorldRebaseResult {
  positions: Record<string, { x: number; y: number }>;
  originShift: SpatialOriginShift;
  affectedIds: string[];
}

/**
 * Keeps authored coordinates non-negative without creating a hard top/left
 * movement edge. Callers provide their domain-specific proposed positions;
 * when any proposal crosses the origin, the complete authored world shifts by
 * the same amount so relative placement stays intact.
 */
export const rebaseSpatialWorldMove = ({
  items,
  proposed,
}: {
  items: readonly SpatialAuthoredPosition[];
  proposed: Readonly<Record<string, { x: number; y: number }>>;
}): SpatialWorldRebaseResult => {
  if (items.length === 0 || Object.keys(proposed).length === 0) {
    return { positions: {}, originShift: { x: 0, y: 0 }, affectedIds: [] };
  }
  const projected = items.map((item) => ({
    id: item.id,
    ...(proposed[item.id] ?? { x: item.x, y: item.y }),
  }));
  const minimumX = Math.min(0, ...projected.map((item) => item.x));
  const minimumY = Math.min(0, ...projected.map((item) => item.y));
  const originShift = {
    x: Math.max(0, Math.round(-minimumX)),
    y: Math.max(0, Math.round(-minimumY)),
  };
  const rebasing = originShift.x > 0 || originShift.y > 0;
  const movedIds = new Set(Object.keys(proposed));
  const affectedIds = rebasing
    ? items.map((item) => item.id)
    : items.filter((item) => movedIds.has(item.id)).map((item) => item.id);

  return {
    positions: Object.fromEntries(projected.map((item) => [item.id, {
      x: Math.max(0, Math.round(item.x + originShift.x)),
      y: Math.max(0, Math.round(item.y + originShift.y)),
    }])),
    originShift,
    affectedIds,
  };
};

export const getSpatialOriginCompensatedScroll = ({
  scroll,
  originShift,
  zoom,
}: {
  scroll: { left: number; top: number };
  originShift: SpatialOriginShift;
  zoom: number;
}) => ({
  left: Math.max(0, scroll.left + originShift.x * zoom),
  top: Math.max(0, scroll.top + originShift.y * zoom),
});
