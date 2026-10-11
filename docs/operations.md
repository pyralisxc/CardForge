# CardForge Operations

Last updated: October 10, 2026

This is the current runbook for `https://cardforges.com`. It contains only procedures that remain operationally useful. Completed rollout/cutover instructions belong in Git/provider history.

## Production topology

- Vercel deploys `main`; `NEXT_PUBLIC_APP_URL=https://cardforges.com` is canonical.
- `www.cardforges.com` redirects to the apex domain.
- Clerk owns authentication and trusted private account metadata.
- Stripe owns Creator Pass, Designer Pass, support checkout, customers, subscriptions, webhooks, and Billing Portal.
- Supabase owns shared product state, private temporary ChatGPT Studio documents and their normalized artwork, and managed public/protected media; ordinary browser projects remain local and durable provider projects remain provider-owned.
- Resend owns transactional email delivery.
- GA4, PostHog, and Search Console own analytics/search records.
- Meta owns Facebook/Instagram authorization and provider posts; CardForge owns marketing approval/scheduling/delivery history.

Secrets stay in Vercel or their owning provider. Profile owner operations may report readiness/identifiers but never raw credentials.

## Required environment groups

Use `.env.example` as the complete catalog.

- Core: `NEXT_PUBLIC_APP_URL`, Clerk keys, `SUPABASE_URL`, and `SUPABASE_SECRET_KEY`. `SUPABASE_SERVICE_ROLE_KEY` is a temporary compatibility fallback only.
- Billing: Stripe secret/webhook keys, Creator Pass and Designer Pass Prices, support Prices/currency/portal configuration.
- Email: `RESEND_API_KEY`, `CARDFORGE_EMAIL_FROM`, `CARDFORGE_EMAIL_REPLY_TO`.
- Access: one canonical `CARDFORGE_OWNER_ACCOUNT_EMAILS` identity plus contributor/paid allowlists where still intentionally used.
- Analytics: public enable/measurement values plus server-only GA/Search Console/PostHog reporting credentials.
- Social: Meta app/configuration/Graph version, token-encryption key, dispatch secret, and publishing flag.
- OpenAI plugin verification: `OPENAI_APPS_CHALLENGE_TOKEN` only while OpenAI is verifying the production domain.

## Development and release cadence

GitHub is the source/CI workspace. Agents run focused/affected checks locally; the required GitHub `verify` job is authoritative for the full deterministic repository gate. Vercel Preview is hosted integration proof, not a compile loop. Batch related work into coherent commits and avoid no-op/test-only pushes merely to retrigger provider status.

### Preview lane

`main` is the only production branch. Ordinary work uses one feature/objective branch and a PR into the accumulated `vercel-preview` integration branch; ordinary feature branches do not deploy automatically. Integrate an exact-head, CI-verified feature PR into `vercel-preview` through GitHub, preserving merge history. An eligible Preview branch update triggers the native Vercel deployment and the staging Supabase migration integration. Do not reset `vercel-preview` as a disposable deployment pointer. The stable review hostname is registered in Vercel Project Settings → Domains with an explicit Preview binding to Git branch `vercel-preview`, no redirect, and no custom environment. Vercel owns automatic assignment of that domain to successful branch deployments:

`https://card-forge-git-vercel-preview-pyralis-projects.vercel.app`

Preserve this explicit branch-domain binding rather than relying only on the generated branch alias or repeatedly assigning a deployment by hand. Keep the hostname unchanged because Preview provider origins and callbacks use it. A routing repair must preserve this branch binding and leave production domains unchanged; verify automatic assignment on a subsequent native Preview deployment before calling the repair complete.

The stable URL is intended to be publicly reachable for testers without Vercel sign-in, with CardForge/Clerk enforcing private data and operation permissions just as in Production. Verify current provider settings rather than assuming this intended access is already configured. Prefer the narrowest supported setting for this hostname; inspect scope, cost and rollback before applying it. Other deployment URLs may remain protected. The exact-deployment smoke uses the existing GitHub `VERCEL_AUTOMATION_BYPASS_SECRET` where required; separately verify stable-hostname public access without that bypass. Stripe retains its existing provider-managed webhook bypass until its delivery path is deliberately verified and changed. Never copy either bypass value into Git, chat, logs, packages, or another environment.

Vercel's Git integration must emit `vercel.deployment.success` repository-dispatch events. The deployment workflow accepts only project `card-forge`, Preview branch `vercel-preview`, or Production branch `main`, then checks out the exact payload SHA. Preview tests the exact payload URL; Production tests the canonical public domain immediately after the successful `main` deployment. No `VERCEL_TOKEN`, duplicate deployment, polling loop, or CardForge deployment ledger is required. The workflow also has an explicit manual trigger for one-time setup verification before the repository-dispatch file reaches `main`.

Preview provider ownership:

- Vercel project: `card-forge`, Preview environment scoped to `vercel-preview`.
- Supabase project: `Card Forge Staging`, project ref `mjdugheniazuiqoefnnb`; the official GitHub integration applies migrations from `vercel-preview`.
- Clerk: development instance; use the existing real owner/developer account for authenticated acceptance.
- Stripe: sandbox account, Creator Price `price_1U7nTi9l4G37K6th7Amjpayw`, Designer Price `price_1U7oS19l4G37K6thK4ncrkkA`, and webhook `we_1U7nfP9l4G37K6thc6b6VJYR`.
- Google Drive: `CardForge Connected Storage Preview` OAuth Web client, a branch-only token-encryption key, and the shared Picker key restricted to Google Picker API plus the stable Preview/production origins.
- GitHub: public `pyralisxc/CardForge`; the active `Updates` ruleset protects `main` with PRs, resolved threads, strict `verify`, deletion protection, and force-push protection.

The former reusable QA accounts are retired. Do not recreate them or treat an old browser session as the intended acceptance identity. Verify the signed-in account and environment before testing. The real owner has a separate account in Clerk's development instance; production sign-in does not establish a Preview session.

Google's dedicated Preview OAuth client authorizes the stable Preview origin and its `/api/project-sources/google-drive/callback` redirect. The Google app is in Testing, so the selected Google account must also be an allowed test user. Google limits refresh tokens for this external Testing app's Drive grant to seven days; reconnect through the native flow when required ([OAuth app states](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview)). A disconnected Drive account does not imply that Preview OAuth is unsupported. CardForge Clerk sign-in and Drive consent are separate boundaries; Vercel dashboard authentication is provider administration, not a required tester sign-in. Changing the Google app's publishing status affects its clients and is a separate provider decision.

No password, verification secret, API key, OAuth token, or bypass value belongs in the repository. Use Clerk's provider-defined development testing path and the provider dashboards when a fresh authenticated browser session is required.

### Preview developer plugin acceptance

CardForge has **two plugin products**, with four intended environment-distinct connections:

- Production Studio: `https://cardforges.com/mcp` — public submission/release has its own review gate.
- Production Owner: `https://cardforges.com/mcp/owner` — private, server-authorized Owner only.
- Preview Studio: `https://card-forge-git-vercel-preview-pyralis-projects.vercel.app/mcp` — unpublished developer installation, Staging providers only.
- Preview Owner: `https://card-forge-git-vercel-preview-pyralis-projects.vercel.app/mcp/owner` — unpublished developer installation, server-authorized Owner testing, Staging only.

Developer/private plugin means unpublished distribution through developer settings, not a hidden website or MCP endpoint. Preview is the accessible live testing environment and should mirror Production's user-facing sign-in, consent and role checks with isolated accounts/data.

Preview connections are **a target to verify, not an installed/connected claim**. Confirm the actual endpoint and authority of the existing `CardForge Studio Preview Test` app before trusting its name. If Vercel intercepts requests before Clerk, reconcile the hosting setting with this access contract. Do not add a tunnel, proxy, extra host or separate MCP deployment without a demonstrated unmet requirement. Native browser testing is useful evidence but does not prove persistent plugin connectivity.

For a Work agent, prove signed-out failure, actual environment identity, Studio Free/Contributor scopes, Owner role rejection, staging catalog reads, revision conflicts and one explicitly approved staging-only write/readback before claiming operational parity. Git Main, Production Supabase and public publication are not authorized by this testing gate. Work item #444 owns the connection bridge; Owner #407, Studio public #408 and first-party fonts #377 keep their own domain gates.

Build both unpublished developer variants with `npm run plugin:package:preview`. Outputs are `dist/plugins/cardforge-studio-preview-<canonical-version>.zip` and `dist/plugins/cardforge-owner-preview-<canonical-version>.zip`. The builder reads only the canonical product allowlists, preserves Studio skill bytes and production sources, pins the two stable Preview paths, rejects connection overrides/credentials, and uses deterministic archive metadata. Archives contain one named plugin directory with portable root `plugin.json` and `mcp.json`, canonical Studio skills, and a synchronized legacy Codex overlay. The portable connection uses Streamable HTTP; unpublished listing subtitles fit the host's 30-character limit. Versioning follows the canonical product; do not maintain another Preview source tree. These outputs are preparation artifacts, not an installation receipt. Production package commands and public submission remain separate.

Verify the native access path before claiming installation acceptance:

1. Open the stable Preview without a Vercel session or bypass. Intended public pages must load; sign into the CardForge Clerk Development instance for protected account workflows. The user completes sign-in and consent. A browser cookie does not authorize remote MCP transport.
2. Check both Preview MCP paths and OAuth discovery with the supported MCP client. Require CardForge/Clerk authentication metadata or challenges rather than Vercel HTML/login redirection, then complete Development OAuth consent. Confirm the server's environment and authenticated account.
3. Save each canonical-derived package through the supported developer/private plugin creation flow, without public submission, and connect through user-controlled sign-in/consent. Verify endpoint binding, Staging identity and same-account catalog reads before writes. Reconcile a production-bound app only through an explicit user action.
4. Exercise Studio generation/revision/render/export and available Owner read/refresh/revision-safe operations. Read a small approved Staging write back in the browser, restore temporary Owner values, and prove stale-revision rejection, signed-out challenges, non-Owner/non-Contributor denials and changed-account/reconnect isolation. Public catalogs must not leak private account data. Keep publication, billing and destructive operations within their own gates.

Vercel offers project protection and domain-specific Deployment Protection Exceptions. Inspect current official guidance and the actual account UI before choosing the smallest native setting; a domain exception can retain protection on other URLs but may carry a paid requirement. Do not enable a paid add-on or widen the scope to Production/unrelated deployments without a separate owner decision. Keep protected sourcemaps and server-side CardForge permissions. If a browser confirmation is required, stage the exact change and explain its scope before submission. Roll back a domain exception by removing that exact hostname, then verify the Vercel gate returns; removal does not revoke Clerk grants or undo Staging writes.

Before any merge into `main`, the agent must send Cameron the stable Preview link, the exact candidate SHA, and the specific review scope, then wait for explicit approval. A READY Vercel deployment does not authorize a merge.

Accumulated Preview and release sequence:

1. Implement one coherent objective on a feature branch with focused checks. Remove temporary tests/fixtures unless they protect a durable guarantee.
2. Open a PR targeting `vercel-preview` and require the exact-head GitHub `verify` job (`npm run verify:full`) and other affected checks. Run the full gate locally only for high-risk work or a local/CI discrepancy.
3. Merge the verified feature PR into `vercel-preview`. Preserve ancestry and the integrated Preview history; do not reset/force-move that branch to the feature head.
4. Verify any new staging migrations and affected provider behavior. For a meaningful hosted change, require Vercel Preview READY and the automated `preview-smoke` result for the integrated SHA; exercise only changed signed-in journeys automation cannot prove.
5. Continue accumulating coherent feature PRs until the next product checkpoint is saturated. Do not merge individual feature PRs directly into production or declare a Preview build a production release.
6. Freeze an exact Preview SHA and prepare one Preview-to-`main` release PR. Reconcile the complete delta, any current-`main` divergence, ordered production migrations, and required CI/provider gates against that exact candidate.
7. Send Cameron the stable Preview link, candidate SHA, substantive review scope, and remaining risks. Wait for explicit approval of that candidate; approval is invalidated if Preview changes materially before the release.
8. Apply production migrations before the release merge only when the exact change is additive and current production runtime remains compatible; otherwise sequence the migration and code rollout separately under their owner/provider gate.
9. Merge the approved release PR through GitHub without bypassing `main` safety. Require Vercel Production READY and immediate `production-smoke` for the resulting merge commit; the six-hour `Production health` schedule continues.
10. Apply destructive schema contraction only after compatible production runtime is READY and provider postflight confirms retired records/objects are empty. Split runtime retirement from contraction if the order cannot be guaranteed.
11. Perform the smallest real signed-in production check needed for auth/Owner/Contributor/billing/provider changes.

Cloud Set Mirror retirement is complete. The recorded retirement identified the remaining content as owner-approved test data; migration `20260827063958` required empty mirror rows and Studio lineage before removing the schema. Production postflight confirms the table, lineage columns, and dedicated Storage bucket are absent. Keep the historical release and deletion evidence in Git/provider history; there is no outstanding mirror migration or backup service to restore.

The immutable historical chain still creates the now-retired `cardforge-cloud-set-assets` bucket when provisioning a fresh Supabase project. Provisioning postflight must verify that bucket is empty and delete it through the native Storage API; do not mutate Supabase-owned `storage.*` tables from a database migration.

Rollback application behavior with a forward code fix or existing feature gate. Never delete migrations, ledgers, votes, campaign history, delivery history, or financial records to simulate rollback.

### Preview acceptance and reset

Use clearly named `QA Preview` fixtures and prove only the boundaries affected by the candidate:

1. Signed-out protected routes and MCP fail closed.
2. Free, Creator, and Designer accounts resolve the expected plan and temporary-work/MCP boundary.
3. The active contributor creates and submits one representative asset or campaign package; the owner reviews it through the owning workflow.
4. Preview MCP completes one revision-safe temporary-document or connected-project journey through Clerk OAuth, including one invalid or stale request when that boundary changed.
5. Stripe sandbox webhook delivery returns HTTP 200 and produces one idempotent staging ledger result when billing changed.
6. Supabase migrations, grants/RLS, and relevant advisors pass in the staging project when persistence changed.
7. Google Drive connects through the dedicated Preview OAuth client, returns to the exact initiating Library scope on success/cancel/error with OAuth cookies cleared, creates and reopens one `QA Preview` project, rejects one stale revision, and disconnects without deleting the Drive file when connected storage changed.
8. Stripe Billing Portal returns to the exact initiating Profile utility/query/hash after provider exit; an unsafe external return value falls back to Profile billing.

Reset through the owning product/provider path:

- Cancel, reject, or archive active contributor fixtures through their owning Library/Profile workflow or Profile owner operations so audit history remains truthful; never delete retained proposal history, campaign, vote, billing, or owner-activity rows with ad hoc SQL.
- Remove temporary assistant drafts through Account Library. Browser-local Sets and provider-owned projects remain independent.
- Cancel or change test subscriptions only in Stripe sandbox/Portal; retain CardForge billing ledgers as idempotency evidence.
- Remove temporary assistant drafts through their revision-safe MCP tools or allow the staging retention lifecycle to expire them.
- Preserve existing real account profiles. Re-provisioning the staging project is destructive and requires explicit approval.

### Solo-maintainer branch rule

While `@pyralisxc` is the only trusted code owner, requiring an independent approval would deadlock releases because a PR author cannot approve their own change. Keep resolved review threads, GitHub `verify`, a READY exact-head Vercel Preview, and the relevant live workflow proof mandatory. Require one independent approval when a second trusted reviewer joins.

## Supabase migration and security procedure

Migration files are immutable after creation. Every schema change is a new forward migration.

For a new migration:

1. Compare the live production migration tail and inspect affected tables/functions/RLS/grants.
2. Review failure safety, idempotency, and rollback. Multi-table transitions should be one database transaction/function or have explicit compensation.
3. Apply exactly the reviewed migration once after approval.
4. Verify expected schema/object counts and privileged access; browser roles must not gain service-only access.
5. Run Supabase security/performance advisors and address relevant warnings/errors.
6. Record provider-applied version/evidence in the PR/release record. Never rewrite historical migration files merely to align provider timestamps.

If Supabase Preview reports a remote migration version that is absent from the repository, first verify that its stored name and statements exactly match the immutable repository migration. Repair only the staging migration-ledger version to the repository filename, then let the GitHub integration apply the remaining chain. Do not rerun the already-applied SQL or rename the committed migration.

The runtime and Pipeline importer prefer `SUPABASE_SECRET_KEY` and use server-only auth settings (`persistSession: false`, `autoRefreshToken: false`, `detectSessionInUrl: false`).

## Operator identity

`business-identity` plus the live Supabase singleton own CardForge's canonical operator record. Stripe, Resend, Clerk, Vercel, domain/DNS, GitHub, Search Console, structured data, public copy, and legal publications must agree with that identity.

Changing the operator is a legal/operational migration, not a display edit. Require explicit transfer confirmation and inventory every provider-owned identity/contract before changing it.

## Owner operations

Use Profile > Owner operations for cross-product work through three protected groups: Overview, Growth & People, and Governance. `/owner` only translates historical links and provider callbacks into that Profile tool. Owner composes feature-owned controls; it is not a second persistence/configuration owner.

- Overview > Integrations: provider inventory/readiness without secrets.
- Growth & People: current Clerk accounts plus retained contributor profile/scopes/history.
- Library → Campaigns: strategy, approval, destination connection, scheduling, distribution, and results for campaign packages.
- Public homepage: constrained navigation/SEO/experience settings, canonical public copy, and relevant media publish contextually for a server-confirmed Owner.
- Roadmap: rules and exact item status changes publish from owner-only controls on `/roadmap`; Profile's read-only summary links there instead of rehosting the Roadmap workspace.
- Library → Pipeline: complete shared registry, exact revisions, Contributor withdrawal/retirement, Owner publication/purge authority, Content Health, Forge Review, and Design destination map.
- Governance: append-only owner history and legal/versioned operations.

Deleted provider identities are history, not active users. Retired aliases remain only to display historical attribution accurately.

## Roadmap and voting hygiene

The live `/roadmap` and Supabase `cardforge_roadmap_items` / `cardforge_roadmap_votes` are authoritative.

- Mark a legitimate official capability `shipped` as soon as production has the described behavior. Shipped items remain visible as completed history and keep their votes.
- Use `in_progress` or `testing` only for active unfinished work.
- Do not leave completed features in future months merely because their original target date was later.
- Delete only mistaken/duplicate items when retaining history adds no value.
- User suggestions may be archived by the configured negative-signal rule; normal completed official records should not be deleted just to make the list shorter.
- Provider/ROI checkpoints remain planned until the actual provider plan/capability is verified live; do not infer a paid plan from code alone.

When completing a feature PR, check whether its roadmap row now needs `shipped` status. This keeps the roadmap usable without depending on chat history.

## Analytics privacy checks

Analytics is opt-in and organic-only. GA Enhanced Measurement/advertising signals and PostHog autocapture/session replay/heatmaps/person profiles remain disabled.

After analytics/privacy/domain changes:

- decline consent and verify no GA/PostHog browser collection;
- accept and verify only allow-listed sanitized events/properties;
- verify no private route content, names, emails, or returned identifiers enter analytics;
- verify Search Console remains independent;
- disable browser collection with `NEXT_PUBLIC_CARDFORGE_ANALYTICS_ENABLED=false` for rollback rather than reverting to a replay-capable build.

## Marketing, contributors, and Meta

`CARDFORGE_EXTENDED_CONTRIBUTIONS_ENABLED` and `CARDFORGE_META_PUBLISHING_ENABLED` are independent and default false. Owner approval remains mandatory.

For Pipeline/catalog changes, apply required forward migrations before a bundle that depends on them, run `npm run pipeline:sync-defaults`, verify expected registry destinations/tiers, then deploy. Never restore retired asset categories or deleted/tombstoned assets as rollback.

Before enabling extended contributors, verify protected source storage, approved-only public derivatives, canonical media/attachment relationships, private preview authorization, owner-only approval/provider mutations, current legal publications, and scoped contributor grants.

Before enabling native Meta publishing:

Deploy the `marketing_delivery_approved_revision` migration before application code that reads `approved_campaign_version`. Existing jobs deliberately retain NULL because their historical approval revision cannot be inferred. Review and replace those jobs through an explicit owner flow before enablement; do not backfill them from today's campaign. A claimed job must still match its captured approved campaign version and destination. Finalization is conditional on its live claim token; a lost provider receipt or a failed post-send database write requires reconciliation and must not be retried as a new publication.

1. Verify the reviewed Meta Business app/Login for Business configuration and exact callback URI.
2. Configure only required Page/Instagram publishing scopes and the intended Page/account.
3. Store Meta/encryption/dispatcher secrets server-side with publishing disabled.
4. Connect the intended owned account through Library > Campaigns and verify only safe metadata reaches clients.
5. Configure the scheduled dispatcher secret outside browser-visible configuration.
6. Publish one harmless approved Facebook item, then one Instagram item if used; verify exactly one delivery/provider post mapping each and retry-safe failures.
7. Keep communities/manual destinations manual.

Rollback native provider calls by setting `CARDFORGE_META_PUBLISHING_ENABLED=false`; preserve schedules/history.

## Authenticated production smoke

The former reusable QA accounts were retired. Do not recreate them for generic coverage. For auth, billing, entitlement, provider-domain, owner/contributor, or protected-recovery changes, use the real signed-in owner/contributor account and verify only the affected path.

`npm run smoke:golden` is the compact merge-protected mocked browser lane. `npm run smoke:ui` is the extended browser lane, including scale and soak. Neither proves a real Clerk/Stripe/provider session.

## ChatGPT plugin publication

The packaged integration is `plugins/cardforge-studio`, authored by Cameron Locke, and connects to `https://cardforges.com/mcp`. Public plan names, pricing copy, feature lines, visibility, and MCP capacity targets remain Profile owner-operation content; the plugin must not introduce a parallel tier catalog or access toggle.

`plugins/cardforge-studio/SUBMISSION.md` is the reusable portal listing and review-case source. Keep it aligned with the packaged manifest, live MCP annotations, exact CSP, and current production behavior. Reviewer credentials and the OpenAI challenge token must never be committed.

Assistant draft retention is also controlled by the plan records in Profile owner operations. Defaults are Free 12 hours, Creator 24 hours, and Designer/owner/contributor 48 hours. A document open or update refreshes activity; Account listing does not. Expiration and manual deletion use a 24-hour recoverable trash window.

Production cleanup is owned by Supabase Cron and the `purge-assistant-drafts` Edge Function. Vault must contain `project_url` and an active `publishable_key`; the retention migration generates a separate random `assistant_draft_retention_cron_secret`. Never place the service-role key in Cron SQL. Schedule the function every 15 minutes with `pg_cron` + `pg_net` following Supabase's scheduled-functions pattern. Supabase's `apikey` header identifies the project, while the dedicated `X-CardForge-Cron-Secret` is the function's custom authorization and must be validated before maintenance begins. Verify one scheduled invocation reports `expired`, `claimed`, `purged`, and `failed`, then confirm the Cron job exists by name and the function remains custom-authenticated. Storage objects must be removed through the Storage API before the corresponding row is finalized.

Pipeline revision cleanup uses the separate `purge-pipeline-revisions` function and `pipeline_revision_retention_cron_secret`. Its migration deliberately creates the authorization secret but does not schedule the worker. Before enabling a schedule, deploy it to Staging, create one disposable never-published fixture with an isolated Storage path, let it become purge-eligible, invoke the function with the Vault secret, and prove that the object is removed before the row. Also prove a current registry pointer, a previously published revision, a retention-held revision, and a referenced revision cannot be claimed. Only after that controlled proof may Staging receive a schedule; repeat the exact-head migration and smoke evidence before separately scheduling Production.

For a development-beta release:

1. Complete the normal exact-head Preview and migration sequence, including the private Studio artwork bucket.
2. Verify MCP discovery/OAuth against the real signed-in owner/contributor account and confirm signed-out requests fail closed.
3. In the MCP Inspector, confirm every tool exposes an input schema, output schema, and accurate annotations; confirm `skills/list`, `skills/get`, and each listed `resources/read` digest resolve.
4. Call every tool with one representative request and at least one invalid request, including signed-out/private-data failure paths.
5. Connect the production MCP URL through ChatGPT Developer Mode and exercise Template creation, one-card and bulk copy/artwork upserts, explicit artwork diagnostics, exact-revision Studio handoff, and connected-project list/checkout/commit when that provider boundary changed.
6. Confirm image generation returns standalone artwork to CardForge assembly rather than flattened finished-card images.
7. Submit CardForge Studio as a stable, complete plugin rather than a trial/demo. Capacity figures may remain explicitly labeled current beta planning targets. Until directory publication completes, public site copy may truthfully state that plugin review/availability is still in progress without describing the submitted plugin itself as incomplete.

When OpenAI supplies a domain challenge, set `OPENAI_APPS_CHALLENGE_TOKEN` in the production Vercel environment, redeploy, and confirm `/.well-known/openai-apps-challenge` returns only the exact token as plain text. Remove or rotate the value after verification if OpenAI's current portal guidance permits it.

## Billing reconciliation

Stripe remains authoritative. `product_access` and voluntary `creator_support` are separate purposes; support must never grant product entitlement.

Configure Stripe's Billing Portal to allow an existing Creator or Designer subscriber to switch between the two approved recurring products. Free accounts start hosted Checkout with a server-selected Price; existing subscribers use the Portal so CardForge never creates parallel active subscriptions as an upgrade mechanism. The Portal API route supplies the exact server-sanitized local Profile return to Stripe; never add a client-trusted absolute return URL.

From Owner billing tools, reconcile current subscription state and record `checked`, `repaired`, `unchanged`, `missingClerkUser`, `ledgerCreated`, and `missingLedger`. Require `missingLedger` to be zero and investigate missing Clerk users before manually changing entitlement.

For webhook proof, use **Stripe Workbench -> Webhooks** and resend an existing event when appropriate. Require HTTP 200, durable idempotent processing, one expected ledger/event record, and no unintended entitlement change. Do not alter a real subscription merely to manufacture test evidence.

Safe support rollback disables/removes support checkout configuration while retaining purpose-aware webhook/ledger code. Never deploy an older webhook that cannot distinguish support from product access.

## Maintained commands

- `npm run verify:focused`: discover and run focused tests for the current Git diff or explicit paths; it also runs the changed-file architecture check when an ownership boundary is affected.
- `npm run verify:full`: canonical complete non-browser repository gate for the final candidate and CI.
- `npm run architecture:report`: on-demand dependency-gravity, public-interface, and oversized-file analysis. Normal architecture enforcement is concise.
- `npm run health:production`: canonical non-mutating production route, product, and provider health. Add `-- --category=route`, `catalog`, `product`, or `provider` to isolate a lane. Immediate post-deploy checks use `deployment` for routes plus catalog shape and free starter discovery in both Sets and Pipeline; these checks use native fetch without installing packages. Product health also downloads and validates the official 52-card starter package. Provider health distinguishes an unavailable catalog from an empty collection and verifies Stripe/Clerk readiness and truthful anonymous Drive authentication classification. Publication changes additionally run `supabase/tests/pipeline_publication.sql` inside a rolled-back staging transaction after the candidate migration.
- `npm run smoke:golden`: compact browser merge protection for representative Desk mouse/touch behavior.
- `npm run smoke:hosted`: exact-deployment signed-out smoke for the public entry point, guest Studio opening, and compact-screen navigation; requires `CARDFORGE_E2E_BASE_URL` and the Vercel bypass secret when the deployment is protected.
- `npm run smoke:ui`: extended mocked browser/accessibility, scale, and soak regression.
- `npm run pipeline:sync-defaults`: import missing bootstrap assets into the reviewed Pipeline without overwriting decisions/tombstones.
- `npm run brand:export`: synchronize canonical brand sources and regenerate ignored derivatives.

## Manual release checks

Use only checks relevant to the release:

- changed public workflow on exact Preview at desktop/mobile, then once on merged production;
- apex/`www`/robots/sitemap/canonical/Open Graph/noindex behavior after route/domain/SEO changes;
- one real owner/contributor/account flow after protected changes;
- downloaded PDF/TTS artifact inspection and a real TTS import after export changes;
- customer receipt/reply-to proof after billing/email identity changes;
- Search Console discovery after domain/metadata/route changes.

Do not preserve completed deployment IDs, migration walkthroughs, or one-time cutover diaries in this document.
