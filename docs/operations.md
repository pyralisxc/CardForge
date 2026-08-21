# CardForge Operations

Last updated: August 21, 2026

This is the current runbook for `https://cardforges.com`. It contains only procedures that remain operationally useful. Completed rollout/cutover instructions belong in Git/provider history.

## Production topology

- Vercel deploys `main`; `NEXT_PUBLIC_APP_URL=https://cardforges.com` is canonical.
- `www.cardforges.com` redirects to the apex domain.
- Clerk owns authentication and trusted private account metadata.
- Stripe owns Creator Pass, Designer Pass, support checkout, customers, subscriptions, webhooks, and Billing Portal.
- Supabase owns shared product state, private temporary ChatGPT Studio documents and their normalized artwork, cloud-set backups, and managed public/protected media; ordinary browser projects remain local.
- Resend owns transactional email delivery.
- GA4, PostHog, and Search Console own analytics/search records.
- Meta owns Facebook/Instagram authorization and provider posts; CardForge owns marketing approval/scheduling/delivery history.

Secrets stay in Vercel or their owning provider. The Owner Console may report readiness/identifiers but never raw credentials.

## Required environment groups

Use `.env.example` as the complete catalog.

- Core: `NEXT_PUBLIC_APP_URL`, Clerk keys, `SUPABASE_URL`, and `SUPABASE_SECRET_KEY`. `SUPABASE_SERVICE_ROLE_KEY` is a temporary compatibility fallback only.
- Billing: Stripe secret/webhook keys, Creator Pass and Designer Pass Prices, support Prices/currency/portal configuration.
- Email: `RESEND_API_KEY`, `CARDFORGE_EMAIL_FROM`, `CARDFORGE_EMAIL_REPLY_TO`.
- Access: one canonical `CARDFORGE_OWNER_ACCOUNT_EMAILS` identity plus developer/paid allowlists where still intentionally used.
- Analytics: public enable/measurement values plus server-only GA/Search Console/PostHog reporting credentials.
- Social: Meta app/configuration/Graph version, token-encryption key, dispatch secret, and publishing flag.
- OpenAI plugin verification: `OPENAI_APPS_CHALLENGE_TOKEN` only while OpenAI is verifying the production domain.

## Development and release cadence

GitHub is the source/CI workspace. Vercel Preview is hosted integration proof, not a compile loop. Batch related work into coherent commits and avoid no-op/test-only pushes merely to retrigger provider status.

Release sequence:

1. Implement with focused checks and remove temporary development-only tests/fixtures unless they protect a durable boundary.
2. Run `npm run lint`, `npm run typecheck`, `npm run architecture:check`, `npm run migrations:check`, `npm run test`, and `npm run build` on the final candidate.
3. Require GitHub `verify` and a READY Vercel Preview on that exact head.
4. Exercise changed public/browser behavior on Preview. Provider-backed signed-in behavior must be checked with the real production owner/developer account when affected.
5. Apply production migrations only after explicit approval of the exact additive change and its postflight.
6. Merge through the PR; do not bypass `main` safety.
7. Require Vercel Production READY for the merge commit and run `npm run health:production`.
8. Perform the smallest real signed-in production check needed for auth/owner/developer/billing/provider changes.

Rollback application behavior with a forward code fix or existing feature gate. Never delete migrations, ledgers, votes, campaign history, delivery history, or financial records to simulate rollback.

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

The runtime and Pipeline importer prefer `SUPABASE_SECRET_KEY` and use server-only auth settings (`persistSession: false`, `autoRefreshToken: false`, `detectSessionInUrl: false`).

## Operator identity

`business-identity` plus the live Supabase singleton own CardForge's canonical operator record. Stripe, Resend, Clerk, Vercel, domain/DNS, GitHub, Search Console, structured data, public copy, and legal publications must agree with that identity.

Changing the operator is a legal/operational migration, not a display edit. Require explicit transfer confirmation and inventory every provider-owned identity/contract before changing it.

## Owner Console

Use `/owner` through six workspaces: Overview, Marketing, Growth & People, Site Controls, Studio Library, and Governance. Owner composes feature-owned controls; it is not a second persistence/configuration owner.

- Overview > Integrations: provider inventory/readiness without secrets.
- Growth & People: current Clerk accounts plus retained developer profile/scopes/history.
- Site Controls: constrained public copy/navigation/SEO/media/experience settings.
- Studio Library: complete shared registry, Forge Review, and Studio destination map.
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

Before enabling extended contributors, verify protected source storage, approved-only public derivatives, canonical media/attachment relationships, private preview authorization, owner-only approval/provider mutations, current legal publications, and scoped developer grants.

Before enabling native Meta publishing:

1. Verify the reviewed Meta Business app/Login for Business configuration and exact callback URI.
2. Configure only required Page/Instagram publishing scopes and the intended Page/account.
3. Store Meta/encryption/dispatcher secrets server-side with publishing disabled.
4. Connect the intended owned account through Owner > Marketing > Distribution and verify only safe metadata reaches clients.
5. Configure the scheduled dispatcher secret outside browser-visible configuration.
6. Publish one harmless approved Facebook item, then one Instagram item if used; verify exactly one delivery/provider post mapping each and retry-safe failures.
7. Keep communities/manual destinations manual.

Rollback native provider calls by setting `CARDFORGE_META_PUBLISHING_ENABLED=false`; preserve schedules/history.

## Authenticated production smoke

The former reusable QA accounts were retired. Do not recreate them for generic coverage. For auth, billing, entitlement, provider-domain, owner/developer, or protected-recovery changes, use the real signed-in owner/developer account and verify only the affected path.

`npm run smoke:ui` is focused mocked browser regression coverage; it does not prove a real Clerk/Stripe/provider session.

## ChatGPT development beta

The packaged integration is `plugins/cardforge-studio`, authored by Cameron Locke, and connects to `https://cardforges.com/mcp`. Public plan names, pricing copy, feature lines, visibility, and MCP capacity targets remain Owner Console content; the plugin must not introduce a parallel tier catalog or access toggle.

`plugins/cardforge-studio/SUBMISSION.md` is the reusable portal listing and review-case source. Keep it aligned with the packaged manifest, live MCP annotations, exact CSP, and current production behavior. Reviewer credentials and the OpenAI challenge token must never be committed.

Assistant draft retention is also controlled by the plan records in Owner Console. Defaults are Free 12 hours, Creator 24 hours, and Designer/owner/developer 48 hours. A document open or update refreshes activity; Account listing does not. Expiration and manual deletion use a 24-hour recoverable trash window.

Production cleanup is owned by Supabase Cron and the `purge-assistant-drafts` Edge Function. Vault must contain `project_url` and an active `publishable_key`; the retention migration generates a separate random `assistant_draft_retention_cron_secret`. Never place the service-role key in Cron SQL. Schedule the function every 15 minutes with `pg_cron` + `pg_net` following Supabase's scheduled-functions pattern. Supabase's `apikey` header identifies the project, while the dedicated `X-CardForge-Cron-Secret` is the function's custom authorization and must be validated before maintenance begins. Verify one scheduled invocation reports `expired`, `claimed`, `purged`, and `failed`, then confirm the Cron job exists by name and the function remains custom-authenticated. Storage objects must be removed through the Storage API before the corresponding row is finalized.

For a development-beta release:

1. Complete the normal exact-head Preview and migration sequence, including the private Studio artwork bucket.
2. Verify MCP discovery/OAuth against the real signed-in owner/developer account and confirm signed-out requests fail closed.
3. In the MCP Inspector, confirm every tool exposes an input schema, output schema, and accurate annotations; confirm `skills/list`, `skills/get`, and each listed `resources/read` digest resolve.
4. Call every tool with one representative request and at least one invalid request, including signed-out/private-data failure paths.
5. Connect the production MCP URL through ChatGPT Developer Mode and exercise Template creation, one-card and bulk copy/artwork upserts, explicit artwork diagnostics, exact-revision Studio handoff, and cloud-set list/read.
6. Confirm image generation returns standalone artwork to CardForge assembly rather than flattened finished-card images.
7. Keep the public surface labeled development beta until OpenAI review accepts the submitted version.

When OpenAI supplies a domain challenge, set `OPENAI_APPS_CHALLENGE_TOKEN` in the production Vercel environment, redeploy, and confirm `/.well-known/openai-apps-challenge` returns only the exact token as plain text. Remove or rotate the value after verification if OpenAI's current portal guidance permits it.

## Billing reconciliation

Stripe remains authoritative. `product_access` and voluntary `creator_support` are separate purposes; support must never grant product entitlement.

Configure Stripe's Billing Portal to allow an existing Creator or Designer subscriber to switch between the two approved recurring products. Free accounts start hosted Checkout with a server-selected Price; existing subscribers use the Portal so CardForge never creates parallel active subscriptions as an upgrade mechanism.

From Owner billing tools, reconcile current subscription state and record `checked`, `repaired`, `unchanged`, `missingClerkUser`, `ledgerCreated`, and `missingLedger`. Require `missingLedger` to be zero and investigate missing Clerk users before manually changing entitlement.

For webhook proof, use **Stripe Workbench -> Webhooks** and resend an existing event when appropriate. Require HTTP 200, durable idempotent processing, one expected ledger/event record, and no unintended entitlement change. Do not alter a real subscription merely to manufacture test evidence.

Safe support rollback disables/removes support checkout configuration while retaining purpose-aware webhook/ledger code. Never deploy an older webhook that cannot distinguish support from product access.

## Maintained commands

- `npm run health:production`: canonical production health.
- `npm run smoke:ui`: focused mocked browser/accessibility regression.
- `npm run pipeline:sync-defaults`: import missing bootstrap assets into the reviewed Pipeline without overwriting decisions/tombstones.
- `npm run brand:export`: synchronize canonical brand sources and regenerate ignored derivatives.

## Manual release checks

Use only checks relevant to the release:

- changed public workflow on exact Preview at desktop/mobile, then once on merged production;
- apex/`www`/robots/sitemap/canonical/Open Graph/noindex behavior after route/domain/SEO changes;
- one real owner/developer/account flow after protected changes;
- downloaded PDF/TTS artifact inspection and a real TTS import after export changes;
- customer receipt/reply-to proof after billing/email identity changes;
- Search Console discovery after domain/metadata/route changes.

Do not preserve completed deployment IDs, migration walkthroughs, or one-time cutover diaries in this document.
