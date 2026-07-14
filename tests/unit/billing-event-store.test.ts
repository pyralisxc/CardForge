import { describe, expect, it, vi } from 'vitest';

import { beginBillingEvent, finishBillingEvent } from '@/features/billing/lib/billingEventStore';

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
      client: { rpc },
    })).resolves.toBe('accepted');
    expect(rpc).toHaveBeenCalledWith('cardforge_begin_billing_event', expect.objectContaining({
      p_stripe_event_id: 'evt_123',
      p_stripe_subscription_id: 'sub_123',
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
});
