import { describe, expect, it, vi } from 'vitest';

import {
  clearOwnerBillingHistory,
  getOwnerBillingHistorySettings,
  OwnerBillingSettingsStoreError,
  updateOwnerBillingHistoryLimit,
} from '@/features/owner/lib/ownerBillingSettingsStore';
import {
  listStripeCheckoutHistory,
  listStripeSubscriptions,
} from '@/features/owner/lib/ownerBillingOperations';

const makeSessions = (start: number, count: number) => Array.from(
  { length: count },
  (_, index) => ({ id: `cs_${start + index + 1}` }),
);

describe('owner billing history', () => {
  it('paginates Stripe sessions up to the configured cap', async () => {
    const list = vi.fn()
      .mockResolvedValueOnce({ data: makeSessions(0, 100), has_more: true })
      .mockResolvedValueOnce({ data: makeSessions(100, 50), has_more: true });

    const sessions = await listStripeCheckoutHistory({
      stripe: { checkout: { sessions: { list } } },
      createdGte: 1_784_000_000,
      limit: 150,
    });

    expect(list).toHaveBeenNthCalledWith(1, {
      created: { gte: 1_784_000_000 },
      limit: 100,
    });
    expect(list).toHaveBeenNthCalledWith(2, {
      created: { gte: 1_784_000_000 },
      limit: 50,
      starting_after: 'cs_100',
    });
    expect(sessions).toHaveLength(150);
  });

  it('stops pagination when Stripe has no more sessions', async () => {
    const list = vi.fn().mockResolvedValue({ data: makeSessions(0, 2), has_more: false });

    const sessions = await listStripeCheckoutHistory({
      stripe: { checkout: { sessions: { list } } },
      createdGte: 1_784_000_000,
      limit: 500,
    });

    expect(list).toHaveBeenCalledTimes(1);
    expect(sessions).toHaveLength(2);
  });

  it('loads every Stripe subscription with customer details for account repair', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({ id: `sub_${index + 1}` }));
    const list = vi.fn()
      .mockResolvedValueOnce({ data: firstPage, has_more: true })
      .mockResolvedValueOnce({ data: [{ id: 'sub_101' }], has_more: false });

    const subscriptions = await listStripeSubscriptions({
      stripe: { subscriptions: { list } },
    });

    expect(list).toHaveBeenNthCalledWith(1, {
      status: 'all',
      limit: 100,
      expand: ['data.customer'],
    });
    expect(list).toHaveBeenNthCalledWith(2, {
      status: 'all',
      limit: 100,
      expand: ['data.customer'],
      starting_after: 'sub_100',
    });
    expect(subscriptions).toHaveLength(101);
  });

  it('maps stored preferences into an effective server-side window', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        billing_checkout_history_limit: 125,
        billing_checkout_history_cleared_before: '2026-07-14T12:00:00.000Z',
      },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const client = { from: vi.fn().mockReturnValue({ select }) };

    await expect(getOwnerBillingHistorySettings({
      client,
      now: new Date('2026-07-15T12:00:00.000Z'),
    })).resolves.toEqual({
      limit: 125,
      retentionDays: 30,
      clearedBefore: '2026-07-14T12:00:00.000Z',
      effectiveStart: '2026-07-14T12:00:00.000Z',
    });
  });

  it('rejects out-of-range owner limits instead of silently changing them', async () => {
    await expect(updateOwnerBillingHistoryLimit({
      client: { from: vi.fn() },
      value: 501,
    })).rejects.toMatchObject({ status: 400 } satisfies Partial<OwnerBillingSettingsStoreError>);
  });

  it('persists only the selected limit or display cutoff', async () => {
    const limitEq = vi.fn().mockResolvedValue({ error: null });
    const limitUpdate = vi.fn().mockReturnValue({ eq: limitEq });
    const limitClient = { from: vi.fn().mockReturnValue({ update: limitUpdate }) };

    await updateOwnerBillingHistoryLimit({ client: limitClient, value: 250 });

    expect(limitUpdate).toHaveBeenCalledWith({ billing_checkout_history_limit: 250 });
    expect(limitEq).toHaveBeenCalledWith('id', 'cardforge');

    const clearEq = vi.fn().mockResolvedValue({ error: null });
    const clearUpdate = vi.fn().mockReturnValue({ eq: clearEq });
    const clearClient = { from: vi.fn().mockReturnValue({ update: clearUpdate }) };
    const clearedAt = new Date('2026-07-15T12:30:00.000Z');

    await clearOwnerBillingHistory({ client: clearClient, clearedAt });

    expect(clearUpdate).toHaveBeenCalledWith({
      billing_checkout_history_cleared_before: clearedAt.toISOString(),
    });
    expect(clearEq).toHaveBeenCalledWith('id', 'cardforge');
  });
});
