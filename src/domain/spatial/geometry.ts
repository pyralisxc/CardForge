import type {
  SpatialCamera2D,
  SpatialLattice,
  SpatialPoint,
  SpatialRect,
  SpatialTransform2D,
  SpatialViewportSize,
} from './types';

const finite = (value: number, fallback = 0): number => (
  Number.isFinite(value) ? value : fallback
);

const positive = (value: number, fallback = 1): number => (
  Number.isFinite(value) && value > 0 ? value : fallback
);

const clamp = (value: number, minimum: number, maximum: number): number => (
  Math.min(maximum, Math.max(minimum, value))
);

export const normalizeSpatialCamera = (camera: SpatialCamera2D): SpatialCamera2D => ({
  x: finite(camera.x),
  y: finite(camera.y),
  zoom: positive(camera.zoom),
});

export const fitSpatialCameraToRect = ({
  bounds,
  viewport,
  padding = 0,
  minZoom = 0.04,
  maxZoom = 4,
}: {
  bounds: SpatialRect;
  viewport: SpatialViewportSize;
  padding?: number;
  minZoom?: number;
  maxZoom?: number;
}): SpatialCamera2D => {
  const viewportWidth = positive(viewport.width);
  const viewportHeight = positive(viewport.height);
  const width = positive(bounds.width);
  const height = positive(bounds.height);
  const maximumPadding = Math.max(0, Math.min(viewportWidth, viewportHeight) / 2 - 1);
  const safePadding = clamp(finite(padding), 0, maximumPadding);
  const minimumZoom = positive(minZoom, 0.04);
  const maximumZoom = Math.max(minimumZoom, positive(maxZoom, 4));
  const zoom = clamp(Math.min(
    Math.max(1, viewportWidth - safePadding * 2) / width,
    Math.max(1, viewportHeight - safePadding * 2) / height,
  ), minimumZoom, maximumZoom);
  return {
    x: finite(bounds.x) + width / 2,
    y: finite(bounds.y) + height / 2,
    zoom,
  };
};

export const projectSpatialWorldToScreen = (
  point: SpatialPoint,
  camera: SpatialCamera2D,
  viewport: SpatialViewportSize,
): SpatialPoint => {
  const normalized = normalizeSpatialCamera(camera);
  return {
    x: (finite(point.x) - normalized.x) * normalized.zoom + positive(viewport.width) / 2,
    y: (finite(point.y) - normalized.y) * normalized.zoom + positive(viewport.height) / 2,
  };
};

export const projectSpatialScreenToWorld = (
  point: SpatialPoint,
  camera: SpatialCamera2D,
  viewport: SpatialViewportSize,
): SpatialPoint => {
  const normalized = normalizeSpatialCamera(camera);
  return {
    x: normalized.x + (finite(point.x) - positive(viewport.width) / 2) / normalized.zoom,
    y: normalized.y + (finite(point.y) - positive(viewport.height) / 2) / normalized.zoom,
  };
};

export const composeSpatialTranslation = (
  parent: SpatialTransform2D,
  local: SpatialTransform2D,
): SpatialTransform2D => ({
  x: finite(parent.x) + finite(local.x),
  y: finite(parent.y) + finite(local.y),
});

export const getSpatialLocalTranslation = (
  parentWorld: SpatialTransform2D,
  childWorld: SpatialTransform2D,
): SpatialTransform2D => ({
  x: finite(childWorld.x) - finite(parentWorld.x),
  y: finite(childWorld.y) - finite(parentWorld.y),
});

export const getSpatialRectUnion = (
  rects: readonly SpatialRect[],
): SpatialRect | null => {
  const valid = rects.filter((rect) => (
    Number.isFinite(rect.x)
    && Number.isFinite(rect.y)
    && Number.isFinite(rect.width)
    && Number.isFinite(rect.height)
    && rect.width >= 0
    && rect.height >= 0
  ));
  if (valid.length === 0) return null;

  const left = Math.min(...valid.map((rect) => rect.x));
  const top = Math.min(...valid.map((rect) => rect.y));
  const right = Math.max(...valid.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...valid.map((rect) => rect.y + rect.height));
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
};

export const snapSpatialValue = (
  value: number,
  origin: number,
  step: number,
): number => {
  const safeValue = finite(value);
  const safeOrigin = finite(origin);
  if (!Number.isFinite(step) || step <= 0) return safeValue;
  return safeOrigin + Math.round((safeValue - safeOrigin) / step) * step;
};

export const snapSpatialPoint = (
  point: SpatialPoint,
  lattice: SpatialLattice,
): SpatialPoint => ({
  x: snapSpatialValue(point.x, lattice.origin.x, lattice.stepX),
  y: snapSpatialValue(point.y, lattice.origin.y, lattice.stepY),
});

export const getSpatialLatticeScreenStep = (
  lattice: SpatialLattice,
  camera: SpatialCamera2D,
): { x: number; y: number; majorX: number; majorY: number } => {
  const zoom = normalizeSpatialCamera(camera).zoom;
  const majorEvery = Math.max(1, Math.round(positive(lattice.majorEvery)));
  return {
    x: positive(lattice.stepX) * zoom,
    y: positive(lattice.stepY) * zoom,
    majorX: positive(lattice.stepX) * majorEvery * zoom,
    majorY: positive(lattice.stepY) * majorEvery * zoom,
  };
};

const edgeAxisVelocity = (
  position: number,
  extent: number,
  edgeZone: number,
  maxScreenSpeed: number,
): number => {
  const safeExtent = positive(extent);
  const safeZone = clamp(positive(edgeZone), 1, safeExtent / 2);
  const speed = Math.max(0, finite(maxScreenSpeed));
  if (position < safeZone) {
    const depth = clamp((safeZone - position) / safeZone, 0, 1);
    return -speed * depth * depth;
  }
  if (position > safeExtent - safeZone) {
    const depth = clamp((position - (safeExtent - safeZone)) / safeZone, 0, 1);
    return speed * depth * depth;
  }
  return 0;
};

export const getSpatialEdgePanScreenVelocity = ({
  pointer,
  viewport,
  edgeZone = 64,
  maxScreenSpeed = 720,
}: {
  pointer: SpatialPoint;
  viewport: SpatialViewportSize;
  edgeZone?: number;
  maxScreenSpeed?: number;
}): SpatialPoint => ({
  x: edgeAxisVelocity(pointer.x, viewport.width, edgeZone, maxScreenSpeed),
  y: edgeAxisVelocity(pointer.y, viewport.height, edgeZone, maxScreenSpeed),
});

export const projectSpatialScreenVelocityToWorld = (
  velocity: SpatialPoint,
  zoom: number,
): SpatialPoint => {
  const safeZoom = positive(zoom);
  return {
    x: finite(velocity.x) / safeZoom,
    y: finite(velocity.y) / safeZoom,
  };
};
