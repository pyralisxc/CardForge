import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('billing webhook entitlement safety', () => {
  it('locks the Clerk user resolved from current Stripe subscription state', () => {
    const route = readFileSync(
      join(process.cwd(), 'src/app/api/billing/webhook/route.ts'),
      'utf8',
    );
    const processor = readFileSync(
      join(process.cwd(), 'src/features/billing/server/processStripeWebhook.ts'),
      'utf8',
    );
    const syncStart = processor.indexOf('const syncSubscriptionAccess');
    const handlerStart = processor.indexOf('const handleStripeEvent');
    const syncBody = processor.slice(syncStart, handlerStart);

    expect(route).toContain('export const maxDuration = 30;');
    expect(route).toContain('export const POST = processStripeWebhook;');
    expect(syncBody).toContain('acquireBillingEntitlementLock({ clerkUserId: userId })');
    expect(syncBody).toContain('releaseBillingEntitlementLock({');
    expect(syncBody.indexOf('stripe.subscriptions.retrieve(subscriptionId)'))
      .toBeLessThan(syncBody.indexOf('acquireBillingEntitlementLock'));
  });
});
