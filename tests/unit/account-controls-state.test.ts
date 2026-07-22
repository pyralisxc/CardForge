import { describe, expect, it } from 'vitest';

import { resolveAccountControlsState } from '@/features/account/lib/accountControlsState';

describe('resolveAccountControlsState', () => {
  it('uses neutral copy while the real account response is loading', () => {
    expect(resolveAccountControlsState({ authConfigured: false, isLoadingAccount: true })).toBe('checking');
  });

  it('only reports unavailable sign-in after the account response settles', () => {
    expect(resolveAccountControlsState({ authConfigured: false, isLoadingAccount: false })).toBe('unavailable');
    expect(resolveAccountControlsState({ authConfigured: true, isLoadingAccount: false })).toBe('ready');
  });
});
