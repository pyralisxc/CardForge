import { describe, expect, it } from 'vitest';

import {
  getAccountSectionHref,
  resolveAccountSection,
} from '@/features/account/lib/accountSections';

describe('account section navigation', () => {
  it('uses the compact account home as the default and preserves direct section links', () => {
    expect(resolveAccountSection({ requestedSection: undefined })).toBe('home');
    expect(resolveAccountSection({ requestedSection: 'library' })).toBe('library');
    expect(resolveAccountSection({ requestedSection: 'storage' })).toBe('storage');
    expect(resolveAccountSection({ requestedSection: 'billing' })).toBe('billing');
    expect(resolveAccountSection({ requestedSection: 'developer' })).toBe('developer');
    expect(resolveAccountSection({ requestedSection: 'unknown' })).toBe('home');
  });

  it('opens provider and checkout callbacks in the section that owns the result', () => {
    expect(resolveAccountSection({ requestedSection: undefined, hasStorageResult: true })).toBe('storage');
    expect(resolveAccountSection({ requestedSection: undefined, hasBillingIntent: true })).toBe('billing');
    expect(resolveAccountSection({ requestedSection: 'library', hasStorageResult: true })).toBe('library');
  });

  it('creates durable browser-history-friendly account links', () => {
    expect(getAccountSectionHref('home')).toBe('/account');
    expect(getAccountSectionHref('library')).toBe('/account?section=library');
    expect(getAccountSectionHref('storage')).toBe('/account?section=storage');
    expect(getAccountSectionHref('billing')).toBe('/account?section=billing');
    expect(getAccountSectionHref('developer')).toBe('/account?section=developer');
  });
});
