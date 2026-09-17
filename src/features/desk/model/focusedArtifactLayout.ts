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
  y: number;
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
  availableWidth,
}: {
  arrangement: FocusedArtifactArrangement;
  artifactCount: number;
  availableWidth: number;
}): FocusedArtifactPresentation => {
  const width = Math.max(320, availableWidth);
  const comfortableColumns = Math.max(1, Math.floor((width - 48) / (PRESENTATIONS.comfortable.width + PRESENTATIONS.comfortable.gapX)));
  const comfortableLimit = Math.max(8, comfortableColumns * 2);
  const compactLimit = Math.max(32, comfortableColumns * 8);
  let density: FocusedArtifactDensity = artifactCount <= comfortableLimit
    ? 'comfortable'
    : artifactCount <= compactLimit
      ? 'compact'
      : 'dense';

  if (arrangement === 'stack') {
    density = density === 'comfortable' ? 'compact' : 'dense';
  }
  return PRESENTATIONS[density];
};

/**
 * Fit is the complete bounded Set overview. It always shows the whole layout;
 * presentation detail may step down to a lightweight spatial marker when a
 * full card would be too small to read. Zoom remains camera-only and never
 * rewrites Artifact positions or arrangement.
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
  const width = Math.max(presentation.width + 48, Math.round(minimumWidth));
  const columns = Math.max(1, Math.floor((width - 48) / (presentation.width + presentation.gapX)));
  const stackColumns = Math.max(1, Math.min(24, Math.floor((width - 48 - presentation.width) / presentation.stackOffset) + 1));
  const entries: FocusedArtifactLayoutEntry[] = [];
  const groupLayouts: FocusedArtifactGroupLayout[] = [];
  let nextIndex = 0;
  let groupTop = 30;

  for (const group of groups) {
    groupLayouts.push({ label: group.label, y: groupTop, count: group.artifacts.length });
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
          x: 24 + (groupIndex % stackColumns) * presentation.stackOffset,
          y: contentTop + Math.floor(groupIndex / stackColumns) * (presentation.height + presentation.gapY),
        };
      } else {
        position = {
          x: 24 + (groupIndex % columns) * (presentation.width + presentation.gapX),
          y: contentTop + Math.floor(groupIndex / columns) * (presentation.height + presentation.gapY),
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
        ? Math.max(1, Math.ceil(group.artifacts.length / stackColumns))
        : Math.max(1, Math.ceil(group.artifacts.length / columns));
      groupTop = contentTop + rows * (presentation.height + presentation.gapY) + 12;
    }
  }

  const contentWidth = entries.reduce((maximum, entry) => Math.max(maximum, entry.position.x + entry.width + 24), width);
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
