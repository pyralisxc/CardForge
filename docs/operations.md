# CardForge Operations

Last updated: August 13, 2026

This is the current runbook for `https://cardforges.com`. Provider dashboards own live state; this document owns the safe operating sequence and the evidence required after a change. Do not preserve deployment IDs or completed rollout diaries here.

## Production topology

- Vercel deploys `main`; `NEXT_PUBLIC_APP_URL` must be `https://cardforges.com`.
- `www.cardforges.com` permanently redirects to the apex domain.
- Clerk owns authentication and trusted private account metadata.
- Stripe owns Creator Pass, voluntary support checkout, subscriptions, webhooks, and the customer portal.
- Supabase owns shared product state and approved public media. Browser-local creator projects remain in IndexedDB/project files.
- Resend owns transactional email delivery.
- GA4 owns consented acquisition/adoption reporting, PostHog owns anonymous allow-listed interaction events, and Search Console independently owns Google discovery reporting.
- Buffer may own social scheduling/delivery only after its separate owner-controlled rollout gate is enabled.

Secrets stay in Vercel or the owning provider. The Owner Console reports readiness and operational state; it must never render raw secret values.

## Required environment groups

Core: `NEXT_PUBLIC_APP_URL`, Clerk keys, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`.

Billing: Stripe publishable/secret/webhook keys, Creator Pass Price, the four support Prices, support currency, and support portal URL.

Email: `RESEND_API_KEY`, `CARDFORGE_EMAIL_FROM`, and `CARDFORGE_EMAIL_REPLY_TO`.

Access: `CARDFORGE_OWNER_ACCOUNT_EMAILS`, `CARDFORGE_DEV_ACCOUNT_EMAILS`, and `CARDFORGE_PAID_ACCOUNT_EMAILS`.

Analytics: the public enable flag, GA measurement ID, PostHog project token/ingestion host, plus the server-only GA property/service account, Search Console site URL, and PostHog project ID/app host/personal key. Limit the PostHog personal key to Query Read for the one CardForge project.

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

## Operator identity and transfer

CardForge Studio is currently operated by Cameron Locke as an Oregon sole proprietor. `business-identity` owns the application contract and the Supabase singleton owns the live record. Stripe, Resend, Clerk, Vercel, the domain registrar/DNS, GitHub, Search Console, structured data, public copy, and legal publications must agree with that record.

Changing the operator is a legal and operational migration, not a copy edit. Require written confirmation covering intellectual property, domains, customer and contractual obligations, privacy-control responsibility, billing and tax treatment, support obligations, effective date, and customer notice before changing the canonical identity. Inventory every provider-owned record, migrate deliberately, deploy the exact reviewed commit, and verify public, owner, billing, email, and legal surfaces together. Git history alone does not establish a transfer, and no provider change is implied by repository documentation.

## Owner Console checks

Use `/owner` through five job-based workspaces: Overview, Audience & Revenue, Site Controls, Library & Contributors, and Governance. Feature modules still own their data; Owner only composes those feature-owned surfaces. The asset library shows the complete pipeline through type/status filters, search, and 12-item pages instead of silently truncating the review list.

Site Controls > Experience can make portable project files free or Creator Pass-only without changing finished-output entitlement. It can also switch analytics consent among required choice, standard popup, and quiet banner. All three presentations must retain Accept, Accept once, and Decline. Refresh a public page or Studio session after saving to verify the new cached policy and its matching public access copy.

## Organic analytics

Analytics is opt-in and organic-only. Enhanced Measurement, advertising storage, Google Signals, and ad personalization remain disabled. PostHog autocapture, heatmaps, exception capture, person profiles, and session recording also remain disabled. CardForge explicitly sends sanitized paths and allow-listed navigation, format, card-back, generation, card-creation, and export lifecycle events; `sign_up` and `export_completed` remain the GA4 key events. PostHog receives those allow-listed CardForge properties plus the disclosed anonymous session identifier and basic browser/device context; it never records page content or session replay.

After analytics, privacy, domain, or credential changes:

1. Disable Session Replay in the PostHog project before deploying any event-only privacy publication.
2. Deploy and verify the bundle with `disable_session_recording: true`; an accepted public and Studio session must send no `$snapshot` or replay request.
3. Apply all pending migrations and confirm the latest published Privacy Policy names both Google and PostHog and states that session replay is not used.
4. Decline consent in a signed-out browser and confirm no Google tag, PostHog request, `_ga` cookie, or PostHog browser state.
5. Choose Accept once and confirm GA uses session cookies, PostHog uses session storage, measurement stops in a new tab session, and no persistent CardForge consent cookie remains.
6. Choose Accept and confirm GA DebugView receives only sanitized path/title/referrer plus approved UTM fields; raw non-UTM query values must not appear.
7. On a public informational page and in Studio, confirm PostHog receives only allow-listed CardForge events with sanitized `path` plus the disclosed anonymous/basic technical context.
8. Enter sign-in, account, owner, and developer routes and confirm no private content, names, email addresses, or returned visitor identifiers appear in PostHog events.
9. Confirm required choice blocks interaction only until Accept, Accept once, or Decline; confirm popup and banner remain non-blocking.
10. Confirm the Owner Analytics Live and Interactions tabs distinguish unavailable reports from real zero values and never display visitor identifiers.
11. Open one normalized organic link and confirm its source, `organic_social` medium, campaign, and post identity after GA processing.
12. Confirm Search Console reporting still works independently.

Rollback all browser collection with a newly deployed `NEXT_PUBLIC_CARDFORGE_ANALYTICS_ENABLED=false` build; this preserves provider-owned history and owner reporting access. After the event-only Privacy Policy is published, never roll back to a replay-capable build unless browser collection has first been disabled and verified in production.

## Developer Cockpit and Buffer

`CARDFORGE_EXTENDED_CONTRIBUTIONS_ENABLED` and `CARDFORGE_BUFFER_PUBLISHING_ENABLED` are independent and default false. Owner approval remains mandatory. Supabase owns CardForge media/campaign history; Buffer owns only provider scheduling and delivery.

For a Pipeline-catalog release, preserve this order: apply and verify the forward Pipeline migrations; run `npm run pipeline:sync-defaults`; verify every expected shared template, standard-size CardForge Studio back, style, and referenced media record is published at the intended tier; then deploy the bundle that reads Pipeline records only. Never deploy the pipeline-only reader before the import is complete. A rollback may disable the new bundle, but must not restore deleted registry rows, managed files, or private deletion tombstones.

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
- `npm run pipeline:sync-defaults`: import missing bootstrap templates, styles, and referenced Studio media through the atomic Pipeline command. Run only after Pipeline migrations. It preserves existing owner decisions and permanent-deletion tombstones; it is not a runtime fallback or overwrite command.
- `npm run brand:export`: synchronize canonical brand SVGs into the runtime `public/brand/cardforge-studio/` mirrors and regenerate ignored PNG derivatives under `output/`.

## Manual release checks

- Canonical apex, `www` redirect, robots, sitemap, self-canonicals, Open Graph URLs, and protected-route noindex behavior.
- One real production owner/developer flow affected by the release.
- One customer-facing Stripe receipt and one reply-to round trip when billing/email identity changes.
- Downloaded PDF/TTS artifact inspection and a real TTS import when export behavior changes.
- Search Console sitemap/discovery after domain, metadata, or route changes.
