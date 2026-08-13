# CardForge

CardForge helps creators turn card ideas into full, export-ready sets. The Studio combines reusable front and back layouts, independent two-face card data, structured bulk generation, and clean PNG, ZIP, PDF, or Tabletop Simulator exports, while approved developers help shape the shared library that powers the product. The fantasy forge is the doorway; underneath is a serious production workflow for creators building real card systems. User project work stays in browser storage or downloaded project files for the current launch.

CardForge Studio is a software product created and operated by Cameron Locke, an independent sole proprietor based in Oregon.

## Live State

- Public site: `/`
- Product story and access explanation: `/` and `/about`
- Founder identity and voluntary support: `/cameron` and its `#support` section
- Studio: `/studio`
- Account and Creator Pass status: `/account`
- Profile management: `/profile`
- Public roadmap and feature voting: `/roadmap`
- Developer application: `/developer`
- Protected contribution cockpit: `/developer/cockpit`
- Contact and versioned trust documents: `/contact`, `/privacy`, `/terms`, `/refund`, `/creator-pass-terms`, `/supporter-terms`, `/developer-terms`, `/accessibility`
- Owner console: `/owner`

The current product is in controlled public beta and first-customer operation on [cardforges.com](https://cardforges.com).

## Quick Start

Requirements:

- Node.js 22 or newer
- npm

```bash
npm install
npm run dev
```

Open [http://localhost:9002](http://localhost:9002).

If the visible local site looks stale, stop any old server on port `9002` and restart `npm run dev`. Playwright smoke tests also use `localhost:9002`, so avoid running multiple dev/prod servers against the same checkout.

## Core Commands

```bash
npm run dev        # Next dev server on http://localhost:9002
npm run build      # Production build
npm run lint       # ESLint
npm run typecheck  # next typegen + TypeScript no-emit check
npm run test       # Vitest unit suite
npm run test:watch # Vitest watch mode
npm run migrations:check # Reject edits to existing Supabase migrations
npm run smoke           # Lean public Playwright release gate
npm run smoke:protected # Protected auth/access/recovery suite (configured QA environment only)
```

Maintained operational commands:

```bash
npm run health:production                # Five-route production health check
npm run qa:bootstrap-authenticated-smoke # Align the four protected Clerk QA identities
npm run pipeline:sync-defaults            # Seed repo-owned starter assets into the reviewed pipeline
```

## Source Map

- `src/app/`: Next.js routes and API routes.
- `src/domain/`: pure Cards, Templates, Rendering, and Entitlements policy.
- `src/features/app-shell/`: Studio shell, workspace bootstrap, and route-level composition.
- `src/features/template-editor/`: Layout Studio panels, inspector tools, canvas commands, and editor controller hooks.
- `src/features/card-generator/`: One-card and list-based creation, card review, editing, sharing, downloads, and print/export settings.
- `src/features/card-rendering/`: Shared card preview, rich-text, vector-shape, thumbnail, appearance, and watermark presentation.
- `src/features/project/`: Local project files, project asset persistence, and project access rules.
- `src/features/billing/`: Stripe checkout, subscription, portal, and billing config helpers.
- `src/features/account/`: Account overview, entitlement, roadmap panels, profile surface, and user access helpers.
- `src/features/business-identity/`: canonical operator identity, owner editing, and server-owned Supabase persistence.
- `src/features/public-site/`: owner-editable marketing/sharing/founder content, shared public navigation, public social/share controls, tagged public caching, portrait processing, and structured search identity.
- `src/features/legal/`: immutable versioned legal publication, constrained document rendering, and public legal caching.
- `src/features/developer-access/`: the single owner of developer identity, profile status, contribution grants, and every runtime access to the `cardforge_developer_profiles` persistence boundary.
- `src/features/developer-assets/`: Developer Asset Hub, reviewed asset registry, pipeline taxonomy, voting/review UI, and shared-library submissions including fonts.
- `src/features/developer-program/`: public developer-program recruitment and explanation.
- `src/features/developer-cockpit/`: protected cockpit composition, canonical campaign media/derivatives/attachments, production packages, site-copy proposals, and durable review/delivery ledgers.
- `src/features/social-publishing/`: server-only publishing-provider adapters. Buffer owns channel connections, scheduling, and delivery; it does not own CardForge contribution records or media sources.
- `src/features/analytics/`: the single consent boundary, safe allow-listed event contract, and owner-only composition of provider-owned GA4, PostHog, and Search Console reports. Session replay is not used.
- `src/features/experience-settings/`: owner-controlled launch policy for portable project-file access and analytics-consent presentation, with one cached public projection.
- `src/features/owner/`: Owner authorization, integration/database health, and lazy composition of feature-owned operational panels.
- `src/features/contact/`: Contact forms and support email routing.
- `src/features/roadmap/`: Public roadmap, feature suggestions/votes, and owner roadmap operations.
- `src/infrastructure/`: Clerk, Supabase, HTTP, public-URL, and abuse-throttling infrastructure.
- `src/shared/`: Framework-independent utilities.
- `src/components/ui/`: Generic UI primitives and generic browser UI state.
- `src/lib/`, `src/store/`, and `src/types/` are retired root ownership lanes and must not be recreated.
- `data/default-templates/`, `data/styles/`, and `public/card-assets/`: versioned built-in catalog sources. The library APIs load these built-ins and overlay published Forge Pipeline records by stable ID; Pipeline records own reviewed additions and revisions.
- `supabase/migrations/`: Immutable, forward-only database migrations for shared product state.
- `tests/unit/`: Vitest coverage for pure helpers and model behavior.
- `tests/smoke/`: Playwright workflow and authenticated QA coverage.

## Product Architecture

CardForge has three storage lanes:

- Browser-local workspace state for user templates, generated cards, custom local assets, and project files.
- Supabase-backed shared state for the Forge Pipeline, roadmap voting, owner settings, the founder profile/public portrait, asset registry metadata, developer submissions/votes, canonical campaign media and derivatives, campaign packages/attachments/production associations, site-copy proposals, provider-delivery history, and published shared-library assets including reviewed fonts.
- Repo-owned built-ins that remain available at runtime. Published Supabase records extend them or replace a matching stable ID; `npm run pipeline:sync-defaults` imports the built-ins into the reviewed Pipeline without creating a second hand-maintained catalog.

The app should keep those lanes visibly distinct. Normal free/paid user uploads stay local until a developer intentionally submits a source asset into Forge Review. Developer and owner-submitted assets move through one shared voting, publishing, archive, and recovery pipeline.

## Environment

Copy `.env.example` to `.env.local` for local account/database testing.

Common local variables:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_CREATOR_PASS_PRICE_ID=price_...
STRIPE_SUPPORT_MONTHLY_1_PRICE_ID=price_...
STRIPE_SUPPORT_MONTHLY_5_PRICE_ID=price_...
STRIPE_SUPPORT_MONTHLY_10_PRICE_ID=price_...
STRIPE_SUPPORT_MONTHLY_20_PRICE_ID=price_...
STRIPE_SUPPORT_CURRENCY=usd
STRIPE_SUPPORT_PORTAL_URL=https://billing.stripe.com/p/login/...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=http://localhost:9002
```

Stripe Checkout owns both payment lanes, but their metadata and entitlement behavior are separate. `product_access` uses the authenticated Creator Pass Price and may update CardForge entitlement. `creator_support` offers a server-bounded customer-selected one-time amount plus fixed $1, $5, $10, and $20 monthly Prices, may be used without a CardForge account, and never updates product entitlement. The server verifies each purpose, amount, currency, recurrence, and monthly Price before checkout or webhook processing. Use the billing reconciliation and rollback procedures in [docs/operations.md](docs/operations.md) before changing billing-purpose behavior.

Reusable authenticated QA accounts are preferred over disposable user creation. Set the `CARDFORGE_E2E_*` values documented in `.env.example` when running the authenticated smoke suite.

Extended contributor campaigns/site proposals and Buffer publishing are separate release gates. Both default off. Follow the Developer Cockpit and Buffer checklist in [docs/operations.md](docs/operations.md); never expose `BUFFER_API_KEY` to a client bundle or enable publishing before the connected-channel allowlist and production owner flow are verified.

## Documentation

- [docs/architecture.md](docs/architecture.md): current product architecture and source-of-truth behavior.
- [docs/operations.md](docs/operations.md): live operations, env vars, provider checks, and launch-critical verification.
- [docs/risk-register.md](docs/risk-register.md): unresolved and explicitly accepted operational risks.

Keep the README and docs short. If a document stops describing the current product, update it or remove it.
