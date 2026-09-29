import { describe, expect, it } from 'vitest';

import { deriveDeskArrivalPhase } from '@/features/desk/model/deskArrival';

describe('Desk environment arrival', () => {
  it('keeps acquisition distinct from spatial composition', () => {
    expect(deriveDeskArrivalPhase({ presented: false, acquisitionReady: false, compositionReady: false })).toBe('acquiring');
    expect(deriveDeskArrivalPhase({ presented: false, acquisitionReady: true, compositionReady: false })).toBe('composing');
    expect(deriveDeskArrivalPhase({ presented: false, acquisitionReady: true, compositionReady: true })).toBe('ready');
  });

  it('never regresses an already presented environment during refresh', () => {
    expect(deriveDeskArrivalPhase({ presented: true, acquisitionReady: false, compositionReady: false })).toBe('ready');
  });
});
