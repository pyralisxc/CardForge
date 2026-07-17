import { describe, expect, it, vi } from 'vitest';

import {
  acquireBillingEntitlementLock,
  beginBillingEvent,
  finishBillingEvent,
  getBillingLedgerMetrics,
  releaseBillingEntitlementLock,
} from '@/features/billing/lib/billingEventStore';

describe('billing event store', () => {
  it('atomically accepts a new Stripe event', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 'accepted', error: null });
    await expect(beginBillingEvent({
      eventId: 'evt_123',
      eventCreated: 1_700_000_000,
      eventType: 'customer.subscription.updated',
      customerId: 'cus_123',
      subscriptionId: 'sub_123',
      clerkUserId: 'user_123',
      billingPurpose: 'product_access',
      billingOffering: 'creator_pass',
      stripePriceId: 'price_123',
      amountCents: 1200,
      currency: 'usd',
      classificationReason: null,
      client: { rpc },
    })).resolves.toBe('accepted');
    expect(rpc).toHaveBeenCalledWith('cardforge_begin_billing_event_v2', expect.objectContaining({
      p_stripe_event_id: 'evt_123',
      p_stripe_subscription_id: 'sub_123',
      p_billing_purpose: 'product_access',
      p_billing_offering: 'creator_pass',
      p_stripe_price_id: 'price_123',
      p_amount_cents: 1200,
      p_currency: 'usd',
    }));
  });

  it('records processing results and failures', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });
    const client = { from };
    await finishBillingEvent({
      eventId: 'evt_123',
      status: 'processed',
      resultingEntitlement: 'paid',
      client,
    });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      processing_status: 'processed',
      resulting_entitlement: 'paid',
    }));
    expect(eq).toHaveBeenCalledWith('stripe_event_id', 'evt_123');
  });

  it('acquires and releases a per-user entitlement lease', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: true, error: null });
    const client = { rpc };

    await expect(acquireBillingEntitlementLock({
      clerkUserId: 'user_123',
      leaseToken: '00000000-0000-4000-8000-000000000001',
      client,
    })).resolves.toBe('00000000-0000-4000-8000-000000000001');
    await expect(releaseBillingEntitlementLock({
      clerkUserId: 'user_123',
      leaseToken: '00000000-0000-4000-8000-000000000001',
      client,
    })).resolves.toBeUndefined();
    expect(rpc).toHaveBeenNthCalledWith(1, 'cardforge_acquire_billing_entitlement_lock', {
      p_clerk_user_id: 'user_123',
      p_lease_token: '00000000-0000-4000-8000-000000000001',
      p_lease_seconds: 60,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'cardforge_release_billing_entitlement_lock', {
      p_clerk_user_id: 'user_123',
      p_lease_token: '00000000-0000-4000-8000-000000000001',
    });
  });

  it('reports failed, pending, and unmatched ledger events separately', async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [
        { processing_status: 'failed', billing_purpose: 'product_access' },
        { processing_status: 'pending', billing_purpose: 'creator_support' },
        { processing_status: 'ignored', billing_purpose: 'unmatched' },
      ],
      error: null,
    });
    const gte = vi.fn().mockReturnValue({ limit });
    const select = vi.fn().mockReturnValue({ gte });
    const from = vi.fn().mockReturnValue({ select });

    await expect(getBillingLedgerMetrics({
      effectiveStart: '2026-06-17T00:00:00.000Z',
      client: { from },
    })).resolves.toEqual({ failedEvents: 1, pendingEvents: 1, unmatchedEvents: 1 });
    expect(from).toHaveBeenCalledWith('cardforge_billing_events');
    expect(gte).toHaveBeenCalledWith('stripe_created_at', '2026-06-17T00:00:00.000Z');
  });
});
