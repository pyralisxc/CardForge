import type Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  subscriptions: [] as Array<{
    id: string; status: string; customer: string;
    metadata: { clerkUserId: string; billingPurpose: string; billingOffering: string };
    items: { data: Array<{ price: { id: string; unit_amount: number; currency: string } }> };
  }>,
  metadata: {} as Record<string, unknown>,
  locked: false,
  failList: false,
  updates: vi.fn(),
}));
const providers = vi.hoisted(() => ({
  stripe: {
    subscriptions: {
      retrieve: vi.fn(async (id: string) => state.subscriptions.find((s) => s.id === id)),
      list: vi.fn(async (params: { customer?: string; starting_after?: string }) => {
        if (state.failList) throw new Error('Stripe unavailable');
        const all = state.subscriptions.filter((s) => !params.customer || s.customer === params.customer);
        const start = params.starting_after ? all.findIndex((s) => s.id === params.starting_after) + 1 : 0;
        return { data: all.slice(start, start + 100), has_more: all.length > start + 100 };
      }),
    },
  },
}));
vi.mock('stripe', () => ({ default: class { subscriptions = providers.stripe.subscriptions; } }));
vi.mock('@clerk/nextjs/server', () => ({ clerkClient: async () => ({ users: {
  getUser: async (id: string) => ({ id, privateMetadata: state.metadata }),
  updateUserMetadata: async (_id: string, patch: { privateMetadata: Record<string, unknown> }) => {
    state.updates(patch); state.metadata = patch.privateMetadata;
  },
} }) }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: () => ({
  rpc: async (name: string) => {
    if (name.includes('acquire')) {
      if (state.locked) return { data: false, error: null };
      state.locked = true;
    } else state.locked = false;
    return { data: true, error: null };
  },
  from: () => ({ select: () => ({
    in: async () => ({ data: state.subscriptions.map((s) => ({ stripe_subscription_id: s.id })), error: null }),
    eq: () => ({ order: () => ({ range: async () => ({
      data: state.subscriptions.map((s) => ({ stripe_customer_id: s.customer })), error: null,
    }) }) }),
  }) }),
}) }));

import { syncSubscriptionAccess } from '@/features/billing/server/syncSubscriptionAccess';
import { reconcileBillingState } from '@/features/billing/server/reconcileBillingState';

const subscription = (id: string, status: string, plan = 'creator', customer = 'cus_one') => ({
  id, status, customer, metadata: { clerkUserId: 'user_one', billingPurpose: 'product_access', billingOffering: `${plan}_pass` },
  items: { data: [{ price: { id: `price_${plan}`, unit_amount: 1000, currency: 'usd' } }] },
});
const stripe = providers.stripe as unknown as Stripe;
beforeEach(() => {
  vi.clearAllMocks(); state.locked = false; state.failList = false; state.metadata = {};
  process.env.STRIPE_SECRET_KEY = 'sk_test_fixture';
  process.env.STRIPE_CREATOR_PASS_PRICE_ID = 'price_creator';
  process.env.STRIPE_DESIGNER_PASS_PRICE_ID = 'price_designer';
});
describe('one current Stripe entitlement projection', () => {
  it.each([false, true])('owner reconciliation never revokes an active plan due to an old canceled one (reverse=%s)', async (reverse) => {
    state.subscriptions = [subscription('sub_active', 'active'), subscription('sub_old', 'canceled')];
    if (reverse) state.subscriptions.reverse();
    const response = await reconcileBillingState();
    expect(response.status).toBe(200);
    expect(state.metadata).toMatchObject({ cardforgeCommercialPlan: 'creator', cardforgeStripeSubscriptionId: 'sub_active' });
    expect(state.updates).toHaveBeenCalledTimes(1);
  });
  it('keeps Designer across different customers and event ordering, excluding another account', async () => {
    state.subscriptions = [subscription('sub_creator', 'active'), subscription('sub_designer', 'trialing', 'designer', 'cus_two')];
    const foreign = subscription('sub_a_foreign', 'active', 'designer');
    foreign.metadata.clerkUserId = 'user_other';
    state.subscriptions.push(foreign);
    await syncSubscriptionAccess('sub_designer', stripe);
    await syncSubscriptionAccess('sub_creator', stripe);
    expect(state.metadata.cardforgeCommercialPlan).toBe('designer');
    expect(state.metadata.cardforgeStripeSubscriptionId).toBe('sub_designer');
    expect(state.updates).toHaveBeenCalledTimes(1);
  });
  it('reads subsequent Stripe pages before revoking', async () => {
    state.subscriptions = [...Array.from({ length: 100 }, (_, i) => subscription(`sub_old_${i}`, 'canceled')), subscription('sub_active', 'active')];
    await syncSubscriptionAccess('sub_old_0', stripe);
    expect(state.metadata.cardforgeStripeSubscriptionId).toBe('sub_active');
    expect(providers.stripe.subscriptions.list).toHaveBeenCalledWith(expect.objectContaining({ starting_after: 'sub_old_99' }));
  });
  it('preserves Contributor authority and manual grants when unrelated subscriptions end', async () => {
    state.subscriptions = [subscription('sub_old', 'canceled')];
    state.metadata = { cardforgeAccess: 'paid', cardforgeCommercialPlan: 'designer', cardforgeRole: 'owner' };
    await expect(syncSubscriptionAccess('sub_old', stripe)).resolves.toBe('unchanged');
    expect(state.updates).not.toHaveBeenCalled();
    state.metadata = { cardforgeAccess: 'paid', cardforgeStripeSubscriptionId: 'sub_old', cardforgeAuthorityRoles: ['contributor'] };
    await syncSubscriptionAccess('sub_old', stripe);
    expect(state.metadata).toMatchObject({ cardforgeAccess: 'contributor', cardforgeAuthorityRoles: ['contributor'] });
  });
  it('leaves metadata untouched on provider failure and releases the account lock', async () => {
    state.subscriptions = [subscription('sub_old', 'canceled')]; state.failList = true;
    await expect(syncSubscriptionAccess('sub_old', stripe)).rejects.toThrow('Stripe unavailable');
    expect(state.updates).not.toHaveBeenCalled(); expect(state.locked).toBe(false);
  });
  it('preserves an explicit extra grant after Stripe cancellation', async () => {
    state.subscriptions = [subscription('sub_old', 'canceled')];
    state.metadata = { cardforgeAccess: 'paid', cardforgeStripeSubscriptionId: 'sub_old', cardforgeOwnerCommercialPlan: 'designer', cardforgePaidPlan: 'creator' };
    await syncSubscriptionAccess('sub_old', stripe);
    expect(state.metadata).toMatchObject({ cardforgeAccess: 'paid', cardforgeCommercialPlan: 'designer', cardforgeOwnerCommercialPlan: 'designer', cardforgePaidPlan: null });
  });
  it('requires confirmation for ambiguous older owner+Stripe records without changing access', async () => {
    state.subscriptions = [subscription('sub_old', 'canceled')];
    state.metadata = { cardforgeAccess: 'paid', cardforgeStripeSubscriptionId: 'sub_old', cardforgeCommercialPlan: 'designer', cardforgeOwnerUpdatedAt: '2026-09-08T00:00:00Z' };
    await expect(syncSubscriptionAccess('sub_old', stripe)).rejects.toThrow('ambiguous provenance');
    expect(state.updates).not.toHaveBeenCalled();
    expect(state.metadata.cardforgeCommercialPlan).toBe('designer');
  });
  it('refuses concurrent repair while another projection owns the same lock', async () => {
    state.subscriptions = [subscription('sub_active', 'active')]; state.locked = true;
    await expect(syncSubscriptionAccess('sub_active', stripe)).rejects.toThrow('still processing');
    expect(state.updates).not.toHaveBeenCalled();
  });
  it('preserves an unbound legacy Designer grant when the first active Creator subscription arrives', async () => {
    state.subscriptions = [subscription('sub_creator', 'active')];
    const legacy = { cardforgeAccess: 'paid', cardforgeCommercialPlan: 'designer' };
    state.metadata = { ...legacy };
    await expect(syncSubscriptionAccess('sub_creator', stripe)).rejects.toThrow('ambiguous provenance');
    expect(state.updates).not.toHaveBeenCalled();
    expect(state.metadata).toEqual(legacy);
    expect(state.locked).toBe(false);
  });
});
