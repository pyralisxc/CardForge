import { rebaseSpatialWorldMove } from '@/components/ui/spatial-world';
import type { ArtifactIdentity, ArtifactPosition } from '@/domain/artifacts';

export const FOCUSED_ARTIFACT_OVERSCAN = 180;
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
  /** Presentation scale for physical millimeters at this LOD density. */
  unitsPerMm: number;
  gapX: number;
  gapY: number;
  stackOffset: number;
}

const PRESENTATIONS: Record<FocusedArtifactDensity, FocusedArtifactPresentation> = {
  comfortable: { density: 'comfortable', width: 176, height: 256, unitsPerMm: 176 / 63, gapX: 24, gapY: 32, stackOffset: 34 },
  compact: { density: 'compact', width: 144, height: 210, unitsPerMm: 144 / 63, gapX: 20, gapY: 28, stackOffset: 26 },
  dense: { density: 'dense', width: 112, height: 164, unitsPerMm: 112 / 63, gapX: 16, gapY: 22, stackOffset: 20 },
};

const ARTIFACT_TILE_INLINE_CHROME = 20;
const ARTIFACT_TILE_BLOCK_CHROME = 64;

const getArtifactPresentationExtent = (
  artifact: FocusedArtifactSeed,
  presentation: FocusedArtifactPresentation,
) => {
  const widthMm = Number(artifact.physicalSizeMm?.widthMm);
  const heightMm = Number(artifact.physicalSizeMm?.heightMm);
  if (widthMm > 0 && heightMm > 0) {
    const contentWidth = widthMm * presentation.unitsPerMm;
    const contentHeight = heightMm * presentation.unitsPerMm;
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
  Number.isFinite(value) ? Math.max(0, Number(value)) : fallback
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

/**
 * Whole Set is the complete bounded overview and the camera floor. Semantic
 * fits may move inward while remaining camera-only; neither path rewrites
 * Artifact positions or arrangement.
 */
export const getFocusedArtifactFitZoom = ({
  layout,
  viewportWidth,
  viewportHeight,
}: {
  layout: Pick<FocusedArtifactLayout, 'width' | 'height' | 'artifactWidth'>;
  viewportWidth: number;
  viewportHeight: number;
}): number => {
  const width = Math.max(1, viewportWidth);
  const height = Math.max(1, viewportHeight);
  const geometricFit = Math.min(1, width / Math.max(1, layout.width), height / Math.max(1, layout.height));
  return Math.max(Number.EPSILON, geometricFit);
};

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
  const wholeZoom = getFocusedArtifactFitZoom({ layout, viewportWidth, viewportHeight });
  if (entries.length === 0) return { x: 0, y: 0, zoom: wholeZoom };
  const left = Math.min(...entries.map((entry) => entry.position.x));
  const top = Math.min(...entries.map((entry) => entry.position.y));
  const right = Math.max(...entries.map((entry) => entry.position.x + entry.width));
  const bottom = Math.max(...entries.map((entry) => entry.position.y + entry.height));
  const safePadding = Math.max(0, Math.min(padding, Math.min(viewportWidth, viewportHeight) * 0.3));
  const requested = Math.min(
    Math.max(1, viewportWidth - safePadding * 2) / Math.max(1, right - left),
    Math.max(1, viewportHeight - safePadding * 2) / Math.max(1, bottom - top),
  );
  const zoom = Math.max(wholeZoom, Math.min(Math.max(2, wholeZoom * 3), requested));
  const visibleWidth = viewportWidth / zoom;
  const visibleHeight = viewportHeight / zoom;
  return {
    x: Math.max(0, Math.min(Math.max(0, layout.width - visibleWidth), (left + right) / 2 - visibleWidth / 2)),
    y: Math.max(0, Math.min(Math.max(0, layout.height - visibleHeight), (top + bottom) / 2 - visibleHeight / 2)),
    zoom,
  };
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

  const widthFloor = arrangement === 'manual' ? Math.max(maximumWidth + 48, Math.round(minimumWidth)) : maximumWidth + 48;
  const contentWidth = entries.reduce((maximum, entry) => Math.max(maximum, entry.position.x + entry.width + 24), widthFloor);
  const contentHeight = entries.reduce((maximum, entry) => Math.max(maximum, entry.position.y + entry.height + 30), Math.max(minimumHeight, 360, groupTop));
  return {
    entries,
    groups: groupLayouts,
    width: contentWidth,
    height: contentHeight,
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

export const moveFocusedArtifactSelectionWithRebase = ({
  entries,
  selectedIds,
  delta,
  snapToGrid,
}: {
  entries: readonly FocusedArtifactLayoutEntry[];
  selectedIds: readonly string[];
  delta: ArtifactPosition;
  snapToGrid: boolean;
}) => {
  const selected = new Set(selectedIds);
  const snap = (value: number) => snapToGrid ? Math.round(value / 24) * 24 : Math.round(value);
  const items = entries.map((entry) => ({
    id: entry.identity.artifactId,
    x: entry.position.x,
    y: entry.position.y,
  }));
  const proposed = Object.fromEntries(entries.flatMap((entry) => selected.has(entry.identity.artifactId)
    ? [[entry.identity.artifactId, {
        x: snap(entry.position.x + delta.x),
        y: snap(entry.position.y + delta.y),
      }] as const]
    : []));
  return rebaseSpatialWorldMove({ items, proposed });
};

export const moveFocusedArtifactSelection = (
  input: Parameters<typeof moveFocusedArtifactSelectionWithRebase>[0],
): Record<string, ArtifactPosition> => {
  const selected = new Set(input.selectedIds);
  const result = moveFocusedArtifactSelectionWithRebase(input);
  return Object.fromEntries(Object.entries(result.positions).filter(([id]) => selected.has(id)));
};

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
