import { describe, expect, it } from 'vitest';

import {
  formatPacificDateTimeLocal,
  parsePacificDateTimeLocal,
} from '@/domain/marketing/schedule';

describe('marketing schedule Pacific time conversion', () => {
  it('converts the requested October 22 at 6 AM Pacific to 13:00 UTC', () => {
    expect(parsePacificDateTimeLocal('2026-10-22T06:00')).toBe('2026-10-22T13:00:00.000Z');
  });

  it('uses Pacific standard time after daylight saving ends', () => {
    expect(parsePacificDateTimeLocal('2026-11-02T06:00')).toBe('2026-11-02T14:00:00.000Z');
  });

  it('formats stored UTC timestamps back into Pacific wall time', () => {
    expect(formatPacificDateTimeLocal('2026-10-22T13:00:00.000Z')).toBe('2026-10-22T06:00');
    expect(formatPacificDateTimeLocal('2026-11-02T14:00:00.000Z')).toBe('2026-11-02T06:00');
  });

  it('rejects invalid and nonexistent daylight-saving wall times', () => {
    expect(() => parsePacificDateTimeLocal('2026-02-30T06:00')).toThrow(RangeError);
    expect(() => parsePacificDateTimeLocal('2026-03-08T02:30')).toThrow(/clock moves forward/u);
  });
});
