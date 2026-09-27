import { rebaseSpatialWorldMove } from '@/components/ui/spatial-world';

/**
 * Desk uses the same elastic-world principle as focused Set layout: authored
 * objects define the usable extent. The minimum keeps an empty/small Desk
 * comfortable; dragging work farther right/down grows the world, and moving it
 * inward removes unused space again.
 */
export const DESK_MIN_WORLD_WIDTH = 960;
export const DESK_MIN_WORLD_HEIGHT = 640;
export const DESK_WORLD_PADDING = 32;
export const DESK_FRAME_PADDING = 44;

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

export interface DeskScrollTarget {
  left: number;
  top: number;
}

export type DeskCameraMode = 'fit-work' | 'fit-selection' | 'whole' | 'custom';

export interface DeskFramingTarget {
  geometry: ReturnType<typeof getDeskCameraGeometry>;
  scroll: DeskScrollTarget;
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
    x: Math.max(0, Math.round(finite(candidate.x))),
    y: Math.max(0, Math.round(finite(candidate.y))),
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

export const getDeskWorldProjection = (viewport: DeskViewport, world: DeskWorldSize) => {
  const width = Math.max(1, viewport.width);
  const height = Math.max(1, viewport.height);
  const worldWidth = Math.max(1, world.width);
  const worldHeight = Math.max(1, world.height);
  const scale = Math.max(Number.EPSILON, Math.min(1, width / worldWidth, height / worldHeight));
  const offsetX = Math.max(0, (width - worldWidth * scale) / 2);
  const offsetY = Math.max(0, (height - worldHeight * scale) / 2);
  return { scale, offsetX, offsetY };
};

/**
 * Whole Desk is the complete current authored world, matching focused Set
 * behavior. The camera never zooms below that fit and has the same bounded
 * close-work ceiling as Set view.
 */
export const getDeskCameraGeometry = (viewport: DeskViewport, world: DeskWorldSize, requestedZoom: number) => {
  const width = Math.max(1, viewport.width);
  const height = Math.max(1, viewport.height);
  const projection = getDeskWorldProjection(viewport, world);
  const fitZoom = Math.max(Number.EPSILON, projection.scale);
  const zoom = clamp(requestedZoom, fitZoom, Math.max(2, fitZoom * 3));
  const worldWidth = Math.max(1, world.width) * zoom;
  const worldHeight = Math.max(1, world.height) * zoom;
  return {
    zoom,
    fitZoom,
    relativeZoom: zoom / fitZoom,
    offsetX: Math.max(0, (width - worldWidth) / 2),
    offsetY: Math.max(0, (height - worldHeight) / 2),
    surfaceWidth: Math.max(width, worldWidth),
    surfaceHeight: Math.max(height, worldHeight),
  };
};

/** Derives one camera target from the union of visible authored objects. */
export const getDeskWorldBounds = (items: readonly Pick<DeskWorldItemRect, 'x' | 'y' | 'width' | 'height'>[]): DeskRect | null => {
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

/** Derives the Desk world from the current authored Set extents, like Set view. */
export const getDeskWorldSize = (
  items: readonly Pick<DeskWorldItemRect, 'x' | 'y' | 'width' | 'height'>[],
  minimum: DeskWorldSize = { width: DESK_MIN_WORLD_WIDTH, height: DESK_MIN_WORLD_HEIGHT },
  padding = DESK_WORLD_PADDING,
): DeskWorldSize => {
  const valid = items.filter((item) => (
    Number.isFinite(item.x)
    && Number.isFinite(item.y)
    && Number.isFinite(item.width)
    && Number.isFinite(item.height)
    && item.width > 0
    && item.height > 0
  ));
  const safePadding = Math.max(0, finite(padding, DESK_WORLD_PADDING));
  return {
    width: Math.max(
      Math.max(1, minimum.width),
      ...valid.map((item) => item.x + item.width + safePadding),
    ),
    height: Math.max(
      Math.max(1, minimum.height),
      ...valid.map((item) => item.y + item.height + safePadding),
    ),
  };
};

/**
 * Frames a content slice inside the stable Desk world. This is camera-only:
 * the target is derived from authored bounds and never normalizes or rewrites
 * those bounds. Invalid or absent bounds safely fall back to Whole Desk.
 */
export const getDeskFramingTarget = ({
  viewport,
  world,
  bounds,
  padding = DESK_FRAME_PADDING,
}: {
  viewport: DeskViewport;
  world: DeskWorldSize;
  bounds: DeskRect | null;
  padding?: number;
}): DeskFramingTarget => {
  const whole = getDeskCameraGeometry(viewport, world, 0);
  if (!bounds) return { geometry: whole, scroll: { left: 0, top: 0 } };
  const targetWidth = Math.max(1, bounds.right - bounds.left);
  const targetHeight = Math.max(1, bounds.bottom - bounds.top);
  const safePadding = clamp(finite(padding, DESK_FRAME_PADDING), 0, Math.min(viewport.width, viewport.height) * 0.3);
  const requestedZoom = Math.min(
    Math.max(1, viewport.width - safePadding * 2) / targetWidth,
    Math.max(1, viewport.height - safePadding * 2) / targetHeight,
  );
  const geometry = getDeskCameraGeometry(viewport, world, requestedZoom);
  const centerX = (bounds.left + bounds.right) / 2;
  const centerY = (bounds.top + bounds.bottom) / 2;
  return {
    geometry,
    scroll: {
      left: clamp(
        centerX * geometry.zoom + geometry.offsetX - viewport.width / 2,
        0,
        Math.max(0, geometry.surfaceWidth - viewport.width),
      ),
      top: clamp(
        centerY * geometry.zoom + geometry.offsetY - viewport.height / 2,
        0,
        Math.max(0, geometry.surfaceHeight - viewport.height),
      ),
    },
  };
};

const DEFAULT_DESK_SLOTS = [
  { x: 484, y: 168 },
  { x: 116, y: 142 },
  { x: 842, y: 202 },
  { x: 242, y: 418 },
  { x: 664, y: 420 },
  { x: 916, y: 104 },
  { x: 36, y: 406 },
  { x: 478, y: 96 },
] as const;

/**
 * New Sets receive a stable place in the canonical Desk field instead of
 * inheriting the dimensions of whichever device first opened it. Additional
 * Sets form small piles over these anchors without creating a second extent.
 */
export const getDefaultDeskWorldPosition = (index: number): DeskWorldPosition => {
  const safeIndex = Math.max(0, Math.floor(index));
  const slot = DEFAULT_DESK_SLOTS[safeIndex % DEFAULT_DESK_SLOTS.length]!;
  const pile = Math.floor(safeIndex / DEFAULT_DESK_SLOTS.length);
  return {
    x: Math.max(0, slot.x + pile * 18),
    y: Math.max(0, slot.y + pile * 16),
    z: safeIndex,
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
    y: stored?.y ?? Math.max(0, Math.round((rect.top - bounds.top - projection.offsetY) / projection.scale)),
    z: stored?.z ?? index,
    width: Math.max(1, Math.round(rect.width / projection.scale)),
    height: Math.max(1, Math.round(rect.height / projection.scale)),
  }];
});

export const moveDeskWorldSelectionWithRebase = ({
  items,
  selectedIds,
  delta,
  snap = 1,
}: {
  items: readonly Pick<DeskWorldItemRect, 'id' | 'x' | 'y' | 'z'>[];
  selectedIds: readonly string[];
  delta: { x: number; y: number };
  snap?: number;
}) => {
  const selected = new Set(selectedIds);
  const step = Math.max(1, snap);
  const placeDelta = (value: number) => Math.round(value / step) * step;
  const proposed = Object.fromEntries(items.flatMap((item) => selected.has(item.id)
    ? [[item.id, { x: item.x + placeDelta(delta.x), y: item.y + placeDelta(delta.y) }] as const]
    : []));
  const rebased = rebaseSpatialWorldMove({ items, proposed });
  const zById = new Map(items.map((item) => [item.id, item.z]));
  return {
    ...rebased,
    positions: Object.fromEntries(Object.entries(rebased.positions).map(([id, position]) => [id, {
      ...position,
      z: zById.get(id) ?? 0,
    }])),
  };
};

export const moveDeskWorldSelection = (input: Parameters<typeof moveDeskWorldSelectionWithRebase>[0]): Record<string, DeskWorldPosition> => {
  const selected = new Set(input.selectedIds);
  const result = moveDeskWorldSelectionWithRebase(input);
  return Object.fromEntries(Object.entries(result.positions).filter(([id]) => selected.has(id)));
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
