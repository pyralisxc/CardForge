import { describe, expect, it } from 'vitest';

import { deriveDeskArrivalPhase, isDeskSourceSnapshotReady, resolveDeskMissingFocus } from '@/features/desk/model/deskArrival';

describe('Desk environment arrival', () => {
  it('keeps acquisition distinct from spatial composition', () => {
    expect(deriveDeskArrivalPhase({ presented: false, acquisitionReady: false, compositionReady: false })).toBe('acquiring');
    expect(deriveDeskArrivalPhase({ presented: false, acquisitionReady: true, compositionReady: false })).toBe('composing');
    expect(deriveDeskArrivalPhase({ presented: false, acquisitionReady: true, compositionReady: true })).toBe('ready');
  });

  it('never regresses an already presented environment during refresh', () => {
    expect(deriveDeskArrivalPhase({ presented: true, acquisitionReady: false, compositionReady: false })).toBe('ready');
  });

  it('waits for every scoped source before resolving an absent deep-linked Set', () => {
    const sources = [{ phase: 'ready' }, { phase: 'loading' }];
    // A source may still be unstarted/loading before the aggregate loading flag updates.
    const sourceSnapshotReady = isDeskSourceSnapshotReady(false, sources);
    expect(sourceSnapshotReady).toBe(false);
    expect(resolveDeskMissingFocus({ requestedWorkId: 'set:absent', workAvailable: false,
      sourceSnapshotReady, sources, sourceFailed: false })).toBeNull();
    expect(isDeskSourceSnapshotReady(true, [{ phase: 'ready' }])).toBe(false);
  });

  it('releases the empty Desk after a completed missing-work read, without requiring a nonexistent focus destination', () => {
    const sources = [{ phase: 'ready' }, { phase: 'empty' }];
    const sourceSnapshotReady = isDeskSourceSnapshotReady(false, sources);
    expect(resolveDeskMissingFocus({ requestedWorkId: 'set:absent', workAvailable: false,
      sourceSnapshotReady, sources, sourceFailed: false })).toBe('missing');
    expect(deriveDeskArrivalPhase({ presented: false, acquisitionReady: sourceSnapshotReady, compositionReady: true })).toBe('ready');
    expect(resolveDeskMissingFocus({ requestedWorkId: 'set:arrived', workAvailable: true,
      sourceSnapshotReady, sources, sourceFailed: false })).toBeNull();
    expect(resolveDeskMissingFocus({ requestedWorkId: null, workAvailable: false,
      sourceSnapshotReady, sources, sourceFailed: false })).toBeNull();
  });

  it.each(['unavailable', 'incomplete', 'permission-required', 'expired'])('does not report a %s source as missing or keep the Desk behind arrival', (phase) => {
    const sources = [{ phase }];
    const sourceSnapshotReady = isDeskSourceSnapshotReady(false, sources);
    expect(sourceSnapshotReady).toBe(true);
    expect(resolveDeskMissingFocus({ requestedWorkId: 'set:unresolved', workAvailable: false,
      sourceSnapshotReady, sources, sourceFailed: false })).toBe('unavailable');
    expect(deriveDeskArrivalPhase({ presented: false, acquisitionReady: sourceSnapshotReady, compositionReady: true })).toBe('ready');
  });

  it('retains failures even when the source phase or descriptive label alone looks ready', () => {
    expect(resolveDeskMissingFocus({ requestedWorkId: 'set:unresolved', workAvailable: false,
      sourceSnapshotReady: true, sources: [{ phase: 'ready' }], sourceFailed: true })).toBe('unavailable');
  });
});
