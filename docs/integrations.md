# CardForge Integration Ownership

Last reviewed: August 19, 2026

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
2. `src/features/studio-documents/server/mcpAgentTemplateTools.ts` and `mcpToolInputSchemas.ts` — focused agent-tool behavior and contracts.
3. `src/features/studio-documents/` and `src/features/project/` — the same native document/template authority used by Studio.
4. `src/features/mcp-usage/` — privacy-minimized usage observation, plan targets, and account/owner presentation.

**CardForge owns:** tool semantics, Studio-document authorization, production-plan policy, and native Template validation. `preview_template_draft` shows the native exported Template PNG in chat and keeps the exact revision-bound Studio URL as a separate handoff. MCP does not get a second renderer, template format, asset store, or publication authority.

Supabase keeps daily MCP totals per account and tool—calls, success/failure, successful assisted actions, payload byte counts, and duration—but never stores prompts, card content, or document payloads in the usage table. The Owner Console is the source of truth for each plan’s public name, description, feature lines, action label, visibility, and capacity targets. Signed-out visitors never receive MCP access; every signed-in Free, Creator Pass, or Designer account receives the shared Studio assistant scope, while approved developers and the owner retain their separately validated developer scopes. Numeric action/storage targets remain observation-only: they do not block, bill overages, or grant entitlements. Business Solutions is always routed to a private inquiry rather than self-serve checkout.

## Vercel and Next.js — deployment and application runtime

**Providers/framework own:** Next routing/build behavior and Vercel deployments, Preview/Production environments, system deployment URLs, and environment variables.

**Start here:** `src/app/`, `src/proxy.ts`, `next.config.ts`, `.github/workflows/`, and `docs/operations.md`.

**CardForge owns:** the canonical public URL policy in `src/infrastructure/http/publicUrl.ts`, deployment gates, and which live provider settings are required. `VERCEL_PROJECT_PRODUCTION_URL` and `VERCEL_URL` are consumed as Vercel-provided facts rather than duplicated deployment records.

## Browser workspace — Zustand and IndexedDB

**Framework/browser own:** Zustand state/persist middleware and the browser IndexedDB/quota APIs.

**Start here:**

1. `src/features/project/store/workspaceStore.ts` — Zustand slices and the persisted workspace contract.
2. `src/features/project/persistence/projectPersistenceScope.ts` — account/guest/local namespaces and corruption quarantine.
3. `src/features/project/persistence/indexedDbStorage.ts` — the `StateStorage` adapter, recovery snapshot, save status, quota health, and local-art optimization.

**CardForge owns:** account-scoped namespace selection, project recovery, asset bounds, and export/import portability. Those are product requirements that generic Zustand persistence does not define. CardForge intentionally does not invent cloud project sync until that becomes a product decision.

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
