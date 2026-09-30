/**
 * Desk authored coordinates are signed and stable. Derived bounds describe the
 * current scene for framing/minimap purposes but never normalize or relocate
 * authored Set positions.
 */
export const DESK_SPATIAL_VERSION = 4 as const;
export const DEFAULT_DESK_GRID_SIZE_MM = 10;
/** Legacy Desk tile scale (14.5rem ≈ 232 CSS px) mapped to an 82 mm Set proxy. */
export const LEGACY_DESK_UNITS_PER_MM = 232 / 82;
export const DESK_MIN_WORLD_WIDTH = 340;
export const DESK_MIN_WORLD_HEIGHT = 226;
export const DESK_WORLD_PADDING = 12;

export interface DeskWorldPosition {
  x: number;
  y: number;
  z: number;
}

export interface DeskWorldGeometry {
  version: typeof DESK_SPATIAL_VERSION;
  positions: Record<string, DeskWorldPosition>;
}

export interface DeskWorldSize {
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

export type DeskCameraMode = 'fit-work' | 'fit-selection' | 'whole' | 'custom';

export interface DeskWorldElement {
  dataset: { deskSetObjectId?: string };
  getBoundingClientRect: () => Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;
}

export interface DeskWorldProjection {
  scale: number;
  offsetX?: number;
  offsetY?: number;
}

const finite = (value: unknown, fallback = 0): number => Number.isFinite(value) ? Number(value) : fallback;
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

export const normalizeDeskWorldPosition = (value: unknown, fallbackZ = 0): DeskWorldPosition | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Partial<DeskWorldPosition>;
  if (!Number.isFinite(candidate.x) || !Number.isFinite(candidate.y)) return null;
  return {
    x: Math.round(finite(candidate.x) * 1000) / 1000,
    y: Math.round(finite(candidate.y) * 1000) / 1000,
    z: clamp(Math.round(finite(candidate.z, fallbackZ)), 0, 10_000),
  };
};

/**
 * v4 is canonical signed millimeter geometry. v2/v3/bare layouts are the old
 * presentation-pixel space and convert exactly once through one uniform scale.
 */
export const isLegacyDeskWorldGeometry = (value: unknown): boolean => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as { version?: unknown; positions?: unknown } & Record<string, unknown>;
  if (record.version === DESK_SPATIAL_VERSION) return false;
  return Boolean(record.positions && typeof record.positions === 'object') || Object.keys(record).length > 0;
};

export const migrateLegacyDeskPositionToMm = (position: DeskWorldPosition): DeskWorldPosition => ({
  x: Math.round(position.x / LEGACY_DESK_UNITS_PER_MM * 1000) / 1000,
  y: Math.round(position.y / LEGACY_DESK_UNITS_PER_MM * 1000) / 1000,
  z: position.z,
});

export const normalizeDeskWorldGeometry = (value: unknown): DeskWorldGeometry => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { version: DESK_SPATIAL_VERSION, positions: {} };
  }
  const record = value as { version?: unknown; positions?: unknown } & Record<string, unknown>;
  const versioned = [2, 3, DESK_SPATIAL_VERSION].includes(Number(record.version))
    && record.positions
    && typeof record.positions === 'object';
  const source = versioned ? record.positions as Record<string, unknown> : record;
  const legacy = record.version !== DESK_SPATIAL_VERSION;
  const positions = Object.fromEntries(Object.entries(source).flatMap(([id, position], index) => {
    if (id === 'version' || id === 'positions') return [];
    const normalized = normalizeDeskWorldPosition(position, index);
    if (!normalized) return [];
    return [[id, legacy ? migrateLegacyDeskPositionToMm(normalized) : normalized] as const];
  }));
  return { version: DESK_SPATIAL_VERSION, positions };
};

export const getDeskWorldBounds = (
  items: readonly Pick<DeskWorldItemRect, 'x' | 'y' | 'width' | 'height'>[],
): DeskRect | null => {
  const valid = items.filter((item) => (
    Number.isFinite(item.x)
    && Number.isFinite(item.y)
    && Number.isFinite(item.width)
    && Number.isFinite(item.height)
    && item.width > 0
    && item.height > 0
  ));
  if (valid.length === 0) return null;
  return {
    left: Math.min(...valid.map((item) => item.x)),
    top: Math.min(...valid.map((item) => item.y)),
    right: Math.max(...valid.map((item) => item.x + item.width)),
    bottom: Math.max(...valid.map((item) => item.y + item.height)),
  };
};

/**
 * A size is presentation/framing metadata only. Absolute world position is
 * intentionally excluded so moving a Set farther from the origin does not
 * resize or rebase the authored scene.
 */
export const getDeskWorldSize = (
  items: readonly Pick<DeskWorldItemRect, 'x' | 'y' | 'width' | 'height'>[],
  minimum: DeskWorldSize = { width: DESK_MIN_WORLD_WIDTH, height: DESK_MIN_WORLD_HEIGHT },
  padding = DESK_WORLD_PADDING,
): DeskWorldSize => {
  const bounds = getDeskWorldBounds(items);
  if (!bounds) return { width: Math.max(1, minimum.width), height: Math.max(1, minimum.height) };
  const safePadding = Math.max(0, finite(padding, DESK_WORLD_PADDING));
  return {
    width: Math.max(Math.max(1, minimum.width), bounds.right - bounds.left + safePadding * 2),
    height: Math.max(Math.max(1, minimum.height), bounds.bottom - bounds.top + safePadding * 2),
  };
};

const DEFAULT_DESK_SLOTS_LEGACY = [
  { x: 484, y: 168 },
  { x: 116, y: 142 },
  { x: 842, y: 202 },
  { x: 242, y: 418 },
  { x: 664, y: 420 },
  { x: 916, y: 104 },
  { x: 36, y: 406 },
  { x: 478, y: 96 },
] as const;

export const getDefaultDeskWorldPosition = (index: number): DeskWorldPosition => {
  const safeIndex = Math.max(0, Math.floor(index));
  const slot = DEFAULT_DESK_SLOTS_LEGACY[safeIndex % DEFAULT_DESK_SLOTS_LEGACY.length]!;
  const pile = Math.floor(safeIndex / DEFAULT_DESK_SLOTS_LEGACY.length);
  return migrateLegacyDeskPositionToMm({
    x: slot.x + pile * 18,
    y: slot.y + pile * 16,
    z: safeIndex,
  });
};

export const collectDeskWorldItems = ({
  tiles,
  bounds,
  projection,
  positions,
}: {
  tiles: Iterable<DeskWorldElement>;
  bounds: Pick<DOMRect, 'left' | 'top'>;
  projection: DeskWorldProjection;
  positions: Readonly<Record<string, DeskWorldPosition>>;
}): DeskWorldItemRect[] => Array.from(tiles).flatMap((tile, index) => {
  const id = tile.dataset.deskSetObjectId;
  if (!id) return [];
  const rect = tile.getBoundingClientRect();
  const stored = positions[id];
  const scale = Math.max(Number.EPSILON, finite(projection.scale, 1));
  return [{
    id,
    x: stored?.x ?? Math.round((rect.left - bounds.left - finite(projection.offsetX)) / scale),
    y: stored?.y ?? Math.round((rect.top - bounds.top - finite(projection.offsetY)) / scale),
    z: stored?.z ?? index,
    width: Math.max(1, Math.round(rect.width / scale)),
    height: Math.max(1, Math.round(rect.height / scale)),
  }];
});

export const moveDeskWorldSelectionResult = ({
  items,
  selectedIds,
  delta,
  snap = 0,
}: {
  items: readonly Pick<DeskWorldItemRect, 'id' | 'x' | 'y' | 'z'>[];
  selectedIds: readonly string[];
  delta: { x: number; y: number };
  snap?: number;
}) => {
  const selected = new Set(selectedIds);
  const step = Number.isFinite(snap) && snap > 0 ? snap : 0;
  const placeDelta = (value: number) => step > 0
    ? Math.round(value / step) * step
    : Math.round(value * 1000) / 1000;
  const affected = items.filter((item) => selected.has(item.id));
  return {
    positions: Object.fromEntries(affected.map((item) => [item.id, {
      x: Math.round((item.x + placeDelta(delta.x)) * 1000) / 1000,
      y: Math.round((item.y + placeDelta(delta.y)) * 1000) / 1000,
      z: item.z,
    }])),
    affectedIds: affected.map((item) => item.id),
  };
};

export const moveDeskWorldSelection = (
  input: Parameters<typeof moveDeskWorldSelectionResult>[0],
): Record<string, DeskWorldPosition> => moveDeskWorldSelectionResult(input).positions;

export const getDeskMarqueeSelection = (
  items: readonly (DeskWorldItemRect & { hidden?: boolean })[],
  marquee: DeskRect,
): string[] => items.filter((item) => !item.hidden && (
  item.x < marquee.right
  && item.x + item.width > marquee.left
  && item.y < marquee.bottom
  && item.y + item.height > marquee.top
)).map((item) => item.id);
