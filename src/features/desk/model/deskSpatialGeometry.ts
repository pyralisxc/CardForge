/**
 * One canonical bounded Desk field. Placement, persistence, camera projection,
 * marquee selection, and framing all use this same coordinate extent so users
 * never see camera space that cannot also hold authored work.
 */
export const DESK_SURFACE_WIDTH = 1520;
export const DESK_SURFACE_HEIGHT = 1140;
export const DESK_MAX_RELATIVE_ZOOM = 8;
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
    x: clamp(Math.round(finite(candidate.x)), 0, DESK_SURFACE_WIDTH),
    y: clamp(Math.round(finite(candidate.y)), 0, DESK_SURFACE_HEIGHT),
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
  const scale = Math.min(width / DESK_SURFACE_WIDTH, height / DESK_SURFACE_HEIGHT);
  const offsetX = Math.max(0, (width - DESK_SURFACE_WIDTH * scale) / 2);
  const offsetY = Math.max(0, (height - DESK_SURFACE_HEIGHT * scale) / 2);
  return { scale, offsetX, offsetY };
};

/**
 * The Desk has one bounded world. Whole is its minimum useful camera scale:
 * the complete Desk is visible and panning is unnecessary. Semantic fits and
 * Custom zoom move only inward from that floor, so there is no off-Desk area.
 */
export const getDeskCameraGeometry = (viewport: DeskViewport, requestedZoom: number) => {
  const width = Math.max(1, viewport.width);
  const height = Math.max(1, viewport.height);
  const projection = getDeskWorldProjection(viewport);
  const fitZoom = Math.max(Number.EPSILON, projection.scale);
  const zoom = clamp(requestedZoom, fitZoom, fitZoom * DESK_MAX_RELATIVE_ZOOM);
  const worldWidth = DESK_SURFACE_WIDTH * zoom;
  const worldHeight = DESK_SURFACE_HEIGHT * zoom;
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

/**
 * Frames a content slice inside the stable Desk world. This is camera-only:
 * the target is derived from authored bounds and never normalizes or rewrites
 * those bounds. Invalid or absent bounds safely fall back to Whole Desk.
 */
export const getDeskFramingTarget = ({
  viewport,
  bounds,
  padding = DESK_FRAME_PADDING,
}: {
  viewport: DeskViewport;
  bounds: DeskRect | null;
  padding?: number;
}): DeskFramingTarget => {
  const whole = getDeskCameraGeometry(viewport, 0);
  if (!bounds) return { geometry: whole, scroll: { left: 0, top: 0 } };
  const targetWidth = Math.max(1, bounds.right - bounds.left);
  const targetHeight = Math.max(1, bounds.bottom - bounds.top);
  const safePadding = clamp(finite(padding, DESK_FRAME_PADDING), 0, Math.min(viewport.width, viewport.height) * 0.3);
  const requestedZoom = Math.min(
    Math.max(1, viewport.width - safePadding * 2) / targetWidth,
    Math.max(1, viewport.height - safePadding * 2) / targetHeight,
  );
  const geometry = getDeskCameraGeometry(viewport, requestedZoom);
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
    x: clamp(slot.x + pile * 18, 0, DESK_SURFACE_WIDTH),
    y: clamp(slot.y + pile * 16, 0, DESK_SURFACE_HEIGHT),
    z: safeIndex,
  };
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
    y: stored?.y ?? Math.max(0, Math.round((rect.top - bounds.top - projection.offsetY) / projection.scale)),
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
  const dx = clamp(place(delta.x), -minimumX, DESK_SURFACE_WIDTH - maximumX);
  const dy = clamp(place(delta.y), -minimumY, DESK_SURFACE_HEIGHT - maximumY);
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
