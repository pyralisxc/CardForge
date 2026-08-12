# CardForge Operations

Last updated: August 11, 2026

This is the current runbook for `https://cardforges.com`. Provider dashboards own live state; this document owns the safe operating sequence and the evidence required after a change. Do not preserve deployment IDs or completed rollout diaries here.

## Production topology

- Vercel deploys `main`; `NEXT_PUBLIC_APP_URL` must be `https://cardforges.com`.
- `www.cardforges.com` permanently redirects to the apex domain.
- Clerk owns authentication and trusted private account metadata.
- Stripe owns Creator Pass, voluntary support checkout, subscriptions, webhooks, and the customer portal.
- Supabase owns shared product state and approved public media. Browser-local creator projects remain in IndexedDB/project files.
- Resend owns transactional email delivery.
- GA4 owns consented, privacy-minimized acquisition/adoption events. Search Console independently owns Google discovery reporting.
- Buffer may own social scheduling/delivery only after its separate owner-controlled rollout gate is enabled.

Secrets stay in Vercel or the owning provider. The Owner Console reports readiness and operational state; it must never render raw secret values.

## Required environment groups

Core: `NEXT_PUBLIC_APP_URL`, Clerk keys, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`.

Billing: Stripe publishable/secret/webhook keys, Creator Pass Price, the four support Prices, support currency, and support portal URL.

Email: `RESEND_API_KEY`, `CARDFORGE_EMAIL_FROM`, and `CARDFORGE_EMAIL_REPLY_TO`.

Access: `CARDFORGE_OWNER_ACCOUNT_EMAILS`, `CARDFORGE_DEV_ACCOUNT_EMAILS`, and `CARDFORGE_PAID_ACCOUNT_EMAILS`.

Analytics: the public measurement ID/enable flag plus the server-only GA property ID, service-account email/private key, and Search Console site URL.

Social publishing: server-only Buffer API key, organization ID, exact channel allowlist, and publishing flag.

Use `.env.example` as the complete variable catalog.

## Release sequence

1. Run the smallest focused checks while implementing.
2. Before the PR, run `npm run lint`, `npm run typecheck`, `npm run architecture:check`, `npm run migrations:check`, `npm run test`, `npm run build`, and `git diff --check`.
3. Require the GitHub `verify` and `public-smoke` checks on the exact PR head.
4. Apply an additive production migration only after Cameron explicitly approves that exact provider mutation. Run the postflight below before merging code that depends on the new schema.
5. Merge through the PR; do not force-push or bypass `main` protection.
6. Confirm the Vercel production deployment is READY for the merged commit, then run `npm run health:production`.
7. Use a real signed-in production browser for owner, developer, billing, or other provider-backed flows. Localhost and raw HTTP are not final proof for those paths.

Rollback application behavior with the relevant feature flag or a forward code fix. Never delete migrations, ledgers, campaign history, deliveries, or financial records to simulate rollback.

### Solo-maintainer branch rule

While `@pyralisxc` is the only trusted code owner, branch protection may require zero approvals because a PR author cannot approve their own change. Resolved review threads plus `verify` and `public-smoke` remain mandatory. Raise required approvals to one when a second trusted reviewer is added.

## Supabase migration and security procedure

Migration files are immutable after creation. `npm run migrations:check` rejects modifying, deleting, or renaming an existing file; every schema change must be a new forward migration.

Production migration history currently contains provider-generated timestamps that do not consistently match older repository filenames. Do not edit an old migration or reapply a migration merely to make names agree. For each new change:

1. Record the production project, current migration tail, affected tables/functions, RLS/grants, object counts, and advisor findings.
2. Review failure safety, idempotency, and rollback. Multi-table state transitions must be one database function/transaction or have explicit compensation.
3. With explicit approval, apply exactly the reviewed new SQL once.
4. Confirm the function/table exists, expected row/object counts are unchanged, `anon` and `authenticated` cannot access privileged tables/functions, and only `service_role` has required access.
5. Run Supabase security and performance advisors and resolve relevant warning/error findings.
6. Record the applied production version in the PR or release evidence. If the provider assigned a different version, align the unapplied repository filename before merge; do not rewrite recorded production history.

For the repository-consolidation release, apply `20260812063536_consolidate_developer_asset_registry.sql` before deploying callers. Postflight must prove all three server-only RPCs exist: developer status transition, Pipeline registry upsert, and Pipeline registry archive. Exercise an invalid ID and confirm the transaction leaves both submission and registry unchanged.

## Owner Console checks

Use `/owner` for readiness, analytics, billing/reconciliation, email tests, support/contact history, site copy/media, founder profile, business identity, legal publications, developer program, campaign review, and account lookup. Feature modules own their data; Owner composes those feature-owned surfaces.

## Organic analytics

Analytics is opt-in and organic-only. Enhanced Measurement, advertising storage, Google Signals, and ad personalization remain disabled. CardForge explicitly sends sanitized page context and the allowlisted `open_studio`, `sign_up`, `card_created`, and `export_completed` events; `sign_up` and `export_completed` are GA4 key events.

After analytics, privacy, domain, or credential changes:

1. Decline consent in a signed-out browser and confirm no Google tag request or `_ga` cookie.
2. Allow consent and confirm DebugView receives only sanitized path/title/referrer plus approved UTM fields; raw non-UTM query values must not appear.
3. Confirm the Owner Analytics screen distinguishes unavailable reports from real zero values.
4. Open one normalized organic link and confirm its source, `organic_social` medium, campaign, and post identity after GA processing.
5. Confirm Search Console reporting still works independently.

Rollback collection with `NEXT_PUBLIC_CARDFORGE_ANALYTICS_ENABLED=false`; this preserves Google-owned history.

## Developer Cockpit and Buffer

`CARDFORGE_EXTENDED_CONTRIBUTIONS_ENABLED` and `CARDFORGE_BUFFER_PUBLISHING_ENABLED` are independent and default false. Owner approval remains mandatory. Supabase owns CardForge media/campaign history; Buffer owns only provider scheduling and delivery.

Before extended contributors are enabled, verify protected source storage, approved-only public derivatives, canonical media/attachment/association integrity, private preview authorization, owner-only approval/provider mutations, legal publications, and scoped developer grants. A stale campaign version or invalid relationship must leave the campaign, attachments, exposure, and version unchanged.

Before Buffer is enabled:

1. Store the owner API key server-side and configure the exact organization/channel allowlist.
2. While publishing is disabled, load channels through the owner cockpit and confirm no unlisted channel appears.
3. Approve a harmless internal campaign and verify a reused media item produces one stable public derivative without exposing protected sources.
4. Enable publishing, create Buffer drafts first, and confirm one durable CardForge provider job per channel with matching provider post IDs.
5. Schedule one harmless post, confirm its due time in Buffer, refresh CardForge until delivery agrees, and retain campaign/job/post evidence without recording the API key.

Rollback new provider mutations by disabling `CARDFORGE_BUFFER_PUBLISHING_ENABLED`. Cancel already-created drafts/schedules in Buffer and refresh the durable CardForge job ledger; do not delete history.

## Authenticated production smoke

Run **Actions -> Authenticated smoke -> Run workflow** against a candidate when auth, billing, provider-domain, entitlement, or protected recovery behavior changes, then run it again on `main` after merge. A valid run uses the configured reusable free, paid, developer, and owner QA accounts and passes without skipped protected outcomes. Retain the artifact and run URL with release evidence.

The suite proves the signed-out `/sign-in` entry and Clerk bootstrap, role/entitlement authorization, and paid project export/import recovery. It does not replace a real production browser check for the specific owner/developer workflow changed by a release.

## Billing reconciliation

Stripe remains authoritative. Product access and voluntary support are separate billing purposes; support must never grant product entitlement.

From `/owner`, refresh billing and select **Reconcile billing**. Record `checked`, `repaired`, `unchanged`, `missingClerkUser`, `ledgerCreated`, and `missingLedger`; require `missingLedger` to be zero and investigate missing Clerk users before manual entitlement changes.

For webhook proof, use **Stripe Workbench -> Webhooks** and resend a recent event twice. Require HTTP 200, one Supabase event row, a durable duplicate decision, and no unintended entitlement change. Do not alter a real subscription to manufacture an event.

Safe support rollback removes/disables support checkout environment values while retaining the purpose-aware webhook and additive ledger. Never deploy an older webhook that cannot distinguish support from product access.

## Maintained commands

- `npm run health:production`: canonical public/API health.
- `npm run smoke`: lean public browser contract.
- `npm run smoke:protected`: protected auth/access/recovery contract.
- `npm run qa:bootstrap-authenticated-smoke`: align configured reusable QA identities.
- `npm run pipeline:sync-defaults`: intentionally seed repository starter assets through the atomic reviewed Pipeline command.
- `npm run brand:export`: regenerate ignored brand derivatives under `output/`.

## Manual release checks

- Canonical apex, `www` redirect, robots, sitemap, self-canonicals, Open Graph URLs, and protected-route noindex behavior.
- One real production owner/developer flow affected by the release.
- One customer-facing Stripe receipt and one reply-to round trip when billing/email identity changes.
- Downloaded PDF/TTS artifact inspection and a real TTS import when export behavior changes.
- Search Console sitemap/discovery after domain, metadata, or route changes.
