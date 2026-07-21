# CardForge Operations

Last updated: July 20, 2026

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
```

Stripe:

```text
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_CREATOR_PASS_PRICE_ID=
STRIPE_SUPPORT_MONTHLY_1_PRICE_ID=
STRIPE_SUPPORT_MONTHLY_5_PRICE_ID=
STRIPE_SUPPORT_MONTHLY_10_PRICE_ID=
STRIPE_SUPPORT_MONTHLY_20_PRICE_ID=
STRIPE_SUPPORT_CURRENCY=usd
STRIPE_SUPPORT_PORTAL_URL=
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
- The last recorded production deployment verification was `dpl_8uCiJA3qdvU1ua5tPGeYKQGnLUN4`, READY on `main` commit `b8f6355b7943c9b814caef36656bd47f0f1b6df3`.
- The maintained five-route production health check passed against the canonical domain on July 19 for that deployment. Vercel reported no grouped production runtime errors in the following 24 hours.
- Current production is commit `9e5da78312bb19f5b58d3550124af257b5be979e`, which serves a static public **Sign in** link to `/sign-in`; Clerk mounts only on that dedicated route and returns successful authentication to `/account`.
- The July 21 protected run [29854209641](https://github.com/pyralisxc/CardForge/actions/runs/29854209641) on production commit `9e5da78312bb19f5b58d3550124af257b5be979e` passed the reusable free/paid/developer/owner matrix, Founder Beta flow, and paid project recovery, but failed only the retired homepage-modal assertion. Its [artifact 8504695104](https://github.com/pyralisxc/CardForge/actions/runs/29854209641/artifacts/8504695104) is retained through August 4 and is diagnostic evidence, not current four-outcome release proof. Run the corrected protected smoke before release approval and replace this entry with that non-skipped evidence.
- Stripe webhook ordering and duplicate delivery are live-proven; the first subscriber's Clerk mapping remains pending until they sign in or register with the exact Stripe email.
- Founder Beta launch wave is capped at 25 seats.
- Resend test email works with the configured support inbox.
- Google Search Console completion remains open.

## Business identity provider alignment

The repository identity is CardForge Studio, created and operated by Cameron Locke as an independent sole proprietor based in Oregon. Gate 1's business-identity migration is applied in production, and `cardforges.com` is serving the exact merged Gate 1 commit. Stripe account/receipt identity and Resend sender/reply-to alignment still require direct provider verification before the overall provider-alignment risk is closed.

Before claiming production alignment, obtain explicit approval and verify the current legal/business identity in Supabase, Stripe receipts and account records, Resend sender/reply-to settings, and every public legal page. Do not change provider configuration, apply migrations, merge, or deploy from a documentation-only review. Follow [the operator identity and transfer runbook](operator-identity-and-transfer-runbook.md) and record exact deployment and provider evidence here after rollout.

## Legal publication and public cache operations

Legal documents are immutable versioned publications. Publishing through `/owner` requires the identity version currently shown in the console; a concurrent identity update produces a conflict instead of attaching legal text to stale operator data. Publication does not create or infer retroactive terms acceptance.

The Gate 2 migration must be applied before the new publication API is used in production. After approval and migration:

1. Confirm all nine legal slugs have a current publication and the expected business-identity version.
2. Publish the Creator Pool archived notice as a new version if the preserved historical version is still current.
3. Verify public legal routes render the newest version while older versions remain queryable by service-owned operations.
4. Confirm owner updates invalidate only the affected tag and the public route changes without a deploy.

Marketing and legal routes use tagged one-hour caches. Business-identity changes invalidate identity and identity-dependent legal reads; founder edits invalidate the founder tag plus the public shell; content edits invalidate only their landing/about/sharing group; legal publication invalidates only its slug. A revalidation failure is logged and bounded by the one-hour fallback rather than changing a successful database write into a false mutation failure.

The Cameron profile panel owns founder copy, the priorities list, portrait alt text, and Facebook/Instagram/Discord URLs. Blank social URLs intentionally render a **coming soon** control. Portrait replacement accepts JPEG, PNG, or WebP up to 8 MB, produces a WebP no larger than 1600×2000, and overwrites only `cardforge-public-media/founder/cameron-locke/portrait.webp`. If processing or Storage fails, the current portrait remains active. Founder support lives only at `/cameron#support`; do not create a second support page. Stripe checkout returns directly to `/cameron?payment=<status>#support`. The Public Site Copy panel owns one share message and generates downloadable homepage/Cameron QR PNGs locally; no QR files are stored in Supabase.

Search policy is deliberate: marketing routes appear in the XML sitemap; legal pages remain public, canonical, and indexable but are excluded from that marketing sitemap. Studio, account, profile, owner, and the archived Creator Pool route are noindex. Do not add fake `lastmod`, priority, or change-frequency values.

## Owner Console Checks

Use `/owner` for:

- launch readiness
- billing snapshot
- email test
- support/contact request history
- site copy
- Cameron profile, portrait, and social links
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
- Keep `cardforge_founder_profile` inaccessible to `anon` and `authenticated`; public access applies only to the intentional portrait object in the public-media bucket.

## Delivery Gates

- The active GitHub `Updates` ruleset applies to the default branch and `main`. It requires pull requests and resolved review threads, blocks branch deletion and non-fast-forward updates, and strictly requires the GitHub Actions checks `verify` and `public-smoke`.
- Pull requests must pass `verify` and `public-smoke` before merge.
- `public-smoke` is intentionally limited to public/API health, one generated output, the free clean-export boundary, and uncaught browser or HTTP 5xx failures along those paths. Marketing copy, route catalogs, menu labels, accessibility scans, editor interactions, bulk/performance scenarios, and device-layout checks are manual or focused verification when that feature changes; they are not permanent release gates.
- `npm run architecture:check` must report zero violations; no baseline or exception file exists.
- Authenticated provider smoke uses protected environment secrets and must never run for untrusted fork code.
- Vercel build success alone is not a release-health verdict.
- Production route health runs every six hours; GitHub owns failure notification and Vercel runtime error groups remain the primary server-error aggregation view.

### Solo-maintainer branch rule

While `@pyralisxc` is the only trusted code owner, the active ruleset retains zero required approvals because a pull-request author cannot approve their own change. Raise required approvals to one when a second trusted reviewer is added, or review this exception by August 15, 2026.

## Authenticated production smoke

Run **Actions → Authenticated smoke → Run workflow** against the candidate branch before merge, then `main` after auth, billing, provider-domain, or entitlement changes. The workflow fails before browser installation unless all protected values exist:

- reusable free, paid, developer, and owner QA account emails;
- production Clerk publishable and secret keys; and
- production Supabase URL and service-role key.

A valid run must pass the signed-out public-header → `/sign-in` → interactive Clerk-form/bootstrap check, the reusable free, Founder Beta, paid, developer, and owner entitlement and authorization matrix, and one paid project export/import recovery. The signed-out check records every Clerk `/v1/client` and `/v1/environment` response, fails on any HTTP 400 or greater response or Clerk-related browser console error, and never expects Clerk to mount on `/`. It intentionally does not gate marketing copy, panel labels, profile styling, roadmap voting, or the developer asset submission lifecycle; verify those manually or with focused tests when the feature changes. Retain the `authenticated-smoke-<run id>` artifact for 14 days and record the run URL in the risk register. A green run with skipped role tests is not acceptable. The July 21 run [29854209641](https://github.com/pyralisxc/CardForge/actions/runs/29854209641) is obsolete signed-out-test diagnostic evidence, not release proof; replace it with a non-skipped corrected run before release approval.

## Clerk production verification

Use a real signed-out browser on `https://cardforges.com`:

1. Open DevTools Network and filter for `client` or `environment`.
2. Confirm the homepage header exposes a visible **Sign in** link to `/sign-in` and does not remain on a **Connecting** state.
3. Click **Sign in**, confirm navigation to `/sign-in`, and wait for the dedicated Clerk form to become interactive.
4. Complete sign-in and confirm the Account page at `/account` refreshes to the signed-in user.
5. Sign out and confirm the public header returns to the static **Sign in** link.
6. Confirm no Clerk `/v1/client` or `/v1/environment` request returned HTTP 400 or greater.

Repeat the same check through the mobile navigation and once with a throttled network. Record the browser, date, visible static link and interactive form, and bootstrap-response result. Hosted smoke can prove the signed-out route/network assertion; it does not replace this real-browser desktop/mobile/throttled acceptance check.

Production must expose a `pk_live_` publishable key and load Clerk through the verified `clerk.cardforges.com` domain. Never record the complete key in an issue, log, or screenshot.

## Billing reconciliation

Stripe remains authoritative. The durable subscription ledger and duplicate-delivery path are live-proven. Do not ask the existing subscriber to purchase again: they must sign in or register with the exact email stored in Stripe, then the owner can reconcile the mapping.

Once any creator-support subscription exists, never deploy a webhook older than the explicit billing-purpose classifier. Disable support configuration to roll back the support lane while retaining the purpose-aware webhook and additive ledger migration; an older webhook can misclassify signed-in support as product access.

Use the configured owner QA account on `/owner`:

1. Open **Operations**, refresh billing, and select **Reconcile billing**.
2. Record `checked`, `repaired`, `unchanged`, `missingClerkUser`, `ledgerCreated`, and `missingLedger` from the response or owner notification.
3. Require `missingLedger` to be zero for every Stripe subscription. Investigate any `missingClerkUser` before changing entitlement manually.
4. Confirm the existing customer shows the same subscription ID and access state in Stripe, Clerk private metadata, Supabase, and the owner console.

When rechecking webhook behavior, open **Stripe Workbench → Webhooks**, choose the CardForge destination for `https://cardforges.com/api/billing/webhook`, and select a recent subscription or completed-checkout event. Resend it twice and require HTTP 200, one Supabase event row, the durable duplicate decision, and no unintended Clerk entitlement change. Do not change a live subscription merely to manufacture an event.

## Maintained Operations Scripts

- `npm run health:production`: checks five public/API routes on the canonical domain.
- `npm run smoke`: runs only the lean public browser contract.
- `npm run smoke:protected`: runs the four protected auth, access, entitlement, and paid-recovery outcomes when their required production QA environment is configured.
- `npm run qa:bootstrap-authenticated-smoke`: aligns only the four configured reusable QA identities before protected smoke runs.
- `npm run pipeline:sync-defaults`: intentionally seeds repo-owned starter material into the reviewed asset pipeline.

Public and authenticated browser verification belongs in the Playwright smoke suites; do not create parallel one-off browser audit scripts.

## Restricted local runner

Some managed workspaces set `HOME=/root` while preventing creation of `/root/.npm`, `/root/.supabase`, and `/root/.cache/ms-playwright`. In that environment, missing browser or CLI cache files are runner limitations rather than CardForge failures.

- Generate a Supabase migration with an isolated writable home and cache: `env HOME=/tmp/cardforge-home npm --cache /tmp/cardforge-npm-cache exec --yes supabase@latest -- migration new <name>`.
- A Supabase CLI shutdown-telemetry timeout may still return a nonzero exit after printing the created migration path; verify that exact file once, then continue instead of rerunning migration generation.
- Playwright’s dry run reveals whether its install target is under the unwritable home. Do not repeatedly attempt browser downloads there. Run unit/type/build checks locally and require the hosted `public-smoke` job to install the browser and pass before merge.
- Do not weaken or skip the hosted browser gate because the disposable local runner lacks its binary.

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
- Confirm `/studio`, `/account`, `/profile`, `/owner`, and `/creator-pool` emit noindex metadata.
- Confirm marketing and legal pages emit a self-referencing canonical and matching Open Graph URL.
- Validate the CardForge and Cameron JSON-LD in a structured-data inspection tool.
- Submit sitemap in Google Search Console after DNS verification.
- Complete one Stripe checkout or customer portal round trip after domain/env changes.
- Send one Owner Console test email after Resend/env changes.
- Confirm unpaid export prompts Creator Pass or Founder Beta, not developer application copy.
