# Backend Data Flow

Last updated: May 26, 2026

This document maps CardForge's current server-side data flow. It describes implemented MVP behavior only; payout automation, Stripe Connect, cloud workspaces, and browser-direct Supabase writes are not implemented.

## Server Boundary

CardForge uses Next.js API routes as the write boundary for shared state. Browser UI reads and writes local project state through Zustand/localStorage, then calls API routes only for platform-owned actions such as entitlement checks, shipped library writes, roadmap votes, Founder Beta claims, developer submissions, owner settings, and billing checkout.

Server-only helpers:

- `src/lib/supabaseServer.ts` creates the Supabase service-role client when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured.
- `src/lib/accountEntitlement.ts` resolves free, paid, dev, and owner-implied dev access from Clerk private metadata and server-only allowlists.
- `src/lib/serverProjectAccess.ts` protects shipped template/style writes behind `CARDFORGE_ALLOW_LIBRARY_WRITES=true` plus dev-capable account access when Clerk is configured.
- `src/lib/serverCardforgeUser.ts` resolves the current signed-in server user for owner/developer APIs. It prefers Clerk's full user read, but falls back to the signed session plus `cardforge_developer_profiles` so known QA/developer/owner accounts do not stall when Clerk's full user endpoint is slow.
- `src/lib/serverOwnerAccess.ts` and `src/lib/ownerAccess.ts` resolve owner access from Clerk private metadata or `CARDFORGE_OWNER_ACCOUNT_EMAILS`.
- `src/lib/apiResponses.ts` keeps API responses no-store and returns stable error envelopes.

## API Routes

| Route | Methods | Boundary |
| --- | --- | --- |
| `/api/account/entitlement` | `GET` | Reads Clerk user/private metadata, owner access, and active Founder Beta claims to return the current entitlement snapshot. |
| `/api/assets` | `GET` | Reads published `cardforge_asset_registry` rows for textures, dividers, icons, images, image/overlay source assets, templates, and element presets. No runtime starter-file fallback is used. |
| `/api/billing/checkout` | `POST` | Creates a Stripe Checkout session for a signed-in user when Stripe and Clerk are configured. No webhook entitlement write is implemented yet. |
| `/api/billing/status` | `GET` | Returns safe billing, auth, Supabase, shipped-library-write, and Founder Beta campaign setup status. |
| `/api/developer-assets` | `GET`, `POST`, `PUT`, `PATCH` | Reads the developer program, creates submissions, updates owner program settings, and updates per-developer owner overrides. |
| `/api/developer-assets/upload` | `POST` | Uploads developer source files to the public `cardforge-developer-assets` Supabase Storage bucket after developer/owner access checks. |
| `/api/developer-assets/[submissionId]` | `PATCH`, `PUT` | Allows uploader/owner edits to submission details and owner-only status/access-tier changes. |
| `/api/developer-assets/[submissionId]/vote` | `POST` | Records developer or owner votes and recalculates submission status, score, and tier signal. |
| `/api/founder-beta/claim` | `POST` | Records a Founder Beta claim in Supabase and writes trusted Clerk private metadata for paid beta access. |
| `/api/owner/console` | `GET`, `PUT` | Owner-only route for business settings, site mechanics, legal docs, Founder Beta campaign settings, roadmap item status, integration status, and maintenance metrics. |
| `/api/roadmap` | `GET`, `POST` | Reads the public Chronicle/feature board, creates compact signed-in suggestions, and lets dev accounts create CardForge-authored timeline items. |
| `/api/roadmap/items/[itemId]` | `DELETE` | Lets dev accounts delete/manage CardForge-authored roadmap items. |
| `/api/roadmap/votes` | `POST` | Records one signed-in vote per roadmap item and runs roadmap vote aggregation/archive logic. |
| `/api/styles` | `GET`, `POST`, `DELETE` | Reads and writes pipeline-backed element preset/style rows through `cardforge_asset_registry` and developer submissions. |
| `/api/templates` | `GET`, `POST`, `DELETE` | Reads pipeline-backed default templates plus local user templates. Owner saves for default templates update the pipeline registry/submission row instead of writing shipped files. |

## Supabase Tables

Supabase stores shared platform state only. Current migrations define these CardForge tables and RPCs:

| Table / RPC | Purpose |
| --- | --- |
| `cardforge_roadmap_items` | Public feature suggestions, CardForge-authored Chronicle items, level-up checkpoints, status, ordering, monthly costs, and archive state. |
| `cardforge_roadmap_votes` | One roadmap vote per Clerk user per item. |
| `cardforge_owner_settings` | Business profile, launch settings, site mechanics, integration and maintenance-facing owner settings. |
| `cardforge_site_content_blocks` | Owner-editable known public copy blocks for landing, about, and access pages. This is not a page builder; code owns structure while Supabase owns approved text fields. |
| `cardforge_legal_documents` | Owner-editable trust center content for privacy, terms, refunds, contact/support, developer contributor terms, and creator-pool notices. |
| `cardforge_founder_beta_campaigns` | Founder Beta campaign copy, caps, wave settings, grant mode, and public status. |
| `cardforge_founder_beta_claims` | Signed-in Founder Beta claims, access expiration, and claim status. |
| `cardforge_developer_program_settings` | Developer pipeline thresholds, caps, owner vote weight, self-voting rule, creator-pool planning percentage, and base monthly requirements. |
| `cardforge_developer_profiles` | Developer identity, first/last name, profile status, monthly override rules, creator-pool eligibility flag, and owner note. |
| `cardforge_developer_asset_submissions` | Developer/owner asset submissions, lifecycle status, tier decision, registry pointer, source URLs/storage pointers, and owner notes. |
| `cardforge_developer_asset_votes` | Developer/owner votes for submissions, including owner vote weight. |
| `cardforge_asset_registry` | Published live library metadata for app-visible assets, templates, and element presets. |
| `cardforge_claim_founder_beta` | Service-role RPC that enforces Founder Beta campaign caps and creates/reuses claims. |
| `cardforge_database_metrics` | Service-role RPC for owner console storage/count planning metrics. |

All CardForge Supabase writes go through server routes/helpers using the service-role client. RLS is enabled in migrations, but browser-direct Supabase writes are intentionally outside the MVP.

## Clerk Entitlement Inputs

Trusted account inputs are server-side:

- `cardforgeAccess` in Clerk private metadata: `free`, `paid`, or `dev`.
- `cardforgeAccessExpiresAt` in Clerk private metadata for expiring paid beta access.
- `cardforgeRole: "owner"` in Clerk private metadata for owner access.
- `CARDFORGE_PAID_ACCOUNT_EMAILS`, `CARDFORGE_DEV_ACCOUNT_EMAILS`, and `CARDFORGE_OWNER_ACCOUNT_EMAILS` as server-only allowlists.
- Active `cardforge_founder_beta_claims` rows can temporarily upgrade an account response and `/api/founder-beta/claim` persists trusted paid beta metadata.

Public Clerk metadata is not trusted for paid/dev/owner unlocks.

## Developer Asset Pipeline Writes

Developer pipeline writes are centered on `src/lib/developerAssetStore.ts` and pure rules in `src/lib/developerAssets.ts`.

Implemented writes:

- Developer/owner profile sync upserts `cardforge_developer_profiles` with Clerk id, email, first name, and last name.
- Developer submissions insert into `cardforge_developer_asset_submissions`.
- Developer source uploads write binary files to Supabase Storage bucket `cardforge-developer-assets`, then submission rows store public URL, bucket, path, size, and MIME type.
- Votes upsert into `cardforge_developer_asset_votes`, then recalculate quality score, lifecycle status, and access-tier decision.
- Vote requests check the self-voting policy before profile sync, so blocked self-votes fail quickly and do not perform unnecessary writes.
- Owner settings update `cardforge_developer_program_settings`.
- Owner per-account overrides update `cardforge_developer_profiles`.
- Owner publish/status changes update submission rows and upsert/remove published rows in `cardforge_asset_registry`.
- Starter defaults are Cameron-owned pipeline submissions. Use `npm run pipeline:sync-defaults` to import repo starter material into Supabase Storage, `cardforge_asset_registry`, and linked submission rows.
- Default template/style saves through `/api/templates` and `/api/styles` sync registry-backed payloads when shipped-library writes are enabled.

Pipeline lifecycle terms are `draft`, `submitted`, `voting`, `publish_candidate`, `published`, `archived`, and `rejected`. Access tier is separate: `free` and `paid` are the only creator-facing published tiers, while internal `developer` and `hidden` values mean pipeline-only or not-live inventory.

Developer contribution records are durable history. Deleting or disabling a Clerk account must not delete developer submissions, votes, published registry rows, or source-file references. The pipeline stores contributor ids/emails as snapshots instead of foreign keys to live account rows; if a developer leaves, mark the profile inactive/suspended or let the Clerk account disappear while preserving the contribution ledger.

The future creator pool is planning copy only. The current default policy is 10% of eligible profit split evenly among eligible active developers after payout systems, tax/legal terms, refund handling, Stripe Connect, and billing webhooks are implemented.

## Local-First Boundaries

These remain browser/project-local in the MVP:

- User-authored templates and generated cards in Zustand persistence.
- Local uploaded textures, dividers, icons, images, and project assets.
- Single and bulk generator input/output data.
- Export settings, paper settings, active tabs, and editor UI state.
- Downloaded project files used for portability between devices.

Repo starter files under `data/default-templates`, `data/styles`, `public/card-assets`, and `data/assets` are import material only. Runtime library APIs must not silently repopulate user-facing creative content from those folders. Normal users can still edit locally, but that does not mutate the deployed site library or database registry.

## Verification

Backend/data-flow changes should use the smallest relevant check first, then broaden before handoff:

```bash
npm run lint
npm run typecheck
npm test -- --run
npm run build
git diff --check
```

For live shared-state behavior, run the authenticated smoke when reusable QA accounts are configured:

```bash
npx playwright test tests/smoke/auth-account.spec.ts --project=chromium
```
