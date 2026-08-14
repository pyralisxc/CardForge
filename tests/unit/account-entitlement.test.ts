import { describe, expect, it } from 'vitest';

import {
  isClerkAuthConfigured,
  resolveAccountAccessMode,
  resolveAccountEntitlement,
} from '@/features/account/lib/accountEntitlement';

describe('accountEntitlement', () => {
  it('detects Clerk only when both public and secret keys are configured', () => {
    expect(isClerkAuthConfigured({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_123',
      CLERK_SECRET_KEY: 'sk_test_123',
    })).toBe(true);

    expect(isClerkAuthConfigured({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_123',
    })).toBe(false);
  });

  it('falls back to environment access mode when real auth is not configured', () => {
    expect(resolveAccountEntitlement({
      authConfigured: false,
      isSignedIn: false,
      env: {
        NODE_ENV: 'development',
      },
    })).toMatchObject({
      accessMode: 'dev',
      authConfigured: false,
      isSignedIn: false,
      ownerAccess: { isOwner: false, source: 'none' },
      source: 'environment',
    });
  });

  it('keeps signed-out Clerk visitors in free preview mode', () => {
    expect(resolveAccountAccessMode({
      authConfigured: true,
      isSignedIn: false,
      emailAddresses: [],
      publicMetadata: {},
      privateMetadata: {},
      env: {
        NODE_ENV: 'development',
      },
    })).toBe('free');
  });

  it('maps trusted Clerk private metadata to paid and dev export entitlements', () => {
    expect(resolveAccountAccessMode({
      authConfigured: true,
      isSignedIn: true,
      emailAddresses: ['maker@example.com'],
      publicMetadata: {},
      privateMetadata: { cardforgeAccess: 'paid' },
      env: {},
    })).toBe('paid');

    expect(resolveAccountAccessMode({
      authConfigured: true,
      isSignedIn: true,
      emailAddresses: ['dev@example.com'],
      publicMetadata: {},
      privateMetadata: { cardforgeAccess: 'dev' },
      env: {},
    })).toBe('dev');
  });

  it('keeps beta paid metadata active until the private metadata expiration date', () => {
    expect(resolveAccountAccessMode({
      authConfigured: true,
      isSignedIn: true,
      emailAddresses: ['beta@example.com'],
      publicMetadata: {},
      privateMetadata: {
        cardforgeAccess: 'paid',
        cardforgeAccessExpiresAt: '2026-08-22T00:00:00.000Z',
      },
      env: {},
      now: '2026-05-22T00:00:00.000Z',
    })).toBe('paid');

    expect(resolveAccountEntitlement({
      authConfigured: true,
      isSignedIn: true,
      emailAddresses: ['beta@example.com'],
      publicMetadata: {},
      privateMetadata: {
        cardforgeAccess: 'paid',
        cardforgeAccessExpiresAt: '2026-08-22T00:00:00.000Z',
      },
      env: {},
      now: '2026-05-22T00:00:00.000Z',
    })).toMatchObject({
      accessMode: 'paid',
      accessExpiresAt: '2026-08-22T00:00:00.000Z',
      canExportClean: true,
    });
  });

  it('expires beta paid metadata after the private metadata expiration date', () => {
    expect(resolveAccountAccessMode({
      authConfigured: true,
      isSignedIn: true,
      emailAddresses: ['beta@example.com'],
      publicMetadata: {},
      privateMetadata: {
        cardforgeAccess: 'paid',
        cardforgeAccessExpiresAt: '2026-05-01T00:00:00.000Z',
      },
      env: {},
      now: '2026-05-22T00:00:00.000Z',
    })).toBe('free');
  });

  it('does not trust public Clerk metadata for paid or dev entitlement', () => {
    expect(resolveAccountAccessMode({
      authConfigured: true,
      isSignedIn: true,
      emailAddresses: ['maker@example.com'],
      publicMetadata: { cardforgeAccess: 'paid' },
      privateMetadata: {},
      env: {},
    })).toBe('free');

    expect(resolveAccountAccessMode({
      authConfigured: true,
      isSignedIn: true,
      emailAddresses: ['dev@example.com'],
      publicMetadata: { cardforgeAccess: 'dev' },
      privateMetadata: {},
      env: {},
    })).toBe('free');
  });

  it('maps server email allowlists to paid and dev export entitlements', () => {
    expect(resolveAccountAccessMode({
      authConfigured: true,
      isSignedIn: true,
      emailAddresses: ['maker@example.com'],
      publicMetadata: {},
      privateMetadata: {},
      env: {
        CARDFORGE_PAID_ACCOUNT_EMAILS: 'maker@example.com, other@example.com',
      },
    })).toBe('paid');

    expect(resolveAccountAccessMode({
      authConfigured: true,
      isSignedIn: true,
      emailAddresses: ['dev@example.com'],
      publicMetadata: {},
      privateMetadata: {},
      env: {
        CARDFORGE_DEV_ACCOUNT_EMAILS: 'dev@example.com',
        CARDFORGE_PAID_ACCOUNT_EMAILS: 'dev@example.com',
      },
    })).toBe('dev');

  });

  it('returns full entitlement copy and capabilities for a paid account', () => {
    const entitlement = resolveAccountEntitlement({
      authConfigured: true,
      isSignedIn: true,
      emailAddresses: ['maker@example.com'],
      publicMetadata: {},
      privateMetadata: {
        cardforgeAccess: 'paid',
        cardforgeStripeCustomerId: 'cus_123',
      },
      env: {},
    });

    expect(entitlement).toMatchObject({
      accessMode: 'paid',
      accountEmail: 'maker@example.com',
      authConfigured: true,
      canExportClean: true,
      hasStripeCustomer: true,
      isSignedIn: true,
      source: 'clerk',
    });
    expect(entitlement.capabilities.canExportClean).toBe(true);
    expect(entitlement.copy.panelMessage).toContain('Projects remain local');
  });

  it('applies the owner project-file policy without changing finished export access', () => {
    const entitlement = resolveAccountEntitlement({
      authConfigured: true,
      isSignedIn: false,
      projectFileAccess: 'free',
      env: {},
    });

    expect(entitlement.accessMode).toBe('free');
    expect(entitlement.capabilities.canUseProjectFiles).toBe(true);
    expect(entitlement.capabilities.canExportClean).toBe(false);
    expect(entitlement.copy.projectFileGateMessage).toBeNull();
  });

  it('does not expose billing management for non-Stripe paid grants', () => {
    expect(resolveAccountEntitlement({
      authConfigured: true,
      isSignedIn: true,
      emailAddresses: ['founder@example.com'],
      privateMetadata: { cardforgeAccess: 'paid' },
      env: {},
    }).hasStripeCustomer).toBe(false);

    expect(resolveAccountEntitlement({
      authConfigured: true,
      isSignedIn: true,
      emailAddresses: ['dev@example.com'],
      privateMetadata: {
        cardforgeAccess: 'dev',
        cardforgeStripeCustomerId: 'cus_123',
      },
      env: {},
    }).hasStripeCustomer).toBe(false);
  });

  it('elevates trusted owner access to developer-grade export and tool capabilities', () => {
    const entitlement = resolveAccountEntitlement({
      authConfigured: true,
      isSignedIn: true,
      emailAddresses: ['owner@example.com'],
      privateMetadata: {},
      ownerAccess: {
        isOwner: true,
        source: 'clerk_private_metadata',
      },
      env: {},
    });

    expect(entitlement).toMatchObject({
      accessMode: 'dev',
      canExportClean: true,
      ownerAccess: {
        isOwner: true,
        source: 'clerk_private_metadata',
      },
    });
  });
});
