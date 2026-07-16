# CardForge Operations

Last updated: July 16, 2026

This is the current live-operations checklist for CardForge.

## Live Site

- Canonical domain: `https://cardforges.com`
- Vercel production branch: `main`
- Required canonical env var: `NEXT_PUBLIC_APP_URL=https://cardforges.com`
- Robots and sitemap must point to `https://cardforges.com`.
- Google Search Console uses a DNS TXT record on the root `cardforges.com` domain.

## Required Production Services

- Vercel: hosting, production env vars, domains, deployments.
- Clerk: authentication and trusted private metadata.
- Stripe: Creator Pass checkout, subscription events, webhook, customer portal.
- Supabase: owner settings, Founder Beta, roadmap, contact requests, asset/developer pipeline.
- Resend: transactional sending.

## Required Production Environment Variables

Core:

```text
NEXT_PUBLIC_APP_URL=https://cardforges.com
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Stripe:

```text
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_PRICE_ID=
STRIPE_WEBHOOK_SECRET=
```

Email:

```text
RESEND_API_KEY=
CARDFORGE_EMAIL_FROM=CardForge <onboarding@resend.dev>
CARDFORGE_EMAIL_REPLY_TO=
```

Owner/developer allowlists:

```text
CARDFORGE_OWNER_ACCOUNT_EMAILS=
CARDFORGE_DEV_ACCOUNT_EMAILS=
CARDFORGE_PAID_ACCOUNT_EMAILS=
```

## Launch State

- Custom domain is active.
- Stripe has processed the first live sale.
- Clerk production sign-in and the reusable authenticated account matrix are verified.
- Stripe webhook ordering and duplicate delivery are live-proven; the first subscriber's Clerk mapping remains pending until they sign in or register with the exact Stripe email.
- Founder Beta launch wave is capped at 25 seats.
- Resend test email works with the configured support inbox.
- Google Search Console verification may depend on DNS propagation.

## Business identity provider alignment

The repository identity is CardForge Studio, created and operated by Cameron Locke as an independent sole proprietor based in Oregon. The forward Supabase migration and application cutover are prepared but have not been applied to production in this branch.

Before claiming production alignment, obtain explicit approval and verify the current legal/business identity in Supabase, Stripe receipts and account records, Resend sender/reply-to settings, and every public legal page. Do not change provider configuration, apply migrations, merge, or deploy from a documentation-only review. Follow [the operator identity and transfer runbook](operator-identity-and-transfer-runbook.md) and record exact deployment and provider evidence here after rollout.

## Owner Console Checks

Use `/owner` for:

- launch readiness
- billing snapshot
- email test
- support/contact request history
- site copy
- business identity
- site mechanics
- Founder Beta access and copy
- legal documents
- developer program settings
- account lookup/access changes

Secrets stay in Vercel/provider dashboards. The owner console should show readiness, not raw secret values.

## Database Security

- Browser-direct writes are not supported.
- Privileged RPCs must revoke `EXECUTE` from `PUBLIC`, `anon`, and `authenticated`.
- The Founder Beta claim RPC is callable only by the server-side `service_role`.
- Run Supabase security and performance advisors after every migration.
- Verify role grants directly; RLS does not protect an exposed `SECURITY DEFINER` function.

## Delivery Gates

- Pull requests must pass CI and public smoke checks before merge.
- `npm run architecture:check` must report zero violations; no baseline or exception file exists.
- Authenticated provider smoke uses protected environment secrets and must never run for untrusted fork code.
- `main` should require a pull request, required checks, resolved review threads, and blocked force pushes.
- Vercel build success alone is not a release-health verdict.
- Production route health runs every six hours; GitHub owns failure notification and Vercel runtime error groups remain the primary server-error aggregation view.

### Solo-maintainer branch rule

While `@pyralisxc` is the only code owner, required approval count remains zero because a pull-request author cannot approve their own change. Require the `verify` and `public-smoke` checks now. Raise required approvals to one when a second trusted reviewer is added, or review this exception by August 15, 2026.

## Authenticated production smoke

Run **Actions → Authenticated smoke → Run workflow** against `main` after auth, billing, provider-domain, or entitlement changes. The workflow fails before browser installation unless all protected values exist:

- reusable free, paid, developer, and owner QA account emails;
- production Clerk publishable and secret keys; and
- production Supabase URL and service-role key.

A valid run must pass the signed-out Clerk modal check, the reusable account/entitlement matrix, developer and owner lifecycle coverage, and paid project export/import restoration. Retain the `authenticated-smoke-<run id>` artifact for 14 days and record the run URL in the risk register. A green run with skipped role tests is not acceptable.

## Clerk production verification

Use a signed-out Chrome window on `https://cardforges.com`:

1. Open DevTools Network and filter for `client` or `environment`.
2. Click **Sign in** in the public header and confirm the modal becomes interactive rather than remaining on **Connecting**.
3. Complete sign-in and confirm the header and Account page refresh to the signed-in user.
4. Sign out and confirm the public header returns to **Sign in**.
5. Confirm no Clerk `/v1/client` or `/v1/environment` request returned HTTP 400 or greater.

Production must expose a `pk_live_` publishable key and load Clerk through the verified `clerk.cardforges.com` domain. Never record the complete key in an issue, log, or screenshot.

## Billing reconciliation

Stripe remains authoritative. The durable subscription ledger and duplicate-delivery path are live-proven. Do not ask the existing subscriber to purchase again: they must sign in or register with the exact email stored in Stripe, then the owner can reconcile the mapping.

Use the configured owner QA account on `/owner`:

1. Open **Operations**, refresh billing, and select **Reconcile billing**.
2. Record `checked`, `repaired`, `unchanged`, `missingClerkUser`, `ledgerCreated`, and `missingLedger` from the response or owner notification.
3. Require `missingLedger` to be zero for every Stripe subscription. Investigate any `missingClerkUser` before changing entitlement manually.
4. Confirm the existing customer shows the same subscription ID and access state in Stripe, Clerk private metadata, Supabase, and the owner console.

When rechecking webhook behavior, open **Stripe Workbench → Webhooks**, choose the CardForge destination for `https://cardforges.com/api/billing/webhook`, and select a recent subscription or completed-checkout event. Resend it twice and require HTTP 200, one Supabase event row, the durable duplicate decision, and no unintended Clerk entitlement change. Do not change a live subscription merely to manufacture an event.

## Maintained Operations Scripts

- `npm run health:production`: checks five public/API routes on the canonical domain.
- `npm run qa:bootstrap-authenticated-smoke`: aligns only the four configured reusable QA identities before protected smoke runs.
- `npm run pipeline:sync-defaults`: intentionally seeds repo-owned starter material into the reviewed asset pipeline.

Public and authenticated browser verification belongs in the Playwright smoke suites; do not create parallel one-off browser audit scripts.

## Verification Commands

Use the smallest relevant check first:

```bash
npm run lint
npm run test
npm run typecheck
npm run architecture:check
npm run build
npm run smoke
npm run health:production
```

Before pushing launch-affecting changes:

```bash
git diff --check
```

## Launch-Critical Manual Checks

- Open `https://cardforges.com`.
- Confirm `https://cardforges.com/robots.txt` points to `https://cardforges.com/sitemap.xml`.
- Submit sitemap in Google Search Console after DNS verification.
- Complete one Stripe checkout or customer portal round trip after domain/env changes.
- Send one Owner Console test email after Resend/env changes.
- Confirm unpaid export prompts Creator Pass or Founder Beta, not developer application copy.
