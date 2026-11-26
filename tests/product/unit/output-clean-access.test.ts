import { afterEach, describe, expect, it, vi } from 'vitest';

const account = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('@/features/account/client/entitlement', () => ({ loadAccountEntitlement: account.load }));
import { validateCleanOutputAccess } from '@/features/card-generator/lib/outputCleanAccess';

afterEach(() => { account.load.mockReset(); });

describe('repeat clean output access', () => {
  const valid = { authConfigured: true, isSignedIn: true, accountUserId: 'user-a', capabilities: { canExportClean: true } };
  it('accepts a fresh matching account with clean export access', async () => {
    account.load.mockResolvedValue({ ok: true, entitlement: valid });
    await expect(validateCleanOutputAccess('account:user-a')).resolves.toBeUndefined();
  });
  it.each([
    { ok: false, message: 'offline' },
    { ok: true, entitlement: { ...valid, accountUserId: 'user-b' } },
    { ok: true, entitlement: { ...valid, capabilities: { canExportClean: false } } },
    { ok: true, entitlement: { ...valid, isSignedIn: false } },
    { ok: true, entitlement: { ...valid, authConfigured: false } },
    { ok: true, entitlement: {} },
  ])('fails closed when account, capability, or response is unsuitable', async (response) => {
    account.load.mockResolvedValue(response);
    await expect(validateCleanOutputAccess('account:user-a')).rejects.toThrow(/could not be verified/i);
  });
});
