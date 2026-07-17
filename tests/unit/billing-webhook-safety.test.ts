import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('billing webhook entitlement safety', () => {
  it('locks the Clerk user resolved from current Stripe subscription state', () => {
    const route = readFileSync(
      join(process.cwd(), 'src/app/api/billing/webhook/route.ts'),
      'utf8',
    );
    const syncStart = route.indexOf('const syncSubscriptionAccess');
    const handlerStart = route.indexOf('const handleStripeEvent');
    const syncBody = route.slice(syncStart, handlerStart);

    expect(route).toContain('export const maxDuration = 30;');
    expect(syncBody).toContain('acquireBillingEntitlementLock({ clerkUserId: userId })');
    expect(syncBody).toContain('releaseBillingEntitlementLock({');
    expect(syncBody.indexOf('stripe.subscriptions.retrieve(subscriptionId)'))
      .toBeLessThan(syncBody.indexOf('acquireBillingEntitlementLock'));
  });
});
