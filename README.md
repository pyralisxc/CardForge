# CardForge

CardForge helps creators turn card ideas into full, export-ready sets. The Studio combines reusable templates, structured data, bulk generation, and clean PNG, ZIP, PDF, or Tabletop Simulator exports, while approved developers help shape the shared library that powers the product. The fantasy forge is the doorway; underneath is a serious production workflow for creators building real card systems. User project work stays in browser storage or downloaded project files for the current launch.

CardForge Studio is a software product created and operated by Cameron Locke, an independent sole proprietor based in Oregon.

## Live State

- Public site: `/`
- Product story and access: `/about`, `/access`
- Founder identity: `/cameron`
- Studio: `/studio`
- Account and Founder Beta status: `/account`
- Profile management: `/profile`
- Public roadmap and feature voting: `/roadmap`
- Developer application and asset pipeline: `/developer`
- Contact and versioned trust documents: `/contact`, `/privacy`, `/terms`, `/refund`, `/creator-pass-terms`, `/supporter-terms`, `/developer-terms`, `/accessibility`
- Owner console: `/owner`

The current product is in controlled public beta and first-customer operation on [cardforges.com](https://cardforges.com).

## Quick Start

Requirements:

- Node.js 20 or newer
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
npm run smoke      # Playwright smoke suite
```

Maintained operational commands:

```bash
npm run health:production                # Five-route production health check
npm run qa:bootstrap-authenticated-smoke # Align the four protected Clerk QA identities
npm run pipeline:sync-defaults            # Seed repo-owned starter assets into the reviewed pipeline
```

## Source Map

- `src/app/`: Next.js routes and API routes.
- `src/features/app-shell/`: Studio shell, workspace state, and route-level composition.
- `src/features/template-editor/`: Layout Studio panels, inspector tools, canvas commands, and editor controller hooks.
- `src/features/card-generator/`: Single output entry, bulk data import, generated gallery, export controls, and paper/export settings.
- `src/features/project/`: Local project files, project asset persistence, and project access rules.
- `src/features/billing/`: Stripe checkout, subscription, portal, and billing config helpers.
- `src/features/account/`: Account overview, entitlement, roadmap panels, profile surface, and user access helpers.
- `src/features/business-identity/`: canonical operator identity, owner editing, and server-owned Supabase persistence.
- `src/features/public-site/`: owner-editable marketing content, tagged public caching, and structured search identity.
- `src/features/legal/`: immutable versioned legal publication, constrained document rendering, and public legal caching.
- `src/features/developer-assets/`: Developer Asset Hub, reviewed asset registry, pipeline taxonomy, voting/review UI, and shared-library submissions including fonts.
- `src/features/owner/`: Owner authorization, integration/database health, and lazy composition of feature-owned operational panels.
- `src/features/contact/`: Contact forms and support email routing.
- `src/lib/`: Shared model, card rendering/export primitives, Supabase setup, validation utilities, API responses, and constants.
- `src/store/`: Zustand persisted local app state and derived selectors.
- `data/default-templates/`, `data/styles/`, and `public/card-assets/`: starter/import material for the Forge Pipeline sync, not runtime fallback catalogs.
- `supabase/migrations/`: Ordered database migrations for shared roadmap, owner, Founder Beta, asset registry, and developer pipeline state.
- `tests/unit/`: Vitest coverage for pure helpers and model behavior.
- `tests/smoke/`: Playwright workflow and authenticated QA coverage.

## Product Architecture

CardForge has three storage lanes:

- Browser-local workspace state for user templates, generated cards, custom local assets, and project files.
- Supabase-backed Forge Pipeline state for roadmap voting, Founder Beta claims, owner settings, asset registry metadata, developer submissions, votes, and published shared-library assets including reviewed fonts.
- Repo starter/import files that can seed the pipeline with `npm run pipeline:sync-defaults`, but should not silently replace a missing database catalog at runtime.

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
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=http://localhost:9002
```

Stripe Checkout owns the paid Creator Pass flow. Create the Creator Pass Product and recurring Price in Stripe, then set `STRIPE_PRICE_ID` to that `price_...` value. Add a webhook endpoint at `/api/billing/webhook` and listen for `checkout.session.completed` plus `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`; the resulting `STRIPE_WEBHOOK_SECRET` lets CardForge safely grant or revoke trusted Clerk private metadata. If PayPal is available for the Stripe account, enable it in Stripe payment method settings rather than adding a separate PayPal API integration.

Reusable authenticated QA accounts are preferred over disposable user creation. Set the `CARDFORGE_E2E_*` values documented in `.env.example` when running the authenticated smoke suite.

## Documentation

- [docs/architecture.md](docs/architecture.md): current product architecture and source-of-truth behavior.
- [docs/operations.md](docs/operations.md): live operations, env vars, provider checks, and launch-critical verification.
- [docs/risk-register.md](docs/risk-register.md): open, accepted, and verified launch risks with review dates.

Keep the README and docs short. If a document stops describing the current product, update it or remove it.
