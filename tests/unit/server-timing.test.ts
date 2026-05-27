import { describe, expect, it, vi } from 'vitest';

import { createServerTimingTracker, formatServerTimingHeader } from '@/lib/serverTiming';

describe('server timing helpers', () => {
  it('formats safe Server-Timing header values', () => {
    expect(formatServerTimingHeader([
      { name: 'owner access', durationMs: 12.345 },
      { name: 'db.metrics', durationMs: 2 },
    ])).toBe('owner_access;dur=12.3, db.metrics;dur=2.0');
  });

  it('tracks async segments and keeps successful return values', async () => {
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(27);

    const timing = createServerTimingTracker();
    const result = await timing.track('ownerAccess', async () => 'ok');

    expect(result).toBe('ok');
    expect(timing.header()).toBe('ownerAccess;dur=17.0');
  });
});
