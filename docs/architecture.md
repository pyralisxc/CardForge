# CardForge Architecture

Last updated: July 13, 2026

CardForge is a live local-first card production studio at `https://cardforges.com`. The app has one public product surface, one creator studio, one account/access surface, one developer asset pipeline, and one owner console.

## Product Truth

- Public site: `/`, `/about`, `/access`, `/roadmap`, `/contact`, and legal pages.
- Studio: `/studio` contains Layout Studio and Generator.
- Accounts: Clerk identifies users; CardForge stores trusted access in Clerk private metadata or server-side allowlists.
- Billing: Stripe owns Creator Pass checkout, subscription lifecycle, webhooks, and customer portal.
- Email: Resend sends transactional messages; Gmail is the current support recipient.
- Shared data: Supabase stores owner settings, legal copy, roadmap/votes, Founder Beta claims, asset registry rows, developer profiles, submissions, votes, and contact request history.
- User projects: templates, generated cards, local uploads, and project files stay browser-local unless explicitly exported or submitted.

## Source Lanes

CardForge has three storage lanes:

1. **Browser-local workspace**
   - Zustand persists user templates, generated cards, custom local assets, styles, active workspace state, and export settings.
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
- `src/features/template-editor`: Layout Studio, canvas, layers, inspector panels, template state.
- `src/features/card-generator`: Single card, bulk import, generated output gallery, image tools, export tools.
- `src/features/project`: local project files, project asset persistence, and project access rules.
- `src/features/billing`: Stripe checkout, subscription, portal, and billing config helpers.
- `src/features/account`: account status, access entitlement, roadmap, profile surfaces, and user access helpers.
- `src/features/developer-assets`: developer submission/voting UI, reviewed asset registry, pipeline taxonomy, fonts, and owner developer-program controls.
- `src/features/owner`: launch, operations, legal/site copy, access/promo, developer program, account management, and owner Supabase store.
- `src/features/contact`: support/contact mail routing and contact request forms.
- `src/lib`: shared pure models, card rendering/export primitives, Supabase client setup, validation utilities, API response helpers, and constants.

Feature-specific rules should live under the owning `src/features/<feature>/lib` folder. `src/lib` is reserved for cross-feature primitives that do not own a product workflow.

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
- Remove stale compatibility paths instead of carrying them.
- Keep docs current and short.
- Keep tests focused on live money, access, export, data, and core authoring behavior.
- Do not add historical docs or speculative plans unless they replace existing truth.
