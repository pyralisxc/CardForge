import { describe, expect, it } from 'vitest';

import {
  AUTO_ADVANCE_MS,
  getNextShowcaseStage,
  getShowcaseAdvanceDelay,
  INTERACTION_PAUSE_MS,
} from '@/features/public-site/model/showcaseTiming';

describe('interactive showcase timing', () => {
  it('advances on the approved twelve-second rhythm', () => {
    expect(AUTO_ADVANCE_MS).toBe(12_000);
    expect(getShowcaseAdvanceDelay({ now: 5_000, pauseUntil: 0, reducedMotion: false })).toBe(12_000);
  });

  it('stays still for one minute after interaction', () => {
    expect(INTERACTION_PAUSE_MS).toBe(60_000);
    expect(getShowcaseAdvanceDelay({ now: 20_000, pauseUntil: 80_000, reducedMotion: false })).toBe(60_000);
  });

  it('disables automatic movement for reduced-motion visitors', () => {
    expect(getShowcaseAdvanceDelay({ now: 0, pauseUntil: 0, reducedMotion: true })).toBeNull();
  });

  it('cycles through all three product stages', () => {
    expect(getNextShowcaseStage(0, 3)).toBe(1);
    expect(getNextShowcaseStage(1, 3)).toBe(2);
    expect(getNextShowcaseStage(2, 3)).toBe(0);
  });
});
