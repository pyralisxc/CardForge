# CardForge Architecture

Last updated: July 16, 2026

CardForge is a live local-first card production studio at `https://cardforges.com`. The app has one public product surface, one creator studio, one account/access surface, one developer asset pipeline, and one owner console.

## Product Truth

- Public site: `/`, `/about`, `/access`, `/developer`, `/roadmap`, `/cameron`, `/contact`, and legal pages.
- Studio: `/studio` contains Layout Studio and Generator.
- Accounts: Clerk identifies users; CardForge stores trusted access in Clerk private metadata or server-side allowlists.
- Billing: Stripe owns Creator Pass checkout, subscription lifecycle, webhooks, and customer portal.
- Business identity: CardForge Studio is the product and brand; Cameron Locke is its Oregon sole-proprietor operator. `src/features/business-identity` is the single runtime identity owner.
- Email: Resend sends transactional messages to the configured support inbox and users.
- Shared data: Supabase stores owner settings, legal copy, roadmap/votes, Founder Beta claims, abuse-rate buckets, billing events/subscriptions, asset registry rows, developer profiles, submissions, votes, and contact request history.
- User projects: templates, generated cards, local uploads, and project files stay browser-local unless explicitly exported or submitted.

## Source Lanes

CardForge has three storage lanes:

1. **Browser-local workspace**
   - Project owns the Zustand workspace, selectors, project documents, recovery, and persistence behind `@/features/project/client`.
   - Templates, generated cards, styles, export settings, binary artwork, editor drafts, and browser preferences use explicit IndexedDB namespaces. There is no localStorage compatibility path.
   - Project export/import is the portability path between browsers or machines.

2. **Supabase platform state**
   - Server routes and helpers use service-role access.
   - Browser-direct Supabase writes are not part of the product.
   - The live shared library comes from `cardforge_asset_registry`.

3. **Repo starter material**
   - `data/default-templates`, `data/styles`, and `public/card-assets` are import/source material for pipeline sync.
   - They are not runtime fallback catalogs.

## Core Routes

- `src/app/page.tsx`: public landing page.
- `src/app/studio/page.tsx`: Studio route.
- `src/app/account/page.tsx`: access, Founder Beta, Creator Pass, roadmap, and profile entry.
- `src/app/developer/page.tsx`: developer application and Asset Hub.
- `src/app/owner/page.tsx`: owner console.
- `src/app/api/billing/*`: Stripe status, checkout, portal, and webhook.
- `src/app/api/owner/*`: owner console, billing, account, and email operations.
- `src/app/api/developer-assets/*`: developer pipeline read/write/vote/upload.
- `src/app/api/assets`, `src/app/api/fonts`, `src/app/api/templates`, `src/app/api/styles`: live catalog/bootstrap APIs.

## Feature Ownership

- `src/features/app-shell`: Studio shell, public header, workspace bootstrap.
- `src/domain`: pure Cards, Templates, Rendering, and Entitlements policy with no feature or framework dependency. Template field contracts, generator/editor field interpretation, template display labels, pointer selection, and parent-resize geometry live here because multiple features consume them.
- `src/features/template-editor`: Layout Studio composition, session/draft lifecycle, viewport interactions, element/layer commands, variable commands, inspector/library presentation, editor history, and template-library commands. `CardTemplateMaker` composes focused hooks; other features enter only through `client.ts`.
- `src/features/card-generator`: Single card, bulk import, generated output gallery, image tools, and export tools. App Shell enters through `client.ts` and keeps heavy workspaces lazy.
- `src/features/project`: browser workspace state, selectors, IndexedDB persistence, recovery, local project assets, and portable project files.
- `src/features/billing`: customer checkout/portal actions plus owner billing panels, Stripe subscription/event storage, settings, and reconciliation behind explicit client/server interfaces.
- `src/features/account`: current-user resolution, access entitlement, profile surfaces, Founder Beta, and owner account administration behind explicit client/server interfaces.
- `src/features/business-identity`: browser-safe operator contracts, normalization, owner editing, and the server-owned `cardforge_business_identity` record.
- `src/features/public-site`: editable landing/about/access content, tagged public caches, metadata-adjacent structured data, browser-safe contracts, and a server-owned Supabase store.
- `src/features/legal`: immutable versioned legal-publication contracts, constrained Markdown presentation, tagged public caching, and server-owned Supabase publication.
- `src/features/contact`: support/contact forms, mail routing, and contact-request persistence.
- `src/features/roadmap`: public Chronicle presentation, feature suggestions and votes, owner-editable roadmap settings, and official roadmap operations.
- `src/features/developer-assets`: developer submission/voting UI, reviewed asset registry, pipeline taxonomy, fonts, and owner developer-program controls.
- `src/features/owner`: owner authorization, integration/database health, and lazy operational panel composition. Business identity, Founder Beta, account administration, billing, and public content remain owned by their product features.
- `src/infrastructure`: Clerk middleware/configuration, Supabase service access, HTTP response/validation/timing, public URL resolution, and durable abuse throttling. Infrastructure depends only on Infrastructure, Domain, Shared, and external providers.
- `src/shared`: framework-agnostic utilities such as timeout handling, text normalization, and user-facing error construction.
- `src/components/ui`: generic UI primitives and generic browser UI state such as toast delivery.
- `src/lib` is retired. The required `src/middleware.ts` Next entry is thin App composition over the Infrastructure implementation.

Feature-specific rules stay under their owning feature and cross-feature consumers use declared `client.ts` or `server.ts` interfaces. Pure policy belongs in Domain; generic helpers belong in Shared.

## Enforced Dependency Rules

`npm run architecture:check` scans every TypeScript import in `src` and fails directly on any violation. There is no exception baseline or compatibility allowlist. The enforced rules are:

- App Router composes features only through declared client/server interfaces.
- Features never import App Router composition.
- Cross-feature imports use the target feature's public interface.
- Client modules never import server interfaces.
- Shared, Domain, Infrastructure, and generic UI keep their one-way dependency direction.
- The feature graph must remain acyclic.
- Retired root `src/lib`, `src/store`, and `src/types` lanes must not return.

Shared public headers are App-owned composition. The Owner Console loads a 108-line coordinator first and lazy-loads operational panels behind tabs.

## Current Access Model

- Free users can design locally and generate previews.
- Founder Beta users get time-limited clean export access while seats remain available.
- Creator Pass users get paid clean export access through Stripe.
- Developer access grants export plus pipeline tools.
- Owner access grants owner console plus developer-grade tools.
- Public Clerk metadata is display-only and must not grant paid/dev/owner access.

## Card Creation Model

- Layout Studio owns reusable front templates and separate back templates.
- Generator owns card sets, selected front template, selected card back, card data, generated output, and export settings.
- Card backs are not front-template fields.
- Text variables use Field Contract v1.
- Images have generator-side formatting controls for fit, position, scale, rotation, offset, and flips.

## Developer Asset Pipeline

Developer submissions and CardForge starter assets use one lifecycle:

`draft -> submitted -> voting -> publish_candidate -> published`

Assets can also be `archived` or `rejected`. Published creator-facing tiers are `free` and `paid`; internal `developer` and `hidden` values are pipeline states, not extra customer library tiers.

The current developer pipeline is operational infrastructure, not an active payout system. The former Creator Pool page is an archived, noindex notice and is not promoted as an access tier or active program.

## Public delivery and search identity

Marketing and legal reads use one-hour bounded Next.js caches. Owner mutations invalidate the exact business-identity, content-group, or legal-document tag only after the corresponding database write succeeds. Account-specific and API routes remain dynamic.

Each public route owns its title, description, self-referencing canonical, Open Graph URL, social image, and robots decision through `src/shared/siteMetadata.ts`. The XML sitemap contains only canonical marketing pages; public legal pages are canonical and indexable but intentionally excluded from the marketing sitemap. `/studio`, `/account`, `/profile`, `/owner`, and the Creator Pool archive are noindex.

CardForge structured data represents CardForge Studio as a `Brand`, the product as `SoftwareApplication`, and Cameron Locke as a `Person` and the main entity of the `/cameron` `ProfilePage`. JSON-LD serialization escapes markup-significant characters before insertion.

Legal publication creates a new `(slug, version)` record bound to the current business-identity version. Existing versions are retained. CardForge does not currently track acceptance of revised terms; adding acceptance tracking, notice rules, and enforcement remains a separate product/legal decision.

## Keep It Minimal

When changing CardForge:

- Prefer one owner for each responsibility.
- Do not add compatibility exports or duplicate owners; preserve stored user/provider data through explicit migrations when required.
- Keep docs current and short.
- Keep tests focused on live money, access, export, data, and core authoring behavior.
- Keep implementation history in Git and pull requests rather than the live documentation tree.
