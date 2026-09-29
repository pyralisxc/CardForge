import type { ArtifactIdentity, ArtifactPosition } from '@/domain/artifacts';
import { fitSpatialCameraToRect, type SpatialRect } from '@/domain/spatial';

export const FOCUSED_ARTIFACT_OVERSCAN = 48;
export const SET_SPATIAL_VERSION = 2 as const;
export const DEFAULT_SET_GRID_SIZE_MM = 5;
/** One-time deterministic bridge from legacy comfortable-card layout units. */
export const LEGACY_SET_UNITS_PER_MM = 176 / 63;

export const migrateLegacySetPositionsToMm = (
  positions: Readonly<Record<string, ArtifactPosition>>,
): Record<string, ArtifactPosition> => Object.fromEntries(Object.entries(positions).map(([id, position]) => [id, {
  x: Math.round(position.x / LEGACY_SET_UNITS_PER_MM * 1000) / 1000,
  y: Math.round(position.y / LEGACY_SET_UNITS_PER_MM * 1000) / 1000,
}]));

export type FocusedArtifactArrangement = 'manual' | 'grid' | 'stack';
export type FocusedArtifactDensity = 'comfortable' | 'compact' | 'dense';

export interface FocusedArtifactSeed {
  identity: ArtifactIdentity;
  title: string;
  subtitle: string;
  groupLabel: string;
  position?: ArtifactPosition;
  /** Derived physical truth; never a second persistence owner. */
  physicalSizeMm?: { widthMm: number; heightMm: number };
}

export interface FocusedArtifactGroup {
  label: string;
  artifacts: FocusedArtifactSeed[];
}

export interface FocusedArtifactLayoutEntry extends FocusedArtifactSeed {
  index: number;
  position: ArtifactPosition;
  /** Total interactive tile extent, including presentation chrome. */
  width: number;
  height: number;
  /** Physical Artifact projection inside the tile. */
  contentWidth: number;
  contentHeight: number;
}

export type ArtifactBrowseDirection = 'up' | 'down' | 'left' | 'right';

export interface FocusedArtifactGroupLayout {
  label: string;
  x: number;
  y: number;
  width: number;
  count: number;
}

export interface FocusedArtifactLayout {
  entries: FocusedArtifactLayoutEntry[];
  groups: FocusedArtifactGroupLayout[];
  /** Signed authored-space extent including presentation breathing room. */
  bounds: SpatialRect;
  width: number;
  height: number;
  density: FocusedArtifactDensity;
  artifactWidth: number;
  artifactHeight: number;
}

export interface ArtifactViewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FocusedArtifactPresentation {
  density: FocusedArtifactDensity;
  /** Fallback extent for unresolved/non-physical Artifacts. */
  width: number;
  height: number;
  gapX: number;
  gapY: number;
  stackOffset: number;
}

const PRESENTATIONS: Record<FocusedArtifactDensity, FocusedArtifactPresentation> = {
  comfortable: { density: 'comfortable', width: 63, height: 88, gapX: 8, gapY: 10, stackOffset: 10 },
  compact: { density: 'compact', width: 63, height: 88, gapX: 6, gapY: 8, stackOffset: 8 },
  dense: { density: 'dense', width: 63, height: 88, gapX: 4, gapY: 6, stackOffset: 6 },
};

const ARTIFACT_TILE_INLINE_CHROME = 6;
const ARTIFACT_TILE_BLOCK_CHROME = 18;

const getArtifactPresentationExtent = (
  artifact: FocusedArtifactSeed,
  presentation: FocusedArtifactPresentation,
) => {
  const widthMm = Number(artifact.physicalSizeMm?.widthMm);
  const heightMm = Number(artifact.physicalSizeMm?.heightMm);
  if (widthMm > 0 && heightMm > 0) {
    const contentWidth = widthMm;
    const contentHeight = heightMm;
    return {
      contentWidth,
      contentHeight,
      width: contentWidth + ARTIFACT_TILE_INLINE_CHROME,
      height: contentHeight + ARTIFACT_TILE_BLOCK_CHROME,
    };
  }
  return {
    contentWidth: Math.max(1, presentation.width - ARTIFACT_TILE_INLINE_CHROME),
    contentHeight: Math.max(1, presentation.height - ARTIFACT_TILE_BLOCK_CHROME),
    width: presentation.width,
    height: presentation.height,
  };
};

const finiteCoordinate = (value: number | undefined, fallback: number): number => (
  Number.isFinite(value) ? Number(value) : fallback
);

/**
 * Presentation density belongs to the Set view rather than the authored card.
 * A roomy workspace with a small Set should feel comfortable; larger collections
 * become progressively denser, and stacks compact one step further because their
 * purpose is consolidation. The three discrete states avoid jitter from tiny
 * viewport changes while keeping the underlying Artifact identity/position model
 * stable.
 */
export const getFocusedArtifactPresentation = ({
  arrangement,
  artifactCount,
}: {
  arrangement: FocusedArtifactArrangement;
  artifactCount: number;
  availableWidth: number;
}): FocusedArtifactPresentation => {
  // Density is content-derived so resizing the browser never rearranges the
  // authored Set. The availableWidth argument remains for call compatibility,
  // but presentation now belongs to the collection rather than the device.
  let density: FocusedArtifactDensity = artifactCount <= 12
    ? 'comfortable'
    : artifactCount <= 64
      ? 'compact'
      : 'dense';

  if (arrangement === 'stack') {
    density = density === 'comfortable' ? 'compact' : 'dense';
  }
  return PRESENTATIONS[density];
};

const getBalancedColumnCount = ({
  arrangement,
  groups,
  presentation,
}: {
  arrangement: Exclude<FocusedArtifactArrangement, 'manual'>;
  groups: readonly FocusedArtifactGroup[];
  presentation: FocusedArtifactPresentation;
}): number => {
  const allArtifacts = groups.flatMap((group) => group.artifacts);
  const extents = allArtifacts.map((artifact) => getArtifactPresentationExtent(artifact, presentation));
  const largestGroup = Math.max(1, ...groups.map((group) => group.artifacts.length));
  const maximum = arrangement === 'stack' ? Math.min(24, largestGroup) : largestGroup;
  const maximumWidth = Math.max(presentation.width, ...extents.map((extent) => extent.width));
  const maximumHeight = Math.max(presentation.height, ...extents.map((extent) => extent.height));
  let best = { columns: 1, score: Number.POSITIVE_INFINITY };
  for (let columns = 1; columns <= maximum; columns += 1) {
    const stepX = arrangement === 'stack' ? presentation.stackOffset : maximumWidth + presentation.gapX;
    const width = 48 + maximumWidth + (Math.min(columns, largestGroup) - 1) * stepX;
    const height = groups.reduce((total, group) => (
      total + 42 + Math.max(1, Math.ceil(group.artifacts.length / columns)) * (maximumHeight + presentation.gapY)
    ), 0);
    const emptySlots = groups.reduce((total, group) => total + Math.ceil(group.artifacts.length / columns) * columns - group.artifacts.length, 0);
    const ratioScore = Math.abs(Math.log(Math.max(Number.EPSILON, width / Math.max(1, height)) / (4 / 3)));
    const score = ratioScore + emptySlots / Math.max(1, allArtifacts.length) * 0.08;
    if (score < best.score) best = { columns, score };
  }
  return best.columns;
};

/** Whole Set is a derived camera target over signed authored bounds. */
export const getFocusedArtifactFitZoom = ({
  layout,
  viewportWidth,
  viewportHeight,
}: {
  layout: Pick<FocusedArtifactLayout, 'bounds'>;
  viewportWidth: number;
  viewportHeight: number;
}): number => fitSpatialCameraToRect({
  bounds: layout.bounds,
  viewport: { width: viewportWidth, height: viewportHeight },
  padding: 24,
  minZoom: 0.04,
  maxZoom: 4,
}).zoom;

export interface FocusedArtifactFrame {
  x: number;
  y: number;
  zoom: number;
}

export const getFocusedArtifactFrame = ({
  layout,
  entries,
  viewportWidth,
  viewportHeight,
  padding = 40,
}: {
  layout: FocusedArtifactLayout;
  entries: readonly FocusedArtifactLayoutEntry[];
  viewportWidth: number;
  viewportHeight: number;
  padding?: number;
}): FocusedArtifactFrame => {
  const targetBounds = entries.length === 0
    ? layout.bounds
    : (() => {
        const left = Math.min(...entries.map((entry) => entry.position.x));
        const top = Math.min(...entries.map((entry) => entry.position.y));
        const right = Math.max(...entries.map((entry) => entry.position.x + entry.width));
        const bottom = Math.max(...entries.map((entry) => entry.position.y + entry.height));
        return { x: left, y: top, width: right - left, height: bottom - top };
      })();
  return fitSpatialCameraToRect({
    bounds: targetBounds,
    viewport: { width: viewportWidth, height: viewportHeight },
    padding,
    minZoom: 0.04,
    maxZoom: 4,
  });
};

export const buildFocusedArtifactLayout = ({
  arrangement,
  groups,
  minimumWidth,
  minimumHeight = 360,
}: {
  arrangement: FocusedArtifactArrangement;
  groups: readonly FocusedArtifactGroup[];
  minimumWidth: number;
  minimumHeight?: number;
}): FocusedArtifactLayout => {
  const artifactCount = groups.reduce((total, group) => total + group.artifacts.length, 0);
  const presentation = getFocusedArtifactPresentation({ arrangement, artifactCount, availableWidth: minimumWidth });
  const sized = groups.flatMap((group) => group.artifacts.map((artifact) => ({
    artifact,
    extent: getArtifactPresentationExtent(artifact, presentation),
  })));
  const maximumWidth = Math.max(presentation.width, ...sized.map(({ extent }) => extent.width));
  const maximumHeight = Math.max(presentation.height, ...sized.map(({ extent }) => extent.height));
  const columns = arrangement === 'manual'
    ? Math.max(1, Math.floor((Math.max(maximumWidth + 48, Math.round(minimumWidth)) - 48) / (maximumWidth + presentation.gapX)))
    : getBalancedColumnCount({ arrangement, groups, presentation });
  const entries: FocusedArtifactLayoutEntry[] = [];
  const groupLayouts: FocusedArtifactGroupLayout[] = [];
  let nextIndex = 0;
  let groupTop = 30;

  for (const group of groups) {
    const groupColumns = Math.max(1, Math.min(columns, group.artifacts.length));
    const groupStart = entries.length;
    const contentTop = groupTop + 30;

    group.artifacts.forEach((artifact, groupIndex) => {
      const extent = getArtifactPresentationExtent(artifact, presentation);
      const column = groupIndex % groupColumns;
      const row = Math.floor(groupIndex / groupColumns);
      const fallbackX = 24 + (nextIndex % columns) * (maximumWidth + presentation.gapX);
      const fallbackY = 30 + Math.floor(nextIndex / columns) * (maximumHeight + presentation.gapY);
      let position: ArtifactPosition;
      if (arrangement === 'manual') {
        position = {
          x: finiteCoordinate(artifact.position?.x, fallbackX),
          y: finiteCoordinate(artifact.position?.y, fallbackY),
        };
      } else if (arrangement === 'stack') {
        position = {
          x: 24 + column * presentation.stackOffset,
          y: contentTop + row * (maximumHeight + presentation.gapY),
        };
      } else {
        position = {
          x: 24 + column * (maximumWidth + presentation.gapX),
          y: contentTop + row * (maximumHeight + presentation.gapY),
        };
      }
      entries.push({
        ...artifact,
        index: nextIndex,
        position,
        ...extent,
      });
      nextIndex += 1;
    });

    const groupEntries = entries.slice(groupStart);
    const groupRight = Math.max(24, ...groupEntries.map((entry) => entry.position.x + entry.width));
    groupLayouts.push({
      label: group.label,
      x: 24,
      y: groupTop,
      width: Math.max(1, groupRight - 24),
      count: group.artifacts.length,
    });

    if (arrangement !== 'manual') {
      const groupBottom = Math.max(contentTop, ...groupEntries.map((entry) => entry.position.y + entry.height));
      groupTop = groupBottom + 12;
    }
  }

  const minimumSceneWidth = arrangement === 'manual'
    ? Math.max(maximumWidth + 48, Math.round(minimumWidth))
    : maximumWidth + 48;
  const minimumSceneHeight = arrangement === 'manual'
    ? Math.max(minimumHeight, 360)
    : 360;
  const rawLeft = entries.length ? Math.min(...entries.map((entry) => entry.position.x)) - 24 : -minimumSceneWidth / 2;
  const rawTop = entries.length ? Math.min(...entries.map((entry) => entry.position.y)) - 30 : -minimumSceneHeight / 2;
  const rawRight = entries.length ? Math.max(...entries.map((entry) => entry.position.x + entry.width)) + 24 : minimumSceneWidth / 2;
  const rawBottom = entries.length ? Math.max(...entries.map((entry) => entry.position.y + entry.height)) + 30 : minimumSceneHeight / 2;
  const contentWidth = rawRight - rawLeft;
  const contentHeight = rawBottom - rawTop;
  const centerX = (rawLeft + rawRight) / 2;
  const centerY = (rawTop + rawBottom) / 2;
  const width = Math.max(minimumSceneWidth, contentWidth);
  const height = Math.max(minimumSceneHeight, contentHeight);
  const bounds = {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
  };
  return {
    entries,
    groups: groupLayouts,
    bounds,
    width,
    height,
    density: presentation.density,
    artifactWidth: Math.max(presentation.width, ...entries.map((entry) => entry.width)),
    artifactHeight: Math.max(presentation.height, ...entries.map((entry) => entry.height)),
  };
};

export const projectVisibleArtifacts = (
  layout: FocusedArtifactLayout,
  viewport: ArtifactViewport,
  overscan: number = FOCUSED_ARTIFACT_OVERSCAN,
): FocusedArtifactLayoutEntry[] => {
  const left = viewport.x - overscan;
  const top = viewport.y - overscan;
  const right = viewport.x + viewport.width + overscan;
  const bottom = viewport.y + viewport.height + overscan;
  return layout.entries.filter((entry) => (
    entry.position.x + entry.width >= left
    && entry.position.x <= right
    && entry.position.y + entry.height >= top
    && entry.position.y <= bottom
  ));
};

export const moveFocusedArtifactSelectionResult = ({
  entries,
  selectedIds,
  delta,
  snapToGrid,
  gridStep = DEFAULT_SET_GRID_SIZE_MM,
}: {
  entries: readonly FocusedArtifactLayoutEntry[];
  selectedIds: readonly string[];
  delta: ArtifactPosition;
  snapToGrid: boolean;
  gridStep?: number;
}) => {
  const selected = new Set(selectedIds);
  const safeGridStep = Number.isFinite(gridStep) && gridStep > 0 ? gridStep : DEFAULT_SET_GRID_SIZE_MM;
  const snap = (value: number) => snapToGrid
    ? Math.round(value / safeGridStep) * safeGridStep
    : Math.round(value * 1000) / 1000;
  const affected = entries.filter((entry) => selected.has(entry.identity.artifactId));
  return {
    positions: Object.fromEntries(affected.map((entry) => [entry.identity.artifactId, {
      x: snap(entry.position.x + delta.x),
      y: snap(entry.position.y + delta.y),
    }])),
    affectedIds: affected.map((entry) => entry.identity.artifactId),
  };
};

export const moveFocusedArtifactSelection = (
  input: Parameters<typeof moveFocusedArtifactSelectionResult>[0],
): Record<string, ArtifactPosition> => moveFocusedArtifactSelectionResult(input).positions;

/**
 * Focused Artifact browsing follows the displayed Desk geometry, not the
 * collection's incidental array order. A direct neighbor wins over a farther
 * diagonal one; a nearly perpendicular card is not treated as "right" merely
 * because it is one pixel to the right.
 */
export const getDirectionalArtifactNeighbor = ({
  entries,
  artifactId,
  direction,
}: {
  entries: readonly FocusedArtifactLayoutEntry[];
  artifactId: string;
  direction: ArtifactBrowseDirection;
}): FocusedArtifactLayoutEntry | null => {
  const current = entries.find((entry) => entry.identity.artifactId === artifactId);
  if (!current) return null;
  const currentCenter = {
    x: current.position.x + current.width / 2,
    y: current.position.y + current.height / 2,
  };
  const horizontal = direction === 'left' || direction === 'right';
  const sign = direction === 'left' || direction === 'up' ? -1 : 1;
  let nearest: { entry: FocusedArtifactLayoutEntry; forward: number; lateral: number } | null = null;

  for (const entry of entries) {
    if (entry.identity.artifactId === artifactId) continue;
    const center = {
      x: entry.position.x + entry.width / 2,
      y: entry.position.y + entry.height / 2,
    };
    const forward = (horizontal ? center.x - currentCenter.x : center.y - currentCenter.y) * sign;
    const lateral = Math.abs(horizontal ? center.y - currentCenter.y : center.x - currentCenter.x);
    // Keep a cardinal browse action honest: if a candidate is principally
    // above/below a right/left movement (or vice versa), leave that edge empty.
    if (forward <= 0 || lateral > forward * 2) continue;
    if (!nearest
      || lateral * 2 + forward < nearest.lateral * 2 + nearest.forward
      || (lateral * 2 + forward === nearest.lateral * 2 + nearest.forward && entry.index < nearest.entry.index)) {
      nearest = { entry, forward, lateral };
    }
  }

  return nearest?.entry ?? null;
};

export interface ArtifactSelectionScope {
  visible: number;
  hidden: number;
  total: number;
}

export const getArtifactSelectionScope = (
  selectedIds: readonly string[],
  visibleIds: readonly string[],
): ArtifactSelectionScope => {
  const visible = new Set(visibleIds);
  const visibleSelected = selectedIds.filter((id) => visible.has(id)).length;
  return {
    visible: visibleSelected,
    hidden: selectedIds.length - visibleSelected,
    total: selectedIds.length,
  };
};
