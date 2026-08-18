# CardForge Operations

Last updated: August 18, 2026

This is the current runbook for `https://cardforges.com`. Provider dashboards own live state; this document owns the safe operating sequence and the evidence required after a change. Do not preserve deployment IDs or completed rollout diaries here.

## Production topology

- Vercel deploys `main`; `NEXT_PUBLIC_APP_URL` must be `https://cardforges.com`.
- `www.cardforges.com` permanently redirects to the apex domain.
- Clerk owns authentication and trusted private account metadata.
- Stripe owns Creator Pass, voluntary support checkout, subscriptions, webhooks, and the customer portal.
- Supabase owns shared product state and approved public media. Browser-local creator projects remain in IndexedDB/project files.
- Resend owns transactional email delivery.
- Google Cloud project `cardforge-authentication` owns the production OAuth client used by Clerk. Google Cloud project `cardforge-analytics` owns the least-privilege service identity used for GA4 and Search Console owner reports.
- GA4 owns consented acquisition/adoption reporting, PostHog owns anonymous allow-listed interaction events, and Search Console independently owns Google discovery reporting.
- CardForge owns marketing strategy, approval, scheduling, community tasks, and delivery history. Meta owns Facebook/Instagram authorization and publication APIs.

Secrets stay in Vercel or the owning provider. The Owner Console reports readiness and operational state; it must never render raw secret values.

## Required environment groups

Core: `NEXT_PUBLIC_APP_URL`, Clerk keys, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`.

Billing: Stripe publishable/secret/webhook keys, Creator Pass Price, the four support Prices, support currency, and support portal URL.

Email: `RESEND_API_KEY`, `CARDFORGE_EMAIL_FROM`, and `CARDFORGE_EMAIL_REPLY_TO`.

Access: `CARDFORGE_OWNER_ACCOUNT_EMAILS`, `CARDFORGE_DEV_ACCOUNT_EMAILS`, and `CARDFORGE_PAID_ACCOUNT_EMAILS`. Configure exactly one owner email: it is both the environment owner and the canonical Pipeline publisher. Additional developers belong in Clerk entitlement metadata or the developer allowlist, never in the owner publisher setting.

Analytics: the public enable flag, GA measurement ID, PostHog project token/ingestion host, plus the server-only GA property/service account, Search Console site URL, and PostHog project ID/app host/personal key. Limit the PostHog personal key to Query Read for the one CardForge project.

Social publishing: Meta app ID/secret, the reviewed Facebook Login for Business configuration ID, an explicit Graph API version, a base64 32-byte token-encryption key, the Cron dispatcher secret, and the native publishing flag.

Use `.env.example` as the complete variable catalog.

## Development deployment cadence

Vercel remains CardForge's hosted development-preview and production runtime. GitHub is the source/CI workspace; Vercel Preview is the live integration environment for feature branches; Vercel Production deploys `main` to `cardforges.com`. Do not add a second hosting platform solely to gain more development build volume unless a proven Vercel runtime, cost, or capacity limitation remains after the workflow below is followed.

For GitHub-only or remote-agent work, do not use one-file write operations that create a commit as the normal implementation loop. Prepare related changes first and, when Git data APIs are available, create the changed blobs/tree, one coherent commit, and one branch-ref update. A branch push should represent something coherent enough to build and inspect.

GitHub `verify` is the deterministic code-health loop. Vercel Preview is not a compile loop: use it after a coherent implementation checkpoint to test browser rendering, navigation, responsive behavior, auth/cookie boundaries that are valid on Preview, MCP/API routing, and provider-backed integration that the Preview environment can safely exercise. Batch follow-up fixes into the next coherent commit instead of pushing each adjustment separately.

Default deployment cadence is one initial Vercel Preview for the coherent PR head and only meaningful follow-up previews after relevant fixes. Do not push no-op, incomplete, documentation-only, or test-only commits merely to obtain or retrigger a Vercel status. If Vercel reports a build-rate or quota block, stop pushing until that provider state changes; do not bypass required checks or create more commits to chase the status.

If stronger development isolation becomes necessary, first use Vercel Preview-scoped or branch-specific environment variables and dedicated non-production provider credentials where appropriate. Keep production provider settings and `NEXT_PUBLIC_APP_URL=https://cardforges.com` authoritative for `main`. Introduce a second hosting platform only after a concrete requirement shows that the existing GitHub + Vercel Preview model cannot satisfy the development workflow cleanly.

## Release sequence

1. Run the smallest focused checks while implementing. Temporary development tests should be removed or consolidated once the behavior is proven unless they protect a durable high-risk boundary or known regression. Remote agents batch related Git changes into coherent milestones rather than pushing each file or test adjustment independently.
2. Before the PR, run `npm run lint`, `npm run typecheck`, `npm run architecture:check`, `npm run migrations:check`, the focused durable tests affected by the change, `npm run build`, and `git diff --check`. GitHub runs the maintained verification suite once on the exact PR head.
3. Require the GitHub `verify` check and a successful Vercel preview deployment on the exact PR head. Vercel READY proves deployment, not visual quality: exercise every changed public workflow on that preview at desktop and mobile widths and confirm the primary action is obvious, branding and control values do not clip or repeat, navigation and touch targets remain usable, no horizontal overflow appears, and the imagery, contrast, spacing, and hierarchy still feel like CardForge. Use the signed-in production browser for provider-backed roles that a preview cannot validly prove.
4. Apply an additive production migration only after Cameron explicitly approves that exact provider mutation. Run the postflight below before merging code that depends on the new schema.
5. Merge through the PR; do not force-push or bypass `main` protection.
6. Confirm the Vercel production deployment is READY for the merged commit, then run `npm run health:production`.
7. Use a real signed-in production browser for owner, developer, billing, or other provider-backed flows. Localhost and raw HTTP are not final proof for those paths.

Rollback application behavior with the relevant feature flag or a forward code fix. Never delete migrations, ledgers, campaign history, deliveries, or financial records to simulate rollback.

### Solo-maintainer branch rule

While `@pyralisxc` is the only trusted code owner, branch protection may require zero approvals because a PR author cannot approve their own change. Resolved review threads plus `verify`, a successful Vercel deployment, and the live workflow check remain mandatory. Raise required approvals to one when a second trusted reviewer is added.

## Supabase migration and security procedure

Migration files are immutable after creation. `npm run migrations:check` rejects modifying, deleting, or renaming an existing file; every schema change must be a new forward migration.

Production migration history currently contains provider-generated timestamps that do not consistently match older repository filenames. Do not edit an old migration or reapply a migration merely to make names agree. For each new change:

1. Record the production project, current migration tail, affected tables/functions, RLS/grants, object counts, and advisor findings.
2. Review failure safety, idempotency, and rollback. Multi-table state transitions must be one database function/transaction or have explicit compensation.
3. With explicit approval, apply exactly the reviewed new SQL once.
4. Confirm the function/table exists, expected row/object counts are unchanged, `anon` and `authenticated` cannot access privileged tables/functions, and only `service_role` has required access.
5. Run Supabase security and performance advisors and resolve relevant warning/error findings.
6. Record the applied production version in the PR or release evidence. If the provider assigned a different version, align the unapplied repository filename before merge; do not rewrite recorded production history.

### Canonical owner identity consolidation

The prelaunch proxy cleanup is a provider-and-database cutover, not a display rename. Preserve this order for `20260814220651_consolidate_owner_identity.sql`:

1. Verify every proxy email listed in the migration has no Stripe customer, subscription, payment, or entitlement history. Stop on any match.
2. Set `CARDFORGE_OWNER_ACCOUNT_EMAILS` to only `pyraliscameron@gmail.com` in Vercel Production and Preview, remove proxy emails from developer allowlists, deploy that configuration, and verify the old account no longer has owner authority.
3. Delete the remaining `cameron.r.locke96@gmail.com` Clerk account and verify every migration-listed proxy Clerk ID is absent. The database retirement trigger is defense in depth; it is not a substitute for revoking provider sessions and roles.
4. Copy the one managed template object from its old user-ID path to the canonical Pyralis user-ID path with the Supabase Storage API. Verify destination size and SHA-256 against the source, and retain the source through migration postflight.
5. Apply the forward migration. Verify one canonical active profile, transferred submission/vote/roadmap counts, zero proxy profiles or active attribution references, fifteen identity aliases, unchanged raw owner-activity rows plus one consolidation event, and the new storage URL.
6. Deploy the reviewed application, verify People, Change History, Library, Template Studio, and a canonical owner Pipeline save, then remove the unreferenced old storage object. Never restore a proxy allowlist or Clerk role during rollback; forward-recover by copying the canonical object back and applying a new migration if the storage reference must be reversed.

## Operator identity and transfer

CardForge Studio is currently operated by Cameron Locke as an Oregon sole proprietor. `business-identity` owns the application contract and the Supabase singleton owns the live record. Stripe, Resend, Clerk, Vercel, the domain registrar/DNS, GitHub, Search Console, structured data, public copy, and legal publications must agree with that record.

Changing the operator is a legal and operational migration, not a copy edit. Require written confirmation covering intellectual property, domains, customer and contractual obligations, privacy-control responsibility, billing and tax treatment, support obligations, effective date, and customer notice before changing the canonical identity. Inventory every provider-owned record, migrate deliberately, deploy the exact reviewed commit, and verify public, owner, billing, email, and legal surfaces together. Git history alone does not establish a transfer, and no provider change is implied by repository documentation.

## Owner Console checks

Use `/owner` through six job-based workspaces: Overview, Marketing, Growth & People, Site Controls, Studio Library, and Governance. Feature modules still own their data; Owner composes their controls and never becomes a duplicate persistence layer. The asset library shows the complete pipeline through type/status filters, search, and 12-item pages instead of silently truncating the review list. Forge Pipeline > Studio Map shows the exact creator-facing destinations, placement mode, order, and featured state for every registry asset; clear all compatible destinations under Owner override to hide an asset without deleting its history.

Overview > Integrations is the owner-facing provider inventory. Every production dependency must name its purpose, identifier, authoritative owner, removal impact, and exact dashboard destination. Runtime readiness is shown only when CardForge can derive it from configuration; provider-managed entries are labeled honestly instead of being treated as application settings. Add, replace, or retire a provider in this inventory and this topology together. Never render credentials, secret values, or recovery material.

Growth & People > People joins Clerk accounts to retained Supabase developer profiles. Revoke developer access by removing Clerk developer entitlement, marking the CardForge profile inactive, and clearing campaign/site scopes; preserve genuine submissions, votes, and attribution. A deleted Clerk identity appears as History only and must not count as an active developer. Environment-owned owner access is read-only in the console and must be changed in the Vercel owner-email allowlist. The prelaunch Cameron/QA identities were development proxies, so their owner-authored records are consolidated once into the canonical Pyralis Cameron profile rather than retained as fictitious contributors. The retired Creator Pool is an archived legal record, so the console exposes no payout eligibility or pool-percentage control.

Site Controls > Pages & SEO owns the allowlisted primary-navigation labels/order/visibility, homepage section order/visibility, public announcement, homepage action, homepage search metadata and search phrases, and public promotion visibility. Copy owns the grouped shared-shell, landing, About, founder, developer-program, roadmap, and sharing catalog. Media owns the brand mark, favicon, watermark, default social image, homepage imagery, Studio screenshots, live-example artwork, and founder portrait; it also controls watermark opacity/size while entitlement code owns when the mark is required. Experience & Access can make portable project files free or Creator Pass-only and can switch analytics consent among required choice, standard popup, and quiet banner. Code still owns allowed routes/sections, validation, permissions, capability claims, and the three-choice consent contract.

Governance > Change History is append-only and must never contain credentials or raw provider payloads. Legal rollback loads an older immutable version as a new draft; publishing always creates a new version. For the completed content/media owner, verify the legacy external homepage share-image field is blank, apply `20260814153745_complete_owner_site_content_and_brand_media.sql`, then deploy. The same forward migration fixes retired Creator Pool defaults at zero/false and neutralizes legacy-bundle writes while temporarily retaining those columns for migration-first compatibility; the application no longer reads or writes them. Postflight one harmless copy edit, one watermark presentation edit, and the managed favicon/brand endpoints; each owner mutation must produce the public result and an owner-history row.

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

## Marketing Command Center and Developer Cockpit

`CARDFORGE_EXTENDED_CONTRIBUTIONS_ENABLED` and `CARDFORGE_META_PUBLISHING_ENABLED` are independent and default false. Owner approval remains mandatory. Supabase owns strategy, campaign grouping, approved content, destination rules, encrypted provider connections, scheduling, retries, and publication history. Meta owns the connected Facebook/Instagram account and the final provider post.

For a Pipeline-catalog release, preserve this order: apply and verify the forward Pipeline migrations; run `npm run pipeline:sync-defaults`; verify every expected shared Template, standard-size CardForge Studio back, style, and referenced media record is published at the intended tier; then deploy the bundle that reads Pipeline records only. Never deploy the pipeline-only reader before the import is complete. A rollback may disable the new bundle, but must not restore deleted registry rows, managed files, or private deletion tombstones.

For `20260815151046_studio_first_asset_routing.sql`, migration must precede application deployment because the bundle selects the new registry columns and the owner API calls the new service-only RPCs. Apply its companion `20260815175000_correct_studio_divider_classification.sql` in the same migration batch; it fail-closes around owner routing and truthfully moves the two known title/panel starters from Icons to Dividers. The routing migration's submission trigger translates any `parts` write from the immediately previous bundle into its truthful Icon or Divider destination, so contribution writes remain compatible during the migration-first window and an application rollback does not recreate the retired category. Postflight zero `part` registry rows and zero `parts` submissions/settings keys; confirm Front Templates, Back Templates, Pictures, Front Frames, Back Frames, Icons, Dividers, Textures, Styles, and Fonts have truthful counts; then run the bootstrap sync and deploy. The bootstrap sidecars carry explicit repository-path aliases for the ten intentionally moved assets, allowing only those former repository URLs and source paths to migrate while preserving unrelated owner-authored URLs and lineage metadata. Verify one front and one back Frame can be selected in Template Studio, Pictures never contain Frames, the Generator still exposes only complete Templates, a developer shared-Template save creates the next Forge Review revision without changing the live Template, and Owner Studio Map can save an override and restore automatic placement. Roll back the application only; forward-recover schema or routing data with a new migration rather than dropping routing columns or restoring the retired Parts category.

Apply `20260815175658_owner_template_direct_publish.sql` before deploying its application bundle. It adds one service-role-only transaction that creates the numbered owner revision and publishes it through the existing owner override/rebalance path; the preceding bundle does not call it, so migration-first is backward compatible. After deployment, verify the Studio owner action says `Publish Template changes`, its review link opens the submitted Owner Review queue, and a developer still sees `Submit Template revision`. Do not create a throwaway production revision for postflight; use a real intended owner edit when available. Application rollback is safe and may leave the unused forward function in place.

Before extended contributors are enabled, verify protected source storage, approved-only public derivatives, canonical media/attachment/association integrity, private preview authorization, owner-only approval/provider mutations, legal publications, and scoped developer grants. A stale campaign version or invalid relationship must leave the campaign, attachments, exposure, and version unchanged.

Before native Meta publishing is enabled:

1. Create a Meta Business app, add Facebook Login for Business, and register `https://cardforges.com/api/owner/marketing/meta/callback` as an exact OAuth redirect URI.
2. Create a Facebook Login for Business configuration using a user access token and only `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, and `instagram_content_publish`. Store its ID as `CARDFORGE_META_LOGIN_CONFIGURATION_ID`; CardForge invokes that reviewed configuration instead of supplying ad hoc scopes. Facebook publication targets Pages; Instagram requires a professional account. Groups and third-party communities remain manual destinations.
3. Set the five required Meta/encryption variables plus `CARDFORGE_MARKETING_DISPATCH_SECRET` in Vercel with `CARDFORGE_META_PUBLISHING_ENABLED=false`. Set `CARDFORGE_META_PAGE_ID` too when the owner account manages more than one Page; the connection fails closed instead of storing credentials for every manageable Page. Deploy, then use Owner Console → Marketing → Distribution → Connect Meta. Confirm the connection table exposes only safe metadata while token ciphertext remains server-only.
4. Store the dispatch URL and bearer secret in Supabase Vault. Create one Supabase Cron job that POSTs to `https://cardforges.com/api/marketing/dispatch` every minute with the bearer header. Never place the secret directly in migration SQL or a browser-visible setting.
5. Approve harmless content with one Facebook variant and approved derivative. Prepare it for the owned Page, enable native publishing, run the dispatcher once, and confirm one published delivery row and matching Meta post ID. Repeat with a future schedule and verify the due item is claimed once.
6. For Instagram, link or choose a professional account and repeat the harmless publication. Approval creates a public 1080×1350 JPEG delivery derivative while the protected WebP master stays private. Confirm container failures remain retryable and no protected source URL is exposed.
7. Add community destinations with their rules link, last-checked time, and posting guidance. Confirm they always create manual tasks and can be completed with an optional publication link and outcome note.

Rollback native mutations by setting `CARDFORGE_META_PUBLISHING_ENABLED=false`. The dispatcher then refuses new provider calls while schedules and history remain intact. Delete the Supabase Cron job only if the endpoint itself is being retired; never delete campaigns, content, connection history, or delivery records to simulate rollback.

## Authenticated production smoke

The former reusable QA accounts were retired. Do not recreate them merely to satisfy a broad suite. For auth, billing, provider-domain, entitlement, or protected recovery changes, verify the exact flow on production with the real signed-in owner/developer account. Re-enable a dedicated authenticated smoke identity only when a specific recurring provider regression justifies its maintenance cost.

The remaining automated suite protects focused data contracts and known regressions. It does not replace a real production browser check for the specific owner/developer workflow changed by a release.

## Billing reconciliation

Stripe remains authoritative. Product access and voluntary support are separate billing purposes; support must never grant product entitlement.

From `/owner`, refresh billing and select **Reconcile billing**. Record `checked`, `repaired`, `unchanged`, `missingClerkUser`, `ledgerCreated`, and `missingLedger`; require `missingLedger` to be zero and investigate missing Clerk users before manual entitlement changes.

For webhook proof, use **Stripe Workbench -> Webhooks** and resend a recent event twice. Require HTTP 200, one Supabase event row, a durable duplicate decision, and no unintended entitlement change. Do not alter a real subscription to manufacture an event.

Safe support rollback removes/disables support checkout environment values while retaining the purpose-aware webhook and additive ledger. Never deploy an older webhook that cannot distinguish support from product access.

## Maintained commands

- `npm run health:production`: canonical public/API health.
- `npm run smoke:ui`: focused mocked browser regression for the Developer Cockpit and accessibility contract. It does not prove signed-in provider behavior.
- `npm run pipeline:sync-defaults`: import missing files from `data/pipeline-bootstrap/{templates,recipes,metadata,media}` through the atomic Pipeline command. Run only after Pipeline migrations. It preserves existing owner decisions and permanent-deletion tombstones; it is not a runtime fallback or overwrite command. Public-page fallback art lives separately under `public/site-fallbacks`.
- `npm run brand:export`: synchronize canonical brand SVGs into the runtime `public/brand/cardforge-studio/` mirrors and regenerate ignored PNG derivatives under `output/`.

## Manual release checks

- Exercise every changed public workflow on the exact Vercel preview at desktop and mobile widths, then verify it once on the merged production deployment.
- Canonical apex, `www` redirect, robots, sitemap, self-canonicals, Open Graph URLs, and protected-route noindex behavior.
- One real production owner/developer flow affected by the release.
- One customer-facing Stripe receipt and one reply-to round trip when billing/email identity changes.
- Downloaded PDF/TTS artifact inspection and a real TTS import when export behavior changes.
- Search Console sitemap/discovery after domain, metadata, or route changes.