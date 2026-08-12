# CardForge Operations

Last updated: July 23, 2026

This is the current live-operations checklist for CardForge.

## Live Site

- Canonical domain: `https://cardforges.com`
- Vercel production branch: `main`
- Required canonical env var: `NEXT_PUBLIC_APP_URL=https://cardforges.com`
- Robots and sitemap must point to `https://cardforges.com`.
- `https://www.cardforges.com` is attached to the Vercel project and permanently redirects to the canonical apex.
- Google Search Console uses a DNS TXT record on the root `cardforges.com` domain.

## Required Production Services

- Vercel: hosting, production env vars, domains, deployments.
- Clerk: authentication and trusted private metadata.
- Stripe: Creator Pass checkout, subscription events, webhook, customer portal.
- Supabase: owner settings, roadmap, contact requests, asset/developer pipeline, campaign packages, and approved media.
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
CARDFORGE_EMAIL_FROM=CardForge <support@cardforges.com>
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
- Current production deployment `dpl_9ncYWokxiUbiQ3epVY681GjMXKhw` is READY on `main` commit `8ed65a4f0bb0bf3252407b65c8a5f41a6949c1a2`.
- The maintained five-route production health check passed on July 23 in [run 30008144709](https://github.com/pyralisxc/CardForge/actions/runs/30008144709). Vercel showed no grouped runtime errors in the preceding 24 hours and no retained 5xx cluster for the current deployment.
- Current production serves a static public **Sign in** link to `/sign-in`; Clerk mounts only on that dedicated route and returns successful authentication to `/account`.
- The Stage 2 closure [run 29889963025](https://github.com/pyralisxc/CardForge/actions/runs/29889963025), job `88828243550`, passed the protected signed-out Clerk entry, reusable free/paid/developer/owner authorization, and paid project export/import recovery outcomes on the production commit. [Artifact 8517892501](https://github.com/pyralisxc/CardForge/actions/runs/29889963025/artifacts/8517892501) was retained through August 5, 2026.
- The July 23 scheduled [run 30022834234](https://github.com/pyralisxc/CardForge/actions/runs/30022834234), job `89259701921`, repeated the same four outcomes without skips. [Artifact 8570031414](https://github.com/pyralisxc/CardForge/actions/runs/30022834234/artifacts/8570031414) is retained through August 6, 2026.
- Stripe has processed the Creator Pass sale plus one-time and monthly creator-support payments. Purpose-aware webhook handling is live-proven, support does not grant product access, and the existing Creator Pass subscriber agrees across Stripe, Clerk, Supabase, and the owner console.
- Resend domain verification, sender/reply-to configuration, outbound test delivery, and the stored production contact-request delivery record agree.
- Google Search Console domain verification is complete. `https://cardforges.com/sitemap.xml` was submitted successfully and reported 13 discovered pages when last read on July 21.
- Vercel serves valid TLS for `www.cardforges.com` and returned a permanent `308` redirect to `https://cardforges.com/` on July 23.
- July 23 paid-browser acceptance proved individual front/back PNG downloads, a four-face PNG ZIP, PDF generation without an application error, a two-card Tabletop Simulator export, and 72-card desktop/mobile save-and-reload recovery. The first 72-card TTS pass exposed an oversized-canvas PNG failure; PR #85 moved card faces through short-lived bitmaps, and PR #86 restored the full 4K sheet budget without restoring the memory failure. A later 72-card production export completed, and its 4090×3710 front texture was inspected. The current UI separates individual/PNG-set, raster PDF, and TTS settings; TTS offers efficient 10×7 sheets or higher-detail 5×4 sheets. Editor, preview, and export now share the canonical `CardPreview` canvas; a local six-element comparison measured zero position or size difference between Edit and Preview, with editor overlays also aligned exactly. Importing one package into Tabletop Simulator and visually checking the new 5×4 option remain manual acceptance checks.
- Supabase migration `20260721220801_grant_site_media_service_role` is applied in production. It grants only `SELECT`, `INSERT`, and `UPDATE` on `cardforge_site_media` to `service_role`; this repository migration records that already-live state and does not require another provider mutation.

## Business identity provider alignment

The repository identity is CardForge Studio, created and operated by Cameron Locke as an independent sole proprietor based in Oregon. The business-identity migration is applied in production, and current public legal and product surfaces use that identity.

Direct provider verification on July 23 confirmed that Stripe uses public business name **CardForge Studio**, website `https://cardforges.com`, and statement descriptor `CARDFORGE STUDIO`. Resend has verified `cardforges.com`; the delivered test used `CardForge <support@cardforges.com>` and the configured support reply-to. A customer receipt/invoice is available in Stripe, but that inspected payment had not sent a receipt email. A reply-to header is also not proof of a completed reply round trip. Those two low-risk acceptance checks remain in the manual checklist; they do not reopen sender, domain, checkout, webhook, or entitlement alignment.

Do not change provider identity from a documentation-only review. Follow [the operator identity and transfer runbook](operator-identity-and-transfer-runbook.md) for any later identity or ownership transfer.

## Legal publication and public cache operations

Legal documents are immutable versioned publications. Publishing through `/owner` requires the identity version currently shown in the console; a concurrent identity update produces a conflict instead of attaching legal text to stale operator data. Publication does not create or infer retroactive terms acceptance.

The versioned legal-publications migration is applied in production. When publishing:

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
- homepage cover and Studio walkthrough images
- Cameron profile, portrait, and social links
- business identity
- site mechanics
- legal documents
- developer program settings
- account lookup/access changes

Secrets stay in Vercel/provider dashboards. The owner console should show readiness, not raw secret values.

## Database Security

- Browser-direct writes are not supported.
- Privileged RPCs must revoke `EXECUTE` from `PUBLIC`, `anon`, and `authenticated`.
- Privileged product RPCs are callable only by the server-side `service_role`.
- Run Supabase security and performance advisors after every migration.
- Verify role grants directly; RLS does not protect an exposed `SECURITY DEFINER` function.
- Keep `cardforge_founder_profile` inaccessible to `anon` and `authenticated`; public access applies only to the intentional portrait object in the public-media bucket.

## Delivery Gates

- The active GitHub `Updates` ruleset applies to the default branch and `main`. It requires pull requests and resolved review threads, blocks branch deletion and non-fast-forward updates, and strictly requires the GitHub Actions checks `verify` and `public-smoke`.
- Pull requests must pass `verify` and `public-smoke` before merge.
- `public-smoke` is intentionally limited to public/API health, one created card, the free clean-export boundary, and uncaught browser or HTTP 5xx failures along those paths. Marketing copy, route catalogs, menu labels, accessibility scans, editor interactions, bulk/performance scenarios, and device-layout checks are manual or focused verification when that feature changes; they are not permanent release gates.
- `npm run architecture:check` must report zero violations; no baseline or exception file exists.
- Authenticated provider smoke uses protected environment secrets and must never run for untrusted fork code.
- Vercel build success alone is not a release-health verdict.
- Production route health runs every six hours; GitHub owns failure notification and Vercel runtime error groups remain the primary server-error aggregation view.

## Operational Ownership

Cameron Locke is the named operator for launch-period incidents. Existing surfaces own the first signal and response path:

- CI, public smoke, authenticated smoke, and scheduled production-health failures: GitHub Actions email/notification, then the failed job and retained artifact.
- Checkout, webhook, and reconciliation failures: Stripe Workbench plus the owner-console billing snapshot and reconciliation result; Supabase is the durable event/ledger check.
- Server/runtime failures: Vercel runtime error groups and function logs.
- Persistence failures: the Studio save status, quota warning, recovery snapshot, and project import; reproduce in the affected browser before changing provider state.
- Contact/email failures: the owner-console contact history and email-test result, then Resend delivery details.

Organic analytics code is present but browser collection remains hard-disabled until the privacy disclosure is current and `NEXT_PUBLIC_CARDFORGE_ANALYTICS_ENABLED=true`. GA4 answers anonymous acquisition and creator-journey questions; Search Console remains the organic Google discovery source. No paid-ad pixel, advertising storage, Google Signals, or ad-personalization signal is enabled.

## Organic analytics rollout

The Owner Console Analytics tab is useful before collection is enabled: it identifies missing configuration and builds consistent Facebook/Threads links. Google remains the measurement owner; CardForge queries reports read-only and does not copy raw visitor events into Supabase.

1. Create one GA4 property and web stream for `https://cardforges.com`. Record its `G-` measurement ID and numeric property ID.
2. Create a dedicated Google Cloud service account, enable the Google Analytics Data API and Search Console API, grant it Viewer access to the GA4 property, and add the same address as a read-only Search Console user for `sc-domain:cardforges.com`.
3. Set `NEXT_PUBLIC_CARDFORGE_GA_MEASUREMENT_ID`, `CARDFORGE_GOOGLE_ANALYTICS_PROPERTY_ID`, `CARDFORGE_GOOGLE_SERVICE_ACCOUNT_EMAIL`, `CARDFORGE_GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, and `CARDFORGE_GOOGLE_SEARCH_CONSOLE_SITE_URL`. Keep the private key server-only.
4. Leave `NEXT_PUBLIC_CARDFORGE_ANALYTICS_ENABLED=false`. Verify `/owner` can read the GA4/Search Console setup state and Search report without revealing credentials.
5. Publish a privacy version that accurately describes the opt-in measurements and retention choices. Then set `NEXT_PUBLIC_CARDFORGE_ANALYTICS_ENABLED=true` and deploy.
6. In the GA4 web stream, disable Enhanced Measurement entirely. Confirm history changes, outbound clicks, form interactions, site search, downloads, video engagement, and scroll tracking are all off; CardForge owns its explicit event allowlist.
7. In GA4 Admin, mark `sign_up` and `export_completed` as key events. Keep `open_studio` and `card_created` as adoption signals rather than conversions.
8. In a signed-out browser, decline analytics and confirm no Google tag request, `_ga` cookie, or CardForge event. Reopen Analytics settings, allow it, and confirm only sanitized path/title/referrer context, approved UTM fields, and `open_studio`, `sign_up`, `card_created`, and `export_completed` appear. Confirm raw non-UTM query values never reach DebugView.
9. Share one harmless tracked organic link. Confirm its `source`, `organic_social` medium, campaign, and post identity in the Owner Console after GA4 processing; confirm a forced API failure renders unavailable rather than zero traffic.

Rollback by setting `NEXT_PUBLIC_CARDFORGE_ANALYTICS_ENABLED=false` and redeploying. This removes browser collection and the preference UI without deleting Google-owned history. Remove the service-account environment values separately only when read-only Owner Console reporting should also stop.

## Developer Cockpit and Buffer rollout

The contribution cockpit has two independent production switches:

- `CARDFORGE_EXTENDED_CONTRIBUTIONS_ENABLED=true` activates owner-granted campaign/site scopes for non-owner developers.
- `CARDFORGE_BUFFER_PUBLISHING_ENABLED=true` permits owner-only Buffer mutations.

Both default false. Owner inspection remains available while disabled so the migration and workflow can be verified without delegating new permissions or publishing externally.

Required server-only Buffer values:

```bash
BUFFER_API_KEY=
BUFFER_ORGANIZATION_ID=
CARDFORGE_BUFFER_ALLOWED_CHANNEL_IDS=
CARDFORGE_BUFFER_PUBLISHING_ENABLED=false
```

Treat `CARDFORGE_BUFFER_ALLOWED_CHANNEL_IDS` as the production blast-radius boundary. List only the connected Facebook/Instagram/other channel IDs CardForge intends to operate. A blank allowlist exposes every channel the account key can reach and is not acceptable for production enablement.

Preflight before activating extended contributors:

1. Before applying `20260727090000_developer_contribution_cockpit.sql`, confirm production migration history still does not contain it and that `cardforge_social_campaigns`, `cardforge_campaign_media`, `cardforge_campaign_media_derivatives`, `cardforge_social_campaign_media_attachments`, `cardforge_social_campaign_associations`, `cardforge_social_publish_jobs`, and `cardforge_site_content_proposals` do not exist. This is the first and final cockpit schema; do not add a compatibility migration solely for the retired bucket/path contract.
2. Apply the migration in an approved rollout window. Confirm every cockpit/media table has RLS enabled; `anon` and `authenticated` have no privileges; and only `service_role` has table/function access. Exercise the atomic campaign create, campaign update, campaign approval, and site-proposal publication functions with a disposable QA record. Force one invalid relationship and one stale version; confirm each transaction leaves the parent row, relationships, approval state, and version unchanged.
3. Confirm `cardforge-social-sources` is private and retains both the protected immutable original and protected normalized WebP master. Confirm `cardforge-social-media` is public only for explicitly approved derivatives, with the documented JPEG/PNG/WebP 12 MiB ingest limit.
4. Run Supabase security and performance advisors, resolve relevant warnings, and record the results before enabling any contribution scope.
5. Publish reviewed new versions of the privacy notice and developer terms that cover marketing/site-copy contributions, attribution/history, provider delivery, and approved public media. Do not enable non-owner campaign/site scopes before that legal publication.
6. In the owner cockpit, grant campaign and site scopes only to the intended active developer QA account; confirm another developer remains asset-only.
7. Set `CARDFORGE_EXTENDED_CONTRIBUTIONS_ENABLED=true`, deploy, and verify the scoped developer can ingest/reuse media by ID and draft/submit, but cannot approve, expose media, publish site copy, load channels, or call provider mutations. Verify the owner Media Library shows provenance, relationships, and metadata totals without raw object paths.

Preflight before activating Buffer:

1. Generate a personal API key from the owner Buffer account and store it only in the server environment.
2. Record the intended organization ID, connect the production channels in Buffer, and populate the exact channel allowlist.
3. Leave publishing disabled and use the owner cockpit to load channels. Confirm service/name/paused state and that no unlisted channel is returned.
4. Create an owner-approved internal campaign with non-sensitive media. Confirm ID-based private preview rejects unauthorized users, owner approval is retry-safe, one reused media item produces one public derivative, and the public derivative is stable over HTTPS. Repeat with a stale campaign version and confirm CardForge exposes neither the prepared derivative nor a partially approved campaign.
5. Set `CARDFORGE_BUFFER_PUBLISHING_ENABLED=true`, redeploy, create Buffer drafts first, and verify CardForge stores one provider job per channel with the matching provider post ID.
6. Schedule a deliberately harmless post, verify the due time in Buffer, then refresh CardForge until the delivery status agrees. Record the deployment, campaign ID, job IDs, provider post IDs, and visible result in the risk register without recording the API key.

Rollback by setting `CARDFORGE_BUFFER_PUBLISHING_ENABLED=false` and redeploying. This stops new provider mutations but intentionally preserves CardForge campaigns/jobs and existing Buffer drafts or schedules. Cancel or edit already-created posts in Buffer, then refresh the CardForge job ledger; do not delete contribution or delivery history to simulate rollback.

Buffer post metrics are provider-level public-content measurements, not CardForge visitor analytics. This release stores delivery states only and does not ingest social metrics or add first-party product/marketing tracking.

### Solo-maintainer branch rule

While `@pyralisxc` is the only trusted code owner, the active ruleset retains zero required approvals because a pull-request author cannot approve their own change. Raise required approvals to one when a second trusted reviewer is added, or review this exception by August 15, 2026.

## Authenticated production smoke

Run **Actions → Authenticated smoke → Run workflow** against the candidate branch before merge, then `main` after auth, billing, provider-domain, or entitlement changes. The workflow fails before browser installation unless all protected values exist:

- reusable free, paid, developer, and owner QA account emails;
- production Clerk publishable and secret keys; and
- production Supabase URL and service-role key.

A valid run must pass the signed-out public-header → `/sign-in` → interactive Clerk-form/bootstrap check, the reusable free, paid, developer, and owner entitlement and authorization matrix, and one paid project export/import recovery. The signed-out check records every Clerk `/v1/client` and `/v1/environment` response, fails on any HTTP 400 or greater response or Clerk-related browser console error, and never expects Clerk to mount on `/`. It intentionally does not gate marketing copy, panel labels, profile styling, roadmap voting, or the developer asset submission lifecycle; verify those manually or with focused tests when the feature changes. Retain the `authenticated-smoke-<run id>` artifact for 14 days and record the run URL in the risk register. A green run with skipped role tests is not acceptable. Current production evidence is [run 30022834234](https://github.com/pyralisxc/CardForge/actions/runs/30022834234) on commit `8ed65a4f0bb0bf3252407b65c8a5f41a6949c1a2`; all protected outcomes passed without skips, and [artifact 8570031414](https://github.com/pyralisxc/CardForge/actions/runs/30022834234/artifacts/8570031414) expired August 6, 2026.

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

Stripe remains authoritative. The durable subscription ledger and duplicate-delivery path are live-proven. The existing Creator Pass subscriber is reconciled: Stripe subscription, Clerk private metadata, Supabase ledger, and the owner console show the same paid account. Do not ask the subscriber to purchase again. Reconcile again only after a relevant billing, identity, or webhook state change.

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
- Confirm `/developer/cockpit` emits noindex metadata and `/developer` remains the indexable application page.
- Confirm marketing and legal pages emit a self-referencing canonical and matching Open Graph URL.
- Validate the CardForge and Cameron JSON-LD in a structured-data inspection tool.
- Confirm the submitted sitemap remains successful in Google Search Console after domain or metadata changes.
- Complete one Stripe checkout or customer portal round trip after domain/env changes.
- Send one Owner Console test email after Resend/env changes.
- Confirm unpaid export prompts Creator Pass, not developer application copy.
- Recheck the `www.cardforges.com` permanent redirect after domain or canonical-host changes.
- Inspect the generated PDF and Tabletop Simulator package, including fronts, backs, ordering, and one import into Tabletop Simulator. Browser success alone does not prove the downloaded artifacts or simulator import.
- When convenient, record one hours-long editing session with large artwork and storage pressure. The July 23 72-card desktop/mobile save-and-reload acceptance is ordinary recovery evidence, not a literal long-session soak.
- Send or inspect one Stripe customer receipt and complete one reply-to round trip into the support inbox.
- Verify cancellation, refund, and entitlement removal only through a naturally occurring event or an explicitly approved test account. Never alter the real subscriber merely to manufacture evidence.
