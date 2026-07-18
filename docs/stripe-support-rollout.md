# Stripe billing-purpose and creator-support rollout

This rollout keeps CardForge product access separate from voluntary support. Complete it in Stripe test mode first. Do not place secret values in chat, issues, commits, screenshots, or PR text.

## Pricing model

The pricing decision is already locked:

- one-time support: the supporter chooses any amount from $1.00 through $1,000.00; CardForge suggests $5.00;
- monthly support: fixed $1, $5, $10, or $20 monthly choices;
- no annual support tier.

CardForge creates the selected one-time amount as server-owned inline Checkout pricing after validating the range, so no one-time Stripe Price or Payment Link is required. The four recurring choices use four fixed Stripe Price IDs.

## 1. Confirm the Stripe account identity

In Stripe Dashboard, open **Settings → Business → Business details**. Confirm the legal business/operator information matches Cameron Locke’s actual Oregon sole-proprietor setup. Keep the customer-facing product/brand name as **CardForge Studio** where Stripe permits a public business or product name.

Do not enter the retired former LLC as the current CardForge operator. Do not claim “d/b/a CardForge Studio” unless the assumed-business-name basis has been verified separately.

Also review **Settings → Business → Public details** and the statement descriptor/receipt identity. Use truthful CardForge Studio customer-facing language while keeping Cameron Locke as the legal operator where Stripe requests the legal person.

## 2. Preserve the existing Creator Pass price

In **Product catalog**, open the existing Creator Pass product and copy its recurring monthly `price_...` identifier. This becomes:

`STRIPE_CREATOR_PASS_PRICE_ID`

Do not create a replacement Creator Pass subscription or change current customers merely to rename the environment variable.

For each existing Creator Pass subscription, open its metadata and add:

- `billingPurpose` = `product_access`
- `billingOffering` = `creator_pass`

Keep its existing `clerkUserId`. Remove the obsolete `product=cardforge-studio-export` metadata after the new fields are verified. This metadata migration is required before the new webhook is deployed; missing-purpose events intentionally cannot change entitlement.

## 3. Confirm one-time support behavior

Do not create a fixed one-time Product or Payment Link. CardForge collects the supporter’s amount in the support section of Cameron's page, accepts only $1.00–$1,000.00, and creates the one-time Stripe Checkout Session server-side with that exact amount. Stripe displays the exact amount again before payment.

## 4. Create the monthly support price

Create one product named **Support Cameron — monthly**.

- Description: `Voluntary monthly support for Cameron Locke’s independent work on CardForge Studio. Renews monthly until canceled. No product access.`
- Pricing model: standard fixed price
- Payment type: recurring
- Billing period: monthly
- Currency: USD
- Amount: create four recurring monthly Prices on this product: `$1.00`, `$5.00`, `$10.00`, and `$20.00`

Copy the four `price_...` identifiers as:

- `$1` → `STRIPE_SUPPORT_MONTHLY_1_PRICE_ID`
- `$5` → `STRIPE_SUPPORT_MONTHLY_5_PRICE_ID`
- `$10` → `STRIPE_SUPPORT_MONTHLY_10_PRICE_ID`
- `$20` → `STRIPE_SUPPORT_MONTHLY_20_PRICE_ID`

Do not reuse any support Price for Creator Pass.

## 5. Enable supporter self-service cancellation

Open **Settings → Billing → Customer portal**. In the test-mode portal configuration:

- allow customers to cancel subscriptions;
- allow payment-method updates;
- show invoice/payment history;
- use CardForge Studio customer-facing branding;
- do not enable plan switching between support and Creator Pass.

Activate the portal configuration, then create/copy the Stripe-hosted customer portal login link. It normally begins with `https://billing.stripe.com/p/login/`. Save it as `STRIPE_SUPPORT_PORTAL_URL`.

This login page lets a supporter authenticate with the email held by Stripe and manage the monthly subscription without requiring a CardForge account.

## 6. Update the webhook

In Stripe test mode, create a separate webhook destination for the stable PR Preview URL:

`https://card-forge-git-feat-billing-purpose-support-pyralis-projects.vercel.app/api/billing/webhook`

Copy that endpoint's test signing secret into Vercel **Preview** as `STRIPE_WEBHOOK_SECRET`. Do not replace the production signing secret with it.

For production cutover, open **Developers → Webhooks**, select the live CardForge endpoint, and confirm its destination remains:

`https://cardforges.com/api/billing/webhook`

Subscribe to:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Keep raw-body signature verification enabled through the existing `STRIPE_WEBHOOK_SECRET`. Do not paste the signing secret anywhere except the Vercel environment variable field.

## 7. Add Vercel environment variables

In Vercel, open **card-forge → Settings → Environment Variables**. Add the following first to **Preview** for test-mode verification:

- `STRIPE_CREATOR_PASS_PRICE_ID`
- `STRIPE_SUPPORT_MONTHLY_1_PRICE_ID`
- `STRIPE_SUPPORT_MONTHLY_5_PRICE_ID`
- `STRIPE_SUPPORT_MONTHLY_10_PRICE_ID`
- `STRIPE_SUPPORT_MONTHLY_20_PRICE_ID`
- `STRIPE_SUPPORT_CURRENCY` = `usd`
- `STRIPE_SUPPORT_PORTAL_URL`

The monthly Price amounts, currency, and interval must exactly match their configured tiers. CardForge refuses checkout if they disagree.

After Preview verification, add the corresponding live-mode values to **Production**. Delete the old `STRIPE_PRICE_ID` only after the production deployment using `STRIPE_CREATOR_PASS_PRICE_ID` is healthy.

## 8. Apply the additive Supabase migration

Apply `20260717074826_billing_purpose_support.sql` before deploying the new webhook. It adds explicit purpose/reporting columns and a new restricted RPC while leaving the currently deployed webhook RPC available during the rollout.

Verify that:

- the migration is recorded;
- `cardforge_begin_billing_event_v2` is executable only by `service_role`;
- entitlement-lock RPCs are executable only by `service_role`, and the lock table has RLS enabled with no public policies;
- billing tables remain unavailable to `anon` and `authenticated`;
- existing billing rows remain intact.

## 9. Test-mode acceptance

Use Stripe test mode and a Preview deployment:

1. Complete one Creator Pass checkout while signed in.
2. Confirm the account receives paid CardForge access.
3. Complete one one-time support checkout with a non-preset amount while signed out.
4. Confirm no CardForge access is created or changed.
5. Complete at least the $1 and $20 monthly support checkouts while signed out.
6. Confirm no CardForge access is created or changed.
7. Use the supporter portal login link to cancel the monthly support subscription.
8. Deliver a duplicate webhook event and confirm the ledger deduplicates it.
9. Inspect the owner console and confirm Creator Pass MRR, monthly support, one-time support, refunds, and unmatched records are separate.
10. Refund the one-time test payment and confirm the owner refund count updates without changing entitlement.

## 10. Production cutover and rollback

After test-mode acceptance:

1. apply the additive migration to production;
2. add live Stripe/Vercel values;
3. migrate existing Creator Pass subscription metadata;
4. deploy the exact approved commit;
5. perform one small live Creator Pass and support verification only if intentionally approved;
6. remove `STRIPE_PRICE_ID` after the healthy deployment is confirmed.

If the support lane fails, remove the support Price/amount/portal environment values and redeploy. The public support page returns to its inactive explanation while Creator Pass remains available through its separate configuration. Do not roll back or delete Stripe financial records or Supabase ledger rows.

After the first support subscription is created, the purpose-classifying webhook in this rollout is the minimum safe webhook version. Never roll application code back to the earlier webhook: that version does not understand `creator_support` and could mistake a signed-in supporter subscription for Creator Pass. A safe rollback disables the support environment values and checkout UI while retaining this webhook, the v2 ledger RPC, and the additive migration.

Official references:

- [Create a Checkout Session](https://docs.stripe.com/api/checkout/sessions/create)
- [Stripe Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment)
- [Stripe customer portal](https://docs.stripe.com/customer-management)
- [Stripe webhooks](https://docs.stripe.com/webhooks)
- [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api)
