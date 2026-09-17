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
}

export interface FocusedArtifactGroup {
  label: string;
  artifacts: FocusedArtifactSeed[];
}

export interface FocusedArtifactLayoutEntry extends FocusedArtifactSeed {
  index: number;
  position: ArtifactPosition;
  width: number;
  height: number;
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
  width: number;
  height: number;
  gapX: number;
  gapY: number;
  stackOffset: number;
}

const PRESENTATIONS: Record<FocusedArtifactDensity, FocusedArtifactPresentation> = {
  comfortable: { density: 'comfortable', width: 176, height: 256, gapX: 24, gapY: 32, stackOffset: 34 },
  compact: { density: 'compact', width: 144, height: 210, gapX: 20, gapY: 28, stackOffset: 26 },
  dense: { density: 'dense', width: 112, height: 164, gapX: 16, gapY: 22, stackOffset: 20 },
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
  const largestGroup = Math.max(1, ...groups.map((group) => group.artifacts.length));
  const maximum = arrangement === 'stack' ? Math.min(24, largestGroup) : largestGroup;
  let best = { columns: 1, score: Number.POSITIVE_INFINITY };
  for (let columns = 1; columns <= maximum; columns += 1) {
    const stepX = arrangement === 'stack' ? presentation.stackOffset : presentation.width + presentation.gapX;
    const width = 48 + presentation.width + (Math.min(columns, largestGroup) - 1) * stepX;
    const height = groups.reduce((total, group) => (
      total + 42 + Math.max(1, Math.ceil(group.artifacts.length / columns)) * (presentation.height + presentation.gapY)
    ), 0);
    const emptySlots = groups.reduce((total, group) => total + Math.ceil(group.artifacts.length / columns) * columns - group.artifacts.length, 0);
    const ratioScore = Math.abs(Math.log(Math.max(Number.EPSILON, width / Math.max(1, height)) / (4 / 3)));
    const score = ratioScore + emptySlots / Math.max(1, groups.reduce((total, group) => total + group.artifacts.length, 0)) * 0.08;
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
  const columns = arrangement === 'manual'
    ? Math.max(1, Math.floor((Math.max(presentation.width + 48, Math.round(minimumWidth)) - 48) / (presentation.width + presentation.gapX)))
    : getBalancedColumnCount({ arrangement, groups, presentation });
  const entries: FocusedArtifactLayoutEntry[] = [];
  const groupLayouts: FocusedArtifactGroupLayout[] = [];
  let nextIndex = 0;
  let groupTop = 30;

  for (const group of groups) {
    const groupColumns = Math.max(1, Math.min(columns, group.artifacts.length));
    const stepX = arrangement === 'stack' ? presentation.stackOffset : presentation.width + presentation.gapX;
    const groupWidth = presentation.width + (groupColumns - 1) * stepX;
    groupLayouts.push({ label: group.label, x: 24, y: groupTop, width: groupWidth, count: group.artifacts.length });
    const contentTop = groupTop + 30;
    group.artifacts.forEach((artifact, groupIndex) => {
      const fallbackX = 24 + (nextIndex % columns) * (presentation.width + presentation.gapX);
      const fallbackY = 30 + Math.floor(nextIndex / columns) * (presentation.height + presentation.gapY);
      let position: ArtifactPosition;
      if (arrangement === 'manual') {
        position = {
          x: finiteCoordinate(artifact.position?.x, fallbackX),
          y: finiteCoordinate(artifact.position?.y, fallbackY),
        };
      } else if (arrangement === 'stack') {
        position = {
          x: 24 + (groupIndex % groupColumns) * presentation.stackOffset,
          y: contentTop + Math.floor(groupIndex / groupColumns) * (presentation.height + presentation.gapY),
        };
      } else {
        position = {
          x: 24 + (groupIndex % groupColumns) * (presentation.width + presentation.gapX),
          y: contentTop + Math.floor(groupIndex / groupColumns) * (presentation.height + presentation.gapY),
        };
      }
      entries.push({
        ...artifact,
        index: nextIndex,
        position,
        width: presentation.width,
        height: presentation.height,
      });
      nextIndex += 1;
    });

    if (arrangement !== 'manual') {
      const rows = arrangement === 'stack'
        ? Math.max(1, Math.ceil(group.artifacts.length / groupColumns))
        : Math.max(1, Math.ceil(group.artifacts.length / groupColumns));
      groupTop = contentTop + rows * (presentation.height + presentation.gapY) + 12;
    }
  }

  const widthFloor = arrangement === 'manual' ? Math.max(presentation.width + 48, Math.round(minimumWidth)) : presentation.width + 48;
  const contentWidth = entries.reduce((maximum, entry) => Math.max(maximum, entry.position.x + entry.width + 24), widthFloor);
  const contentHeight = entries.reduce((maximum, entry) => Math.max(maximum, entry.position.y + entry.height + 30), Math.max(minimumHeight, 360, groupTop));
  return {
    entries,
    groups: groupLayouts,
    width: contentWidth,
    height: contentHeight,
    density: presentation.density,
    artifactWidth: presentation.width,
    artifactHeight: presentation.height,
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

export const moveFocusedArtifactSelection = ({
  entries,
  selectedIds,
  delta,
  snapToGrid,
}: {
  entries: readonly FocusedArtifactLayoutEntry[];
  selectedIds: readonly string[];
  delta: ArtifactPosition;
  snapToGrid: boolean;
}): Record<string, ArtifactPosition> => {
  const selected = new Set(selectedIds);
  const snap = (value: number) => snapToGrid ? Math.round(value / 24) * 24 : Math.round(value);
  return Object.fromEntries(entries.flatMap((entry) => selected.has(entry.identity.artifactId)
    ? [[entry.identity.artifactId, {
        x: Math.max(0, snap(entry.position.x + delta.x)),
        y: Math.max(0, snap(entry.position.y + delta.y)),
      }] as const]
    : []));
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
