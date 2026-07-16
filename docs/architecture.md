# CardForge Architecture

Last updated: July 16, 2026

CardForge is a live local-first card production studio at `https://cardforges.com`. The app has one public product surface, one creator studio, one account/access surface, one developer asset pipeline, and one owner console.

## Product Truth

- Public site: `/`, `/about`, `/access`, `/roadmap`, `/contact`, and legal pages.
- Studio: `/studio` contains Layout Studio and Generator.
- Accounts: Clerk identifies users; CardForge stores trusted access in Clerk private metadata or server-side allowlists.
- Billing: Stripe owns Creator Pass checkout, subscription lifecycle, webhooks, and customer portal.
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
- `src/domain`: pure Cards, Templates, Rendering, and Entitlements policy with no feature or framework dependency.
- `src/features/template-editor`: Layout Studio, canvas, layers, inspector panels, editor state, and template-library commands.
- `src/features/card-generator`: Single card, bulk import, generated output gallery, image tools, export tools.
- `src/features/project`: browser workspace state, selectors, IndexedDB persistence, recovery, local project assets, and portable project files.
- `src/features/billing`: Stripe checkout, subscription, portal, and billing config helpers.
- `src/features/account`: account status, access entitlement, roadmap, profile surfaces, and user access helpers.
- `src/features/developer-assets`: developer submission/voting UI, reviewed asset registry, pipeline taxonomy, fonts, and owner developer-program controls.
- `src/features/owner`: launch, operations, legal/site copy, access/promo, developer program, account management, and owner Supabase store.
- `src/features/contact`: support/contact mail routing and contact request forms.
- `src/infrastructure`: provider adapters as they are extracted from legacy roots.
- `src/shared`: product-agnostic utilities.
- `src/components/ui`: generic UI primitives.
- `src/lib` and other root catch-alls are migration-only and must shrink; new ownership is not added there.

Feature-specific rules stay under their owning feature and cross-feature consumers use declared `client.ts` or `server.ts` interfaces. Pure policy belongs in Domain; generic helpers belong in Shared.

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

The current developer pipeline is operational infrastructure, not an active payout system. Creator-pool language remains planning copy until payout, tax, refund, and legal operations exist.

## Keep It Minimal

When changing CardForge:

- Prefer one owner for each responsibility.
- Retain compatibility only when it protects stored user data or provider state; remove it after the migration boundary is explicitly closed.
- Keep docs current and short.
- Keep tests focused on live money, access, export, data, and core authoring behavior.
- Keep implementation history in Git and pull requests rather than the live documentation tree.
