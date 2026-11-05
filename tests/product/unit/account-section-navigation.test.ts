import { describe, expect, it } from 'vitest';

import {
  getAccountSectionHref,
  getAccountDeskKey,
  resolveAccountSection,
} from '@/features/account/lib/accountSections';

describe('account section navigation', () => {
  it('uses the Desk root and translates retired pseudo-sections to their owning surfaces', () => {
    expect(resolveAccountSection({ requestedSection: undefined })).toBe('desk');
    expect(resolveAccountSection({ requestedSection: 'library' })).toBe('library');
    expect(resolveAccountSection({ requestedSection: 'storage' })).toBe('library');
    expect(resolveAccountSection({ requestedSection: 'billing' })).toBe('profile');
    expect(resolveAccountSection({ requestedSection: 'profile' })).toBe('profile');
    expect(resolveAccountSection({ requestedSection: 'contributor' })).toBe('desk');
    expect(resolveAccountSection({ requestedSection: 'home' })).toBe('desk');
    expect(resolveAccountSection({ requestedSection: 'unknown' })).toBe('desk');
  });

  it('opens provider and checkout callbacks in the section that owns the result', () => {
    expect(resolveAccountSection({ requestedSection: undefined, hasStorageResult: true })).toBe('library');
    expect(resolveAccountSection({ requestedSection: undefined, hasBillingIntent: true })).toBe('profile');
    expect(resolveAccountSection({ requestedSection: 'library', hasStorageResult: true })).toBe('library');
  });

  it('creates durable browser-history-friendly account links', () => {
    expect(getAccountSectionHref('desk')).toBe('/account');
    expect(getAccountSectionHref('library')).toBe('/account?section=library');
    expect(getAccountSectionHref('profile')).toBe('/account?section=profile');
  });
});


it('keeps a prepared Output Desk mounted through internal focus and return-context changes', () => {
  const prepared = { documentId: 'exact-document', revision: '3', outputRef: 'exact-reference' };
  const initial = getAccountDeskKey(prepared);
  expect(getAccountDeskKey({ ...prepared, focusedWorkId: 'set:incoming', focusedArtifactId: 'card', returnContextKey: 'restored' })).toBe(initial);
  expect(getAccountDeskKey({ ...prepared, outputRef: 'new-reference' })).not.toBe(initial);
  expect(getAccountDeskKey({ ...prepared, documentId: 'other-document' })).not.toBe(initial);
  expect(getAccountDeskKey({ ...prepared, revision: '4' })).not.toBe(initial);
});
it('preserves ordinary Desk focus identity and fails closed with an explicit invalid Output reference', () => {
  expect(getAccountDeskKey({})).toBe('desk');
  expect(getAccountDeskKey({ focusedWorkId: 'set:local' })).toBe('desk:set:local:set:fresh');
  expect(getAccountDeskKey({ outputRef: '' })).not.toBe('desk');
});
