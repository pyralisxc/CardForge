export const DESK_WORLD_WIDTH = 1200;
export const DESK_WORLD_HEIGHT = 720;
export const DESK_WORLD_TOOLBAR_CLEARANCE = 86;

export interface DeskWorldPosition {
  x: number;
  y: number;
  z: number;
}

export interface DeskWorldGeometry {
  version: 2;
  positions: Record<string, DeskWorldPosition>;
}

export interface DeskViewport {
  width: number;
  height: number;
}

export interface DeskWorldItemRect extends DeskWorldPosition {
  id: string;
  width: number;
  height: number;
}

export interface DeskRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface DeskWorldElement {
  dataset: { deskSetObjectId?: string };
  getBoundingClientRect: () => Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;
}

const finite = (value: unknown, fallback = 0): number => Number.isFinite(value) ? Number(value) : fallback;
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

export const normalizeDeskWorldPosition = (value: unknown, fallbackZ = 0): DeskWorldPosition | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Partial<DeskWorldPosition>;
  if (!Number.isFinite(candidate.x) || !Number.isFinite(candidate.y)) return null;
  return {
    x: clamp(Math.round(finite(candidate.x)), 0, DESK_WORLD_WIDTH),
    y: clamp(Math.round(finite(candidate.y)), DESK_WORLD_TOOLBAR_CLEARANCE, DESK_WORLD_HEIGHT),
    z: clamp(Math.round(finite(candidate.z, fallbackZ)), 0, 10_000),
  };
};

/**
 * Reads canonical geometry and the pre-hardening bare pixel map. The legacy map
 * is interpreted in the stable Desk world once and all subsequent writes use v2.
 */
export const normalizeDeskWorldGeometry = (value: unknown): DeskWorldGeometry => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { version: 2, positions: {} };
  const record = value as { version?: unknown; positions?: unknown } & Record<string, unknown>;
  const source = record.version === 2 && record.positions && typeof record.positions === 'object'
    ? record.positions as Record<string, unknown>
    : record;
  const positions = Object.fromEntries(Object.entries(source).flatMap(([id, position], index) => {
    if (id === 'version' || id === 'positions') return [];
    const normalized = normalizeDeskWorldPosition(position, index);
    return normalized ? [[id, normalized] as const] : [];
  }));
  return { version: 2, positions };
};

export const getDeskWorldProjection = (viewport: DeskViewport) => {
  const width = Math.max(1, viewport.width);
  const height = Math.max(1, viewport.height);
  const scale = Math.min(width / DESK_WORLD_WIDTH, height / DESK_WORLD_HEIGHT);
  const offsetX = Math.max(0, (width - DESK_WORLD_WIDTH * scale) / 2);
  const offsetY = Math.max(0, (height - DESK_WORLD_HEIGHT * scale) / 2);
  return { scale, offsetX, offsetY };
};

export const projectDeskWorldPosition = (position: DeskWorldPosition, viewport: DeskViewport) => {
  const projection = getDeskWorldProjection(viewport);
  return {
    x: Math.round(projection.offsetX + position.x * projection.scale),
    y: Math.round(projection.offsetY + position.y * projection.scale),
    z: position.z,
  };
};

export const collectDeskWorldItems = ({
  tiles,
  bounds,
  projection,
  positions,
}: {
  tiles: Iterable<DeskWorldElement>;
  bounds: Pick<DOMRect, 'left' | 'top'>;
  projection: ReturnType<typeof getDeskWorldProjection>;
  positions: Readonly<Record<string, DeskWorldPosition>>;
}): DeskWorldItemRect[] => Array.from(tiles).flatMap((tile, index) => {
  const id = tile.dataset.deskSetObjectId;
  if (!id) return [];
  const rect = tile.getBoundingClientRect();
  const stored = positions[id];
  return [{
    id,
    x: stored?.x ?? Math.round((rect.left - bounds.left - projection.offsetX) / projection.scale),
    y: stored?.y ?? Math.max(DESK_WORLD_TOOLBAR_CLEARANCE, Math.round((rect.top - bounds.top - projection.offsetY) / projection.scale)),
    z: stored?.z ?? index,
    width: Math.max(1, Math.round(rect.width / projection.scale)),
    height: Math.max(1, Math.round(rect.height / projection.scale)),
  }];
});

export const moveDeskWorldSelection = ({
  items,
  selectedIds,
  delta,
  snap = 1,
}: {
  items: readonly DeskWorldItemRect[];
  selectedIds: readonly string[];
  delta: { x: number; y: number };
  snap?: number;
}): Record<string, DeskWorldPosition> => {
  const selected = items.filter((item) => selectedIds.includes(item.id));
  if (selected.length === 0) return {};
  const minimumX = Math.min(...selected.map((item) => item.x));
  const minimumY = Math.min(...selected.map((item) => item.y));
  const maximumX = Math.max(...selected.map((item) => item.x + item.width));
  const maximumY = Math.max(...selected.map((item) => item.y + item.height));
  const place = (value: number) => Math.round(value / Math.max(1, snap)) * Math.max(1, snap);
  const dx = clamp(place(delta.x), -minimumX, DESK_WORLD_WIDTH - maximumX);
  const dy = clamp(place(delta.y), DESK_WORLD_TOOLBAR_CLEARANCE - minimumY, DESK_WORLD_HEIGHT - maximumY);
  return Object.fromEntries(selected.map((item) => [item.id, {
    x: Math.round(item.x + dx),
    y: Math.round(item.y + dy),
    z: item.z,
  }]));
};

export const getDeskMarqueeSelection = (
  items: readonly (DeskWorldItemRect & { hidden?: boolean })[],
  marquee: DeskRect,
): string[] => items.filter((item) => !item.hidden && (
  item.x < marquee.right
  && item.x + item.width > marquee.left
  && item.y < marquee.bottom
  && item.y + item.height > marquee.top
)).map((item) => item.id);
