import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

  it('keeps signed-in controls mounted and only refreshes entitlement on identity transitions', () => {
    const controls = readFileSync(
      resolve(process.cwd(), 'src/features/account/components/AccountControls.tsx'),
      'utf8',
    );
    expect(controls).toContain("state === 'checking' && !isSignedIn");
    expect(controls).toContain('const previousSignedInRef = useRef<boolean | null>(null);');
    expect(controls).toContain('previousSignedIn !== null && previousSignedIn !== nextSignedIn');
  });
});
