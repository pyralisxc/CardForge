import type { ArtifactBrowseDirection } from './focusedArtifactLayout';

export type FocusedArtifactPointerType = 'touch' | 'pen' | 'mouse' | string;

export interface FocusedArtifactSwipeInput {
  deltaX: number;
  deltaY: number;
  durationMs: number;
}

export interface FocusedArtifactTap {
  artifactId: string;
  pointerType: FocusedArtifactPointerType;
  x: number;
  y: number;
  at: number;
}

export const isFocusedArtifactDirectPointer = (pointerType: FocusedArtifactPointerType) => (
  pointerType === 'touch' || pointerType === 'pen'
);

export const resolveFocusedArtifactSwipe = ({
  deltaX,
  deltaY,
  durationMs,
}: FocusedArtifactSwipeInput): ArtifactBrowseDirection | null => {
  const horizontal = Math.abs(deltaX);
  const vertical = Math.abs(deltaY);
  const major = Math.max(horizontal, vertical);
  const minor = Math.min(horizontal, vertical);
  const velocity = major / Math.max(1, durationMs);

  // Long deliberate travel and shorter flicks are both valid, but strongly
  // diagonal movement stays a pan/inspection gesture rather than navigation.
  const enoughTravel = major >= 44 || (major >= 24 && velocity >= 0.38);
  if (!enoughTravel || minor > major * 0.82) return null;

  return horizontal >= vertical
    ? deltaX > 0 ? 'right' : 'left'
    : deltaY > 0 ? 'down' : 'up';
};

export const isFocusedArtifactDoubleTap = (
  previous: FocusedArtifactTap | null,
  next: FocusedArtifactTap,
) => Boolean(
  previous
  && previous.artifactId === next.artifactId
  && previous.pointerType === next.pointerType
  && next.at >= previous.at
  && next.at - previous.at <= 360
  && Math.hypot(next.x - previous.x, next.y - previous.y) <= 28
);
