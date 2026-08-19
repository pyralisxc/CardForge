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

If the visible local site looks stale, stop any old server on port `9002` and restart `npm run dev`.

## Core Commands

```bash
npm run dev        # Next dev server on http://localhost:9002
npm run build      # Production build
npm run lint       # ESLint
npm run typecheck  # next typegen + TypeScript no-emit check
npm run test       # Vitest unit suite
npm run test:watch # Vitest watch mode
npm run migrations:check # Reject edits to existing Supabase migrations
npm run smoke:ui    # Focused mocked browser regression with accessibility checks
```

Maintained operational commands:

```bash
npm run health:production                # Five-route production health check
npm run pipeline:sync-defaults            # Import missing bootstrap assets into the reviewed pipeline
```

## Source Map

- `src/app/`: Next.js routes and API routes.
- `src/domain/`: pure Cards, Templates, Rendering, and Entitlements policy.
- `src/features/app-shell/`: Studio shell, workspace bootstrap, and route-level composition.
- `src/features/template-editor/`: Template Studio panels, inspector tools, canvas commands, and editor controller hooks.
- `src/features/card-generator/`: One-card and list-based creation, card review, editing, sharing, downloads, and print/export settings.
- `src/features/brand-presentation/`: Dependency-free runtime projection of the owner-approved brand name, mark, favicon, social image, and watermark presentation.
- `src/features/card-rendering/`: Shared card preview, rich-text, vector-shape, thumbnail, appearance, and watermark rendering.
- `src/features/project/`: Local project files, project asset persistence, and project access rules.
- `src/features/billing/`: Stripe checkout, subscription, portal, and billing config helpers.
- `src/features/account/`: Account overview, entitlement, roadmap panels, profile surface, and user access helpers.
- `src/features/business-identity/`: canonical operator identity, owner editing, and server-owned Supabase persistence.
- `src/features/public-site/`: owner-editable public copy, constrained navigation/homepage/SEO configuration, canonical public brand and marketing media (including favicon, watermark, and live-example artwork), social/share controls, tagged public caching, image processing, and structured search identity.
- `src/features/legal/`: immutable versioned legal publication, constrained document rendering, and public legal caching.
- `src/features/developer-access/`: the single owner of developer identity, profile status, contribution grants, and every runtime access to the `cardforge_developer_profiles` persistence boundary.
- `src/features/developer-assets/`: Developer Asset Hub, reviewed asset registry, Studio destination map, voting/review UI, and shared-library submissions including fonts.
- `src/features/developer-program/`: public developer-program recruitment and explanation.
- `src/features/marketing/`: owner-controlled strategy, campaign containers, offers, and claims guardrails.
- `src/features/marketing-content/`: reusable content packages, channel variants, canonical media, contributor workflow, review, and approval.
- `src/features/marketing-distribution/`: destination rules, encrypted connections, schedules, delivery jobs, retries, and provider-post records.
- `src/features/developer-cockpit/`: protected contributor workspace composition and site-copy proposal workflow.
- `src/features/social-publishing/`: stateless server-only provider adapters. Meta owns external authorization and provider posts; CardForge distribution owns encrypted connections and delivery history.
- `src/features/analytics/`: the single consent boundary, safe allow-listed event contract, and owner-only composition of provider-owned GA4, PostHog, and Search Console reports. Session replay is not used.
- `src/features/experience-settings/`: owner-controlled launch policy for portable project-file access and analytics-consent presentation, with one cached public projection.
- `src/features/owner/`: Owner authorization, integration/database health, consolidated Clerk/developer people projection, append-only owner activity, and lazy composition of feature-owned operational controls.
- `src/features/contact/`: Contact forms and support email routing.
- `src/features/roadmap/`: Public roadmap, feature suggestions/votes, and owner roadmap operations.
- `src/infrastructure/`: Clerk, Supabase, HTTP, public-URL, and abuse-throttling infrastructure.
- `src/shared/`: Framework-independent utilities.
- `src/components/ui/`: Generic UI primitives and generic browser UI state.
- `src/lib/`, `src/store/`, and `src/types/` are retired root ownership lanes and must not be recreated.
- `data/pipeline-bootstrap/`: one-time template, recipe, metadata, and media input for the Forge Pipeline importer. Studio never reads it at runtime. `public/site-fallbacks/` contains only owner-replaceable public-page fallback art.
- `supabase/migrations/`: Immutable, forward-only database migrations for shared product state.
- `tests/unit/`: focused Vitest protection for durable data contracts, security boundaries, high-risk behavior, and known regressions. File-size policy belongs to `architecture:check`, not unit tests.
- `tests/smoke/`: protected authenticated QA coverage for provider-backed access and recovery paths only.

## Product Architecture

CardForge has three deliberately separate storage lanes:

- Browser-local workspace state for user templates, generated cards, custom local assets, and project files.
- Supabase-backed shared state for the Forge Pipeline, roadmap voting, owner settings, the founder profile/public portrait, asset registry metadata, developer submissions/votes, canonical campaign media and derivatives, campaign packages/attachments/production associations, site-copy proposals, provider-delivery history, and published shared-library assets including reviewed fonts.
- Repository fallback media for a safe first render plus bootstrap import material. Supabase Site Media owns the live public brand and marketing selections, including the favicon; repository files are not a competing owner or Template Studio catalog. `npm run pipeline:sync-defaults` copies missing Studio assets into managed storage and the registry; it never overwrites owner decisions or recreates an owner-deleted asset.

The app should keep those lanes visibly distinct. Normal free/paid user uploads stay local until a developer intentionally submits a source asset into Forge Review. Developer and owner-submitted assets move through one shared voting, publishing, archive, and deletion pipeline. Owners may permanently remove any lineage—including published or voted work—using exact-name confirmation; the deletion removes registry state, revisions, votes, and managed objects and leaves a private tombstone so bootstrap cannot restore it.

Template Studio shelves are explicit: Templates split into Fronts and Backs; Images split into Pictures, Front Frames, and Back Frames; Elements contain Icons and Dividers; Styles contain Textures and validated reusable treatments. Code owns this finite destination contract, Supabase owns each asset's current placement/order/featured state, and Owner > Library & Production > Forge Pipeline > Studio Map is the only live override surface.

Shared Template revisions are created only from Template Studio. A developer save submits the next numbered revision to Forge Review while keeping the published Template live; an owner save records and publishes the next revision atomically without a redundant self-review. The generic developer upload form accepts media and fonts only, and owner-authored visual Styles continue to publish from Appearance Studio. This keeps editable structured assets in their native authoring workflow instead of maintaining a parallel JSON-upload path.

ChatGPT and Codex use the authenticated `/mcp` endpoint to create and inspect private account Studio documents, then optionally create a Forge Review draft from an exact chosen Template. The same developer scopes, account ownership, rate limits, watermark/export entitlements, and owner-only publication boundary apply to browser and MCP callers. OAuth discovery lives under `/.well-known/`; Clerk remains the identity provider. Before connecting a chat client, configure the production Clerk OAuth Applications screen for `openid`, `profile`, and `email`, then allow the reviewed client through CIMD or temporarily enable dynamic client registration for controlled testing. The distributable source package lives in `plugins/cardforge-studio`; its public ChatGPT connection id is added only after the production MCP server has been registered.

## Environment

Copy `.env.example` to `.env.local` for local account/database testing.

Common local variables:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
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

## Verification posture

The deployed CardForge site owns user-experience truth. Every release must exercise the affected workflow on its Vercel preview, then verify the merged behavior on `cardforges.com`; localhost and a simulated public catalog are not substitutes for live data, provider state, responsive layout, or signed-in roles.

Persistent automated tests are reserved for failures that are difficult or costly to detect through normal use: permissions, billing and entitlements, destructive operations, migration/data integrity, pure rendering or export contracts, and regressions that have already occurred. A test created only to guide development should be removed or consolidated after the behavior is proven unless it protects one of those durable boundaries. Tests support the product; they do not become a second implementation of it.

Extended contributor access and native Meta publishing are separate release gates. Both default off. Follow the Marketing Command Center checklist in [docs/operations.md](docs/operations.md); never expose Meta, encryption, or dispatcher secrets to a client bundle, and never enable publishing before the signed-in production owner flow and harmless post are verified.

## Documentation

- [docs/architecture.md](docs/architecture.md): current product architecture and source-of-truth behavior.
- [docs/integrations.md](docs/integrations.md): provider-native ownership, intentional CardForge seams, and human journey trace paths.
- [docs/product-direction.md](docs/product-direction.md): living Studio, Specialty, Kit, Games, print, and fulfillment direction; proposed behavior is kept separate from shipped architecture.
- [docs/operations.md](docs/operations.md): live operations, env vars, provider checks, and launch-critical verification.
- [docs/risk-register.md](docs/risk-register.md): unresolved and explicitly accepted operational risks.

Keep the README and docs short. If a document stops describing the current product, update it or remove it.
