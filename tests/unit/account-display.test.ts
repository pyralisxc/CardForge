import { describe, expect, it } from 'vitest';

import {
  buildForgeTitle,
  getAccountDisplayName,
  toPossessiveName,
} from '@/features/account/lib/accountDisplay';

describe('account display helpers', () => {
  it('uses the first readable profile name when available', () => {
    expect(getAccountDisplayName({ displayName: 'Cameron Locke', email: 'cameron@example.com' })).toBe('Cameron');
    expect(getAccountDisplayName({ displayName: 'R. J.', email: 'rj@example.com' })).toBe('R.');
  });

  it('falls back to the email handle before generic copy', () => {
    expect(getAccountDisplayName({ displayName: null, email: 'cardforge.qa.free@example.com' })).toBe('cardforge.qa.free');
    expect(getAccountDisplayName({ displayName: '', email: null })).toBeNull();
  });

  it('formats forge ownership without awkward plural possessives', () => {
    expect(toPossessiveName('Cameron')).toBe("Cameron's");
    expect(toPossessiveName('James')).toBe("James'");
  });

  it('builds account titles around the signed-in person', () => {
    expect(buildForgeTitle({
      displayName: 'Cameron Locke',
      email: 'cameron@example.com',
      tierLabel: 'Library Command',
      isAnonymous: false,
      isSetupIncomplete: false,
    })).toBe("Cameron's Forge: Library Command");

    expect(buildForgeTitle({
      displayName: null,
      email: null,
      tierLabel: 'Starter Library',
      isAnonymous: true,
      isSetupIncomplete: false,
    })).toBe('Your Forge is ready');
  });
});
