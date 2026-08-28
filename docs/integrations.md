# CardForge Integration Ownership

Last reviewed: August 26, 2026

This is the human trace map for CardForge's external integrations. It answers two questions: **which system owns this lifecycle?** and **where do I start reading the CardForge code?**

The governing rule is native-first and minimum-ownership: use the provider/framework's supported lifecycle directly, and let CardForge own only CardForge-specific policy or the smallest bridge between two providers. A provider integration should not gain a second cache, session store, redirect protocol, retry system, delivery ledger, or abstraction merely for flexibility.

## Clerk — identity and browser sessions

**Provider owns:** session cookies, OAuth/social sign-in, sign-in/sign-up UI, request authentication, current-user identity, and Backend API user records.

**Start here:**

1. `src/app/layout.tsx` — the single root `ClerkProvider`.
2. `src/proxy.ts` -> `src/infrastructure/auth/middleware.ts` — the one broad Next request boundary and Clerk middleware, including `authorizedParties`.
3. `src/app/sign-in/[[...sign-in]]/page.tsx` and `src/app/sign-up/[[...sign-up]]/page.tsx` — Clerk's native components on CardForge routes.
4. `src/features/account/lib/serverCardforgeUser.ts` — one `currentUser()` read for the current account; `clerkClient()` only for an explicit user id or metadata mutation.

**CardForge owns:** same-site return-path sanitization and the access policy layered over Clerk identity: free, Creator Pass, Designer Pass, developer, and owner. CardForge does not own a parallel session or sign-in lifecycle.

## Supabase — shared platform state

**Provider owns:** Postgres, Storage, database transactions/RPCs, and service authentication.

**Start here:**

1. `src/infrastructure/database/supabaseServer.ts` — the only app-side Supabase client factory. Prefer `SUPABASE_SECRET_KEY`; the legacy service-role variable is a deploy-safe transition only.
2. Feature `server.ts` entry points — product-specific reads and commands.
3. `supabase/migrations/` — schema, constraints, functions, triggers, and grants.

**CardForge owns:** the application schema, feature stores, lifecycle rules, and the decision to keep browser writes out of Supabase. There is no browser-direct Supabase client and no second shared catalog outside `cardforge_asset_registry`.

Production uses the Supabase project `Card Forge` (`mpmmhjjhdxjedbmuctiv`). Preview uses the separately named staging project documented below. Destructive inventory or cleanup must identify the project by both name and ref; a clean staging result is never evidence that production is empty.

Forge Review source files and private Studio-document media use server-issued, short-lived signed Storage URLs or server-owned Storage operations so large bytes avoid Vercel request-body bottlenecks. Template revision media is normalized server-side to content-addressed WebP in the public developer-assets bucket; `cardforge_pipeline_template_assets` records the binary owner and the immutable submission revision holds hash references. The registry's durable role is limited to the active revision pointer plus routing/discovery metadata, and its schema rejects cloned Template documents. The browser receives no general Supabase database authority: CardForge routes still authenticate the user, choose the owned object path, enforce product policy, and verify the stored object before committing shared records.

## Stripe — checkout, subscriptions, and billing portal

**Provider owns:** hosted Checkout, payment methods, subscription/customer state, the Billing Portal, and webhook delivery.

**Start here:**

1. `src/app/api/billing/checkout/route.ts` and `src/app/api/billing/portal/route.ts` — thin HTTP composition around Stripe-hosted sessions.
2. `src/features/billing/lib/billing.ts` and `billingPurpose.ts` — CardForge offering configuration and the mapping from Stripe objects to CardForge product purpose.
3. `src/features/billing/server/processStripeWebhook.ts` — verified webhook ingress and current-subscription reconciliation.
4. `src/features/billing/server/reconcileBillingState.ts` — owner recovery/reconciliation when provider mappings drift.

**CardForge owns:** projecting eligible Creator Pass and Designer Pass subscriptions into paid CardForge access plus a trusted plan marker stored with the Clerk account, and a durable billing event ledger so cross-provider writes are idempotent and auditable. The server chooses configured Stripe Price IDs; clients choose only the named offering. Designer Pass does not imply contributor access. This bridge is necessary because Stripe owns payment state while Clerk/CardForge own application access. Creator-support payments are deliberately classified separately and never grant product access.

## Resend — transactional email

**Provider owns:** message delivery, retry-safe idempotency semantics, and email API records.

**Start here:** `src/features/contact/lib/emailOperations.ts` for the direct `POST /emails` adapter and `src/features/contact/server/contactRequestStore.ts` for CardForge's support-request history.

**CardForge owns:** contact validation, support/developer routing, message copy, and its own request history. Direct use of Resend's documented HTTP API is intentional; an extra SDK wrapper would not remove CardForge responsibility or simplify this path.

## Meta — Facebook and Instagram authorization/publication

**Provider owns:** Facebook Login for Business, Graph API tokens/accounts, Page and Instagram identities, media containers, and provider posts.

**Start here:**

1. `src/features/marketing-distribution/server/metaConnection.ts` — OAuth/configuration, account discovery, and encrypted connection persistence.
2. `src/features/social-publishing/server/metaPublisher.ts` — stateless Graph API protocol adapter.
3. `src/features/marketing-distribution/` — CardForge approval-bound scheduling, retries, destinations, and delivery history.

**CardForge owns:** which approved content may be sent, destination policy, encrypted-at-rest connection storage, scheduling, idempotent dispatch, retries, and publication history. Those are application workflow facts that Meta does not own. Automatic publishing remains hard-disabled until the live provider proof in `docs/operations.md` passes.

## Analytics — GA4, PostHog, and Search Console

**Providers own:** raw acquisition/search/product-event records and their reporting APIs.

**Start here:** `src/features/analytics/`.

**CardForge owns:** explicit-consent presentation, the allow-listed product event vocabulary, organic UTM conventions, privacy-minimized client initialization, and the owner-only composition of provider reports. CardForge does not mirror raw analytics into Supabase.

## MCP — agent access to CardForge Studio

**Protocol/auth owners:** MCP owns the tool/resource protocol; Clerk owns OAuth token verification and linked account identity.

**Start here:**

1. `src/app/mcp/route.ts` — HTTP/MCP composition and top-level tool registration.
2. `src/features/studio-documents/server/mcpAgentTemplateTools.ts`, `mcpAgentCardTools.ts`, `mcpToolOutputSchemas.ts`, and `mcpPluginSkills.ts` — focused agent-tool behavior, explicit structured outputs, and submission-time skill discovery.
3. `src/features/studio-documents/` and `src/features/project/` — the same native document/template authority used by Studio.
4. `src/features/mcp-usage/` — privacy-minimized usage observation, plan targets, and account/owner presentation.

**CardForge owns:** tool semantics, Studio-document authorization, production-plan policy, and native Template validation. `preview_template_draft` shows the native exported Template PNG in chat and keeps the exact revision-bound Studio URL as a separate handoff. MCP does not get a second renderer, template format, asset store, or publication authority.

Every published tool declares an explicit output schema matching its `structuredContent`. The MCP skills extension exposes the two packaged `SKILL.md` files directly from `plugins/cardforge-studio`; their UTF-8 content and SHA-256 digests are the submission-time source of truth rather than a copied server prompt.

Card copy and per-card artwork share the native `upsert_card` / `upsert_cards` transaction. Artwork uses an exact image field from the current generation contract and arrives as either a generated/uploaded public HTTPS source or bounded raw base64. CardForge pins each validated public DNS result for the HTTPS request, caps one write at 64 artwork files and 32 MB of aggregate input, and processes normalization without unbounded fan-out. It stores a private content-addressed WebP in the Studio-document asset bucket and leaves only a stable reference in the document JSON; failed uploads and revision conflicts reconcile newly created objects against the persisted document so they do not become billable orphans. The Studio document API issues short-lived signed URLs and the browser rehydrates those references before applying the normal local project import. `preview_card_set` reports private resolution, renderable references, unresolved values, Template fallback, and placeholders separately.

`list_connected_projects`, `checkout_project`, and `commit_project` expose only provider files the linked account explicitly authorized. Checkout creates a temporary private Studio document; commit requires exact provider, CardForge project, and working-document revisions. Browser-only and local-folder projects remain invisible to the remote connector unless the user explicitly hands them into a reachable workflow.

Supabase keeps daily MCP totals per account and tool—calls, success/failure, successful assisted actions, payload byte counts, and duration—but never stores prompts, card content, or document payloads in the usage table. The Owner Console is the source of truth for each plan’s public name, description, feature lines, action label, visibility, capacity targets, and assistant-draft inactivity window. Signed-out visitors never receive MCP access; every signed-in Free, Creator Pass, or Designer account receives the shared Studio assistant scope, while approved developers and the owner retain their separately validated developer scopes. Numeric action/storage targets remain observation-only: they do not block, bill overages, or grant entitlements. Business Solutions is always routed to a private inquiry rather than self-serve checkout.

Assistant-draft cleanup uses the provider-native Supabase path: `pg_cron` invokes the custom-authenticated `purge-assistant-drafts` Edge Function through `pg_net`, with the project URL, publishable key, and a dedicated random maintenance secret stored in Vault. The publishable key is sent through Supabase's native `apikey` header; the function requires the private maintenance secret before using its built-in service role to expire inactive rows, claim retry-safe purge work, delete artwork through the Storage API, and finalize the row. Browser roles cannot call the retention functions, authorize maintenance, or read the private bucket.

## Vercel and Next.js — deployment and application runtime

**Providers/framework own:** Next routing/build behavior and Vercel deployments, Preview/Production environments, system deployment URLs, and environment variables.

**Start here:** `src/app/`, `src/proxy.ts`, `next.config.ts`, `.github/workflows/`, and `docs/operations.md`.

**CardForge owns:** the canonical public URL policy in `src/infrastructure/http/publicUrl.ts`, deployment gates, and which live provider settings are required. `VERCEL_PROJECT_PRODUCTION_URL` and `VERCEL_URL` are consumed as Vercel-provided facts rather than duplicated deployment records.

### Preview environment boundary

Vercel's branch-specific Preview deployment is CardForge's hosted staging surface. The reusable `vercel-preview` branch points to one exact PR candidate and owns the stable review URL `https://card-forge-git-vercel-preview-pyralis-projects.vercel.app`. Ordinary branches remain deployment-disabled; GitHub CI proves code health before the candidate ref moves.

Preview uses provider-native isolation rather than CardForge emulation:

- Vercel branch-scoped variables select the Clerk development instance, Stripe sandbox, and the separate Supabase project `Card Forge Staging` (`mjdugheniazuiqoefnnb`).
- Supabase's GitHub integration applies repository migrations from `vercel-preview` to that staging project. CardForge does not maintain a second migration runner or schema ledger.
- Stripe's sandbox products and webhook endpoint exercise the same Checkout/webhook code without touching production subscriptions. The Vercel protection-bypass value remains provider-managed and must never appear in Git or logs.
- Google Drive uses a dedicated Preview OAuth Web client and token-encryption key. The shared Picker key permits only the stable Preview and production origins and remains restricted to Google Picker API; ordinary feature-deployment hosts are not authorized.
- Google Picker remains the native browser selection surface. Project-folder selection opens at My Drive so the user can authorize a destination; the current CardForge folder is displayed as account storage state rather than used as an empty Picker parent. Google Drive Set packages and explicitly indexed assets feed the account Library read model while Drive remains authoritative for their bytes, revisions, links, and permissions. CardForge writes `cardforgeWorkId` as private app metadata so the same Set can be pooled with its device/folder copies; provider updates preserve that identity and still require the exact Drive and package revisions previously read.
- The production CardForge Studio plugin remains pointed at `https://cardforges.com/mcp`. Preview MCP verification uses the stable Preview `/mcp` URL through a temporary developer/Inspector connection; it does not fork the plugin manifest or create alternate auth semantics.

The only CardForge-owned bridge is release policy: mirror the exact candidate to `vercel-preview`, verify the hosted user stories, send Cameron the stable link and SHA, and wait for explicit approval before merging to `main`.

## Browser workspace — Zustand and IndexedDB

**Framework/browser own:** Zustand state/persist middleware and the browser IndexedDB/quota APIs.

**Start here:**

1. `src/features/project/store/workspaceStore.ts` — Zustand slices and the persisted workspace contract.
2. `src/features/project/persistence/projectPersistenceScope.ts` — account/guest/local namespaces and corruption quarantine.
3. `src/features/project/persistence/indexedDbStorage.ts` — the `StateStorage` adapter, recovery snapshot, save status, quota health, and local-art optimization.
4. `src/features/project/persistence/contentAddressedBrowserAssets.ts` — SHA-256 Blob ownership plus runtime hydration for workspace and local-asset JSON.

**CardForge owns:** account-scoped namespace selection, project recovery, content-addressed Blob references, asset bounds, export/import portability, the default destination preference, and the copy-before-delete transfer commitment. Base64 remains valid only at transient file/import/render boundaries; browser persistence stores one Blob per content hash and hydrates ordinary data URLs only for the existing runtime contract. Those are product requirements that generic Zustand persistence does not define. CardForge intentionally does not invent a universal provider-sync layer; each supported provider earns a narrow native adapter and explicit capability contract. Google Drive uses native resumable upload and provider revisions; local folders use the browser File System Access lifecycle and read-back verification. Provider-to-provider transfer is offered only where those owners can be composed safely.

Browser capacity is not a CardForge allowance. The UI may show device usage in the storage/account lens, but normal local creation is not proactively gated by an estimated browser quota. Actual rejected writes, corrupt reads, and unsafe individual files remain explicit failures.

## Human journey traces

When reading a workflow, start at the route/surface and follow the named owner rather than searching the whole repository:

- **Sign in / account access:** `app/sign-in` -> Clerk -> `features/account` -> Domain entitlement policy.
- **Studio local project:** `app/studio` -> `features/app-shell` -> `features/project` -> Template Editor / Generator.
- **Agent-created Template:** `app/mcp` -> `features/studio-documents` -> canonical Project document -> Studio install -> normal Template library.
- **Shared Template publication:** Template Editor -> `developer-assets` / Forge Review -> `cardforge_asset_registry` -> Studio catalog.
- **Creator Pass:** billing checkout route -> Stripe -> signed webhook -> billing purpose -> Clerk private metadata -> account entitlement.
- **Business Solutions:** owner-authored plan invitation -> business contact request -> Resend -> Owner Inbox. No enterprise entitlement or self-serve checkout is created.
- **Campaign publication:** Owner Marketing -> `marketing-content` approval -> `marketing-distribution` job -> stateless `social-publishing` provider adapter.
- **Contact request:** contact route -> `contact` validation/store -> Resend API -> Owner Inbox.

If one of these journeys starts requiring an unrelated owner or a new parallel lifecycle, stop and re-evaluate the native owner before extending it.
