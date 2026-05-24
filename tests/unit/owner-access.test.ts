import { describe, expect, it } from 'vitest';

import { resolveOwnerAccess } from '@/lib/ownerAccess';

describe('owner access', () => {
  it('trusts Clerk private metadata for owner access', () => {
    expect(resolveOwnerAccess({
      authConfigured: true,
      isSignedIn: true,
      emailAddresses: ['owner@example.com'],
      privateMetadata: { cardforgeRole: 'owner' },
    })).toMatchObject({
      isOwner: true,
      source: 'clerk_private_metadata',
    });
  });

  it('does not trust public metadata for owner access', () => {
    expect(resolveOwnerAccess({
      authConfigured: true,
      isSignedIn: true,
      emailAddresses: ['owner@example.com'],
      publicMetadata: { cardforgeRole: 'owner' },
    }).isOwner).toBe(false);
  });

  it('allows a server-side owner email allowlist fallback', () => {
    expect(resolveOwnerAccess({
      authConfigured: true,
      isSignedIn: true,
      emailAddresses: ['CAMERON@example.com'],
      env: { CARDFORGE_OWNER_ACCOUNT_EMAILS: 'cameron@example.com' },
    })).toMatchObject({
      isOwner: true,
      source: 'environment',
    });
  });
});
