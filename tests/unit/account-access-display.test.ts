import { describe, expect, it } from 'vitest';

import { getAccountAccessLabel } from '@/features/account/lib/accountDisplay';

describe('account access display', () => {
  it('keeps owner and contributor labels ahead of paid-plan labels', () => {
    expect(getAccountAccessLabel({ isOwner: true, isContributor: true, accessExpiresAt: null, paidPlan: 'designer', canExportClean: true })).toBe('Owner access');
    expect(getAccountAccessLabel({ isOwner: false, isContributor: true, accessExpiresAt: null, paidPlan: null, canExportClean: true })).toBe('Contributor access');
  });

  it('describes timed, designer, creator, and free access', () => {
    expect(getAccountAccessLabel({ isOwner: false, isContributor: false, accessExpiresAt: '2026-09-15T00:00:00.000Z', paidPlan: 'creator', canExportClean: true }, 'en-US')).toContain('Creator Pass through');
    expect(getAccountAccessLabel({ isOwner: false, isContributor: false, accessExpiresAt: null, paidPlan: 'designer', canExportClean: true })).toBe('Designer Pass');
    expect(getAccountAccessLabel({ isOwner: false, isContributor: false, accessExpiresAt: null, paidPlan: 'creator', canExportClean: true })).toBe('Creator Pass');
    expect(getAccountAccessLabel({ isOwner: false, isContributor: false, accessExpiresAt: null, paidPlan: null, canExportClean: false })).toBe('Free');
  });
});
