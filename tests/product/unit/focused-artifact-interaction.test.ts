import { describe, expect, it } from 'vitest';

import {
  isFocusedArtifactDirectPointer,
  isFocusedArtifactDoubleTap,
  resolveFocusedArtifactSwipe,
} from '@/features/desk/model/focusedArtifactInteraction';

describe('focused Artifact interaction intent', () => {
  it('accepts deliberate travel and quick flicks while rejecting ambiguous diagonals', () => {
    expect(resolveFocusedArtifactSwipe({ deltaX: 70, deltaY: 8, durationMs: 500 })).toBe('right');
    expect(resolveFocusedArtifactSwipe({ deltaX: -26, deltaY: 3, durationMs: 45 })).toBe('left');
    expect(resolveFocusedArtifactSwipe({ deltaX: 20, deltaY: 3, durationMs: 300 })).toBeNull();
    expect(resolveFocusedArtifactSwipe({ deltaX: 70, deltaY: 66, durationMs: 120 })).toBeNull();
  });

  it('supports touch and pen direct manipulation without treating mouse movement as a swipe', () => {
    expect(isFocusedArtifactDirectPointer('touch')).toBe(true);
    expect(isFocusedArtifactDirectPointer('pen')).toBe(true);
    expect(isFocusedArtifactDirectPointer('mouse')).toBe(false);
  });

  it('recognizes a nearby second tap on the same Artifact and pointer type', () => {
    const first = { artifactId: 'card-1', pointerType: 'touch', x: 100, y: 120, at: 1_000 };
    expect(isFocusedArtifactDoubleTap(first, { ...first, x: 112, y: 124, at: 1_280 })).toBe(true);
    expect(isFocusedArtifactDoubleTap(first, { ...first, artifactId: 'card-2', at: 1_180 })).toBe(false);
    expect(isFocusedArtifactDoubleTap(first, { ...first, pointerType: 'pen', at: 1_180 })).toBe(false);
    expect(isFocusedArtifactDoubleTap(first, { ...first, at: 1_500 })).toBe(false);
  });
});
