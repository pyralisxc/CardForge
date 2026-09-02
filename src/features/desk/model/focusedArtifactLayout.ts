import type { ArtifactIdentity, ArtifactPosition } from '@/domain/artifacts';

export const FOCUSED_ARTIFACT_WIDTH = 136;
export const FOCUSED_ARTIFACT_HEIGHT = 198;
export const FOCUSED_ARTIFACT_GAP_X = 20;
export const FOCUSED_ARTIFACT_GAP_Y = 28;
export const FOCUSED_ARTIFACT_OVERSCAN = 180;

export type FocusedArtifactArrangement = 'manual' | 'grid' | 'stack';

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
}

export interface ArtifactViewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

const finiteCoordinate = (value: number | undefined, fallback: number): number => (
  Number.isFinite(value) ? Math.max(0, Number(value)) : fallback
);

export const buildFocusedArtifactLayout = ({
  arrangement,
  groups,
  minimumWidth,
}: {
  arrangement: FocusedArtifactArrangement;
  groups: readonly FocusedArtifactGroup[];
  minimumWidth: number;
}): FocusedArtifactLayout => {
  const width = Math.max(FOCUSED_ARTIFACT_WIDTH + 48, Math.round(minimumWidth));
  const columns = Math.max(1, Math.floor((width - 48) / (FOCUSED_ARTIFACT_WIDTH + FOCUSED_ARTIFACT_GAP_X)));
  const entries: FocusedArtifactLayoutEntry[] = [];
  const groupLayouts: FocusedArtifactGroupLayout[] = [];
  let nextIndex = 0;
  let groupTop = 30;

  for (const group of groups) {
    groupLayouts.push({ label: group.label, y: groupTop, count: group.artifacts.length });
    const contentTop = groupTop + 30;
    group.artifacts.forEach((artifact, groupIndex) => {
      const fallbackX = 24 + (nextIndex % columns) * (FOCUSED_ARTIFACT_WIDTH + FOCUSED_ARTIFACT_GAP_X);
      const fallbackY = 30 + Math.floor(nextIndex / columns) * (FOCUSED_ARTIFACT_HEIGHT + FOCUSED_ARTIFACT_GAP_Y);
      let position: ArtifactPosition;
      if (arrangement === 'manual') {
        position = {
          x: finiteCoordinate(artifact.position?.x, fallbackX),
          y: finiteCoordinate(artifact.position?.y, fallbackY),
        };
      } else if (arrangement === 'stack') {
        position = {
          x: 24 + Math.min(groupIndex, 18) * 38,
          y: contentTop + Math.floor(groupIndex / 19) * (FOCUSED_ARTIFACT_HEIGHT + FOCUSED_ARTIFACT_GAP_Y),
        };
      } else {
        position = {
          x: 24 + (groupIndex % columns) * (FOCUSED_ARTIFACT_WIDTH + FOCUSED_ARTIFACT_GAP_X),
          y: contentTop + Math.floor(groupIndex / columns) * (FOCUSED_ARTIFACT_HEIGHT + FOCUSED_ARTIFACT_GAP_Y),
        };
      }
      entries.push({
        ...artifact,
        index: nextIndex,
        position,
        width: FOCUSED_ARTIFACT_WIDTH,
        height: FOCUSED_ARTIFACT_HEIGHT,
      });
      nextIndex += 1;
    });

    if (arrangement !== 'manual') {
      const rows = arrangement === 'stack'
        ? Math.max(1, Math.ceil(group.artifacts.length / 19))
        : Math.max(1, Math.ceil(group.artifacts.length / columns));
      groupTop = contentTop + rows * (FOCUSED_ARTIFACT_HEIGHT + FOCUSED_ARTIFACT_GAP_Y) + 12;
    }
  }

  const contentWidth = entries.reduce((maximum, entry) => Math.max(maximum, entry.position.x + entry.width + 24), width);
  const contentHeight = entries.reduce((maximum, entry) => Math.max(maximum, entry.position.y + entry.height + 30), Math.max(360, groupTop));
  return { entries, groups: groupLayouts, width: contentWidth, height: contentHeight };
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
