# CardForge Architecture

Last updated: August 14, 2026

CardForge is a live local-first card production studio at `https://cardforges.com`. The app has one public product surface, one creator studio, one account/access surface, one public developer application, one protected contribution cockpit, and one owner console.

## Product Truth

- Public site: `/`, `/about`, `/developer`, `/roadmap`, `/cameron`, `/contact`, and legal pages. The homepage owns product proof and access explanation; `/cameron` combines the founder story and voluntary support in one route.
- Studio: `/studio` contains Layout Studio and Generator.
- Accounts: Clerk identifies users; CardForge stores trusted access in Clerk private metadata or server-side allowlists.
- Billing: Stripe owns Creator Pass checkout, subscription lifecycle, webhooks, and customer portal.
- Business identity: CardForge Studio is the product and brand; Cameron Locke is its Oregon sole-proprietor operator. `src/features/business-identity` is the single runtime identity owner.
- Email: Resend sends transactional messages to the configured support inbox and users.
- Shared data: Supabase stores owner settings, canonical public brand and marketing media, legal copy, the founder profile, roadmap/votes, abuse-rate buckets, billing events/subscriptions, asset registry rows, developer profiles/scopes, asset submissions/votes, campaign packages, protected and approved campaign media, site-copy proposals, provider delivery jobs, and contact request history.
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

3. **Pipeline-owned Studio catalog**
   - `cardforge_asset_registry` is the only runtime catalog for shared templates, card backs, visual presets, fonts, and media assets used by Template Studio.
   - `/api/catalog` reads the published registry once and returns one versioned manifest for templates, card backs, presets, fonts, and media. Tier-keyed server caching is invalidated by application mutations and never crosses free/paid/developer access. Registry failure returns an honest unavailable response rather than caching an empty catalog or switching to repository data.
   - `data/pipeline-bootstrap` is importer input only; `public/site-fallbacks` is public-page fallback art only. Neither is a second Studio catalog. Rendering primitives in TypeScript remain asset-free.
   - `npm run pipeline:sync-defaults` imports only missing stable IDs, copies referenced media into managed Supabase storage, preserves current owner/vote decisions, and skips durable owner-deletion tombstones.
   - `CARDFORGE_OWNER_ACCOUNT_EMAILS` must contain exactly one canonical Pipeline publisher. Owner and AI-assisted maintenance publish through that real Clerk developer identity; development proxies are never separate attribution owners.
   - Retired development identities are durable aliases, not deleted audit facts: Pipeline ownership transfers to the canonical profile, raw owner activity remains append-only, the Owner Console resolves the alias for display, and a database trigger prevents a retired profile from being recreated.
   - Owner permanent deletion is authoritative: it hides the asset at preparation, removes the registry entry, complete submission/revision/vote lineage, and managed storage, then retains only a private tombstone that prevents accidental recreation.

## Core Routes

- `src/app/page.tsx`: public landing page.
- `src/app/studio/page.tsx`: Studio route.
- `src/app/account/page.tsx`: account access, Creator Pass, developer status, and profile entry.
- `src/app/developer/page.tsx`: public, indexable developer application.
- `src/app/developer/cockpit/page.tsx`: protected, noindex contribution workspace.
- `src/app/owner/page.tsx`: owner console.
- `src/app/api/billing/*`: Stripe status, checkout, portal, and webhook.
- `src/app/api/owner/*`: owner console, billing, account, and email operations.
- `src/app/api/developer-assets/*`: developer pipeline read/write/vote/upload.
- `src/app/api/developer-cockpit/*`: scoped campaign/site proposal/media operations plus owner-only provider and scope mutations.
- `src/app/api/catalog`: canonical versioned runtime catalog. The GET sides of `assets`, `fonts`, `templates`, and `styles` are compatibility projections; template/style mutations remain on their focused routes.

API route files own HTTP configuration and delegation. Provider or product workflows live under their feature server owner; for example, Stripe webhook processing and owner reconciliation live under `src/features/billing/server`.

## Feature Ownership

- `src/features/app-shell`: Studio shell and workspace bootstrap.
- `src/domain`: pure Cards, Templates, Rendering, and Entitlements policy with no feature or framework dependency. Template field contracts, generator/editor field interpretation, template display labels, pointer selection, and parent-resize geometry live here because multiple features consume them.
- `src/features/template-editor`: Layout Studio composition, session/draft lifecycle, viewport interactions, element/layer commands, variable commands, inspector/library presentation, editor history, and template-library commands. `CardTemplateMaker` composes focused hooks; other features enter only through `client.ts`.
- `src/features/card-generator`: Single-card and bulk two-face generation, generated output gallery, image tools, and export tools. Each generated card owns independent `data` (front) and `backingData` (back) values; layouts remain reusable rendering blueprints. Bulk files use `back.<field>` headers for back values. App Shell enters through `client.ts` and keeps heavy workspaces lazy.
- `src/features/brand-presentation`: dependency-free runtime contract for the owner-approved brand name, mark, favicon, social image, and watermark presentation assembled by the app root.
- `src/features/card-rendering`: shared card preview, rich-text, vector-shape, thumbnail, appearance, watermark rendering, and rendering-specific global CSS consumed through `client.ts`.
- `src/features/project`: browser workspace state, selectors, IndexedDB persistence, recovery, local project assets, and portable project files.
- `src/features/billing`: customer checkout/portal actions plus owner billing panels, Stripe webhook processing, subscription/event storage, settings, and reconciliation behind explicit client/server interfaces.
- `src/features/account`: current-user resolution, access entitlement, profile surfaces, and owner account administration behind explicit client/server interfaces.
- `src/features/business-identity`: browser-safe operator contracts, normalization, owner editing, and the server-owned `cardforge_business_identity` record.
- `src/features/public-site`: editable landing/about/sharing/founder content, the shared public header/footer, social and share controls, responsive public-media presentation and CSS, tagged public caches, server-side portrait processing, metadata-adjacent structured data, browser-safe contracts, and server-owned Supabase stores.
- `src/features/legal`: immutable versioned legal-publication contracts, constrained Markdown presentation, tagged public caching, and server-owned Supabase publication.
- `src/features/contact`: support/contact forms, mail routing, and contact-request persistence.
- `src/features/roadmap`: public Chronicle presentation, feature suggestions and votes, owner-editable roadmap settings, and official roadmap operations.
- `src/features/developer-access`: the single developer identity and authorization owner. It owns profile status, contribution-scope resolution, owner grant mutations, and every runtime access to `cardforge_developer_profiles`.
- `src/features/developer-assets`: developer submission/voting UI, reviewed asset registry, pipeline taxonomy, fonts, and owner asset-program controls. `developerAssetProgram.ts` owns contracts/normalization/row mapping, `developerAssetProgramView.ts` owns the pure view projection, `developerAssetProjections.ts` owns paged/aggregate reads, and `developerAssetStore.ts` owns commands plus program composition.
- `src/features/developer-program`: public developer-program recruitment and explanation.
- `src/features/developer-cockpit`: protected cockpit composition, CardForge-owned campaign/site proposal ledgers, media approval, and workflow state transitions.
- `src/features/social-publishing`: server-only provider boundary. Buffer owns channel connections, post scheduling, and delivery status; CardForge owns package content, approval history, source media, and the durable mapping to provider post IDs.
- `src/features/analytics`: one explicit-consent boundary for privacy-minimized GA4 acquisition, anonymous allow-listed PostHog interactions, organic UTM policy, and server-only read access to GA4, PostHog, and Search Console. Providers own measurement records; CardForge does not duplicate raw analytics in Supabase.
- `src/features/experience-settings`: the single owner of launch-time experience policy, its owner-only mutation, and its sanitized cached public projection. It currently controls portable project-file access and analytics-consent presentation.
- `src/features/owner`: owner authorization, integration/database health, the external-provider inventory, and lazy operational panel composition. The inventory explains and links provider ownership without becoming a second configuration system. Business identity, account administration, billing, and public content remain owned by their product features.
- `src/infrastructure`: Clerk middleware/configuration, Supabase service access, HTTP response/validation/timing, public URL resolution, and durable abuse throttling. Infrastructure depends only on Infrastructure, Domain, Shared, and external providers.
- `src/shared`: framework-agnostic utilities such as timeout handling, text normalization, and user-facing error construction.
- `src/components/ui`: generic UI primitives and generic browser UI state such as toast delivery.
- `src/lib` is retired. The required `src/proxy.ts` Next entry is thin App composition over the Infrastructure implementation.

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

App routes compose the public-site-owned shared header. The Owner Console keeps its coordinator small and lazy-loads feature-owned controls behind five workspaces. Code defines which public controls are safe; the Owner Console owns their live values.

## Current Access Model

- Free users can design locally and generate previews. Portable project-file access follows the owner-controlled experience policy.
- Creator Pass users get paid clean finished-output access through Stripe. Project-file policy cannot unlock watermark-free PNG, PDF, ZIP, or Tabletop Simulator exports.
- Developer access grants export plus pipeline tools.
- Active developer access requires both Clerk developer entitlement and an active CardForge developer profile. Campaign drafting and site-copy proposals are separate owner-managed scopes and remain globally gated until updated contribution terms/privacy are published.
- Owner access grants owner console plus developer-grade tools.
- Public Clerk metadata is display-only and must not grant paid/dev/owner access.

## Card Creation Model

- Layout Studio owns reusable front templates, separate back templates, and its own editor selection. Opening a card back for editing must not change the Generator's selected front design.
- Generator owns card sets, the selected front design and card back, card details, cards in the set, and export settings. It hands back editing and creation to Layout Studio, then explicitly offers to apply a newly saved back to the current set and its existing cards.
- Card backs are not front-template fields.
- Text variables use Field Contract v1.
- Images have generator-side formatting controls for fit, position, scale, rotation, offset, and flips.

## Developer Asset Pipeline

Developer submissions and CardForge starter assets use one lifecycle:

`draft -> submitted -> voting -> publish_candidate -> published`

Assets can also be `archived` or `rejected`. Published creator-facing tiers are `free` and `paid`; internal `developer` and `hidden` values are pipeline states, not extra customer library tiers.

The current developer pipeline is operational infrastructure, not an active payout system. It has no payout eligibility or pool-percentage application controls. The former Creator Pool page is an archived, noindex legal notice and is not promoted as an access tier or active program.

## Developer Contribution Cockpit

`/developer` recruits and explains the program. `/developer/cockpit` is the protected working surface. It composes, but does not absorb, four owners:

- `developer-access` owns developer identity, active/inactive status, scope resolution, and owner-managed contribution grants.
- `developer-assets` retains the existing asset submission, peer voting, publishing, archive, and recovery lifecycle.
- `developer-cockpit` owns marketing campaign packages, canonical campaign media, derivatives, attachments, production associations, and site-copy proposals, including contributor attribution, versions, review notes, and owner decisions.
- `social-publishing` owns the Buffer protocol adapter. The API key is server-only and provider mutations require both owner access and `CARDFORGE_BUFFER_PUBLISHING_ENABLED=true`.

Non-owner developers never gain approval, site publication, provider configuration, or scheduling powers. New campaign/site scopes default false in Supabase and are additionally hidden behind `CARDFORGE_EXTENDED_CONTRIBUTIONS_ENABLED`.

The Owner Console People directory is the single human-facing composition of Clerk account entitlement and `developer-access` profile status/scopes. Revocation is fail-safe across providers: Clerk entitlement is removed first, then the retained profile is deactivated and extended scopes are cleared. Contribution and voting history remains attributed. Provider/DB partial completion is reported and retryable; a missing Clerk account is history, not active access.

`public-site` owns the constrained live site-configuration, public-copy catalog, and public brand/marketing-media catalog. Owner settings may reorder or hide only code-allowlisted navigation destinations and homepage sections; adjust homepage metadata, search phrases, actions, announcements, offers, and watermark presentation; edit the allowlisted shell, landing, About, founder, developer-program, roadmap, and sharing copy; and replace the brand mark, favicon, watermark, default social image, homepage imagery, Studio screenshots, live-example artwork, and founder portrait. They cannot introduce arbitrary routes, scripts, provider credentials, unreviewed capability claims, or product behavior. `owner` owns the append-only operational history projection, while each feature continues to own its mutation.

Campaign media has one canonical CardForge UUID. Ingestion retains an immutable protected original and a protected normalized WebP master; storage bucket/object references stay server-only. Campaign JSON retains only channel copy. Relational attachments reference media IDs and own display order, contextual alt text, crop intent, caption overrides, and an optional chosen derivative. Media owns intrinsic metadata, content hash, rights/credit, focal point, lifecycle, and its approved derivatives. A public URL is delivery output, never application identity.

Owner approval creates or reuses the deterministic public derivative for each media ID, records it before exposure, and is retry-safe. The protected original/master never goes to Buffer. `social-publishing` resolves the approved derivative server-side only when the separately gated owner delivery flow is enabled.

Campaigns use the durable lifecycle:

`draft -> submitted -> changes_requested -> approved -> provider_draft | scheduled -> published`

Provider errors remain recorded and retryable; cancellation is terminal. Site proposals capture the live block they were based on. The atomic owner publication function rejects stale proposals rather than overwriting newer live copy.

Humans and scoped agents use the same contributor authorization and campaign normalization. The contributor API supports authorized media ingest/reuse, idempotent draft creation, optimistic revision, association replacement, validation without mutation, submission, revision, and resubmission. It never grants media approval, public exposure, provider configuration, scheduling, or publishing. The Campaign Media Library remains owner-only and exposes CardForge media records rather than raw Storage controls.

Future derivative generation, screenshot capture, focal-crop suggestions, caption drafting, video processing, and Jam ingestion belong behind the existing campaign-media identity and owner-review boundary. They must not create a parallel media catalog or automate publishing.

## Public delivery and search identity

Marketing and legal reads use one-hour bounded Next.js caches. Owner mutations invalidate the exact business-identity, founder-profile, public-site-media, public-site-content, configuration, or legal-document tag only after the corresponding database write succeeds. Account-specific and API routes remain dynamic.

`cardforge_founder_profile` is a private single-row service-role record. The public shell reads its cached copy for Facebook, Instagram, and Discord controls; blank links announce a coming-soon state. Public brand and marketing uploads are decoded and normalized by Sharp, stored as immutable versioned objects in `cardforge-public-media`, and only become active after Storage succeeds. Brand marks, favicons, and watermarks become transparent PNG; social images become 1600x900 WebP; page imagery and live-example artwork become bounded metadata-free WebP. The prior live version remains restorable, and the older superseded object is removed after a successful publication.

Code owns canonical paths, robots decisions, and the allowlisted metadata renderer through `src/shared/siteMetadata.ts`. The owner controls the homepage title/description/search phrases and the marketing-page title/description catalog; the managed default social image supplies Open Graph and Twitter previews. The XML sitemap contains only canonical marketing pages; public legal pages are canonical and indexable but intentionally excluded from the marketing sitemap. `/studio`, `/account`, `/profile`, `/owner`, and the Creator Pool archive are noindex. The removed `/access` and `/examples` routes intentionally return 404 instead of retaining redirects or duplicate page code.

The root public share settings combine the owner-edited `sharing.message` block with canonical homepage and Cameron URLs. Generated-card sharing consumes that message and the homepage URL. The Owner Console renders separate high-resolution QR PNGs for the homepage and Cameron page in the browser, so no duplicate QR files or storage registry can become stale.

CardForge structured data represents CardForge Studio as a `Brand`, the product as `SoftwareApplication`, and Cameron Locke as a `Person` and the main entity of the `/cameron` `ProfilePage`. JSON-LD serialization escapes markup-significant characters before insertion.

Organic promotion uses `utm_medium=organic_social` with normalized source, campaign, and post-content identities. Browser measurement is hard-disabled unless `NEXT_PUBLIC_CARDFORGE_ANALYTICS_ENABLED=true`, the relevant public provider configuration is present, and the visitor explicitly chooses Accept or Accept once. Accept and Decline persist for up to 180 days; Accept once uses session-only CardForge and GA state. PostHog always uses session storage, never receives an identified user, never creates person profiles, and never records session replay. The owner can present the same three choices as a required-choice popup, the standard popup, or a quiet banner; presentation never changes the data scope or makes analytics mandatory. Advertising storage, Google Signals, ad personalization, GA4 Enhanced Measurement, PostHog autocapture, heatmaps, exception capture, and session recording remain disabled. CardForge emits sanitized paths and allow-listed semantic events; query strings are reduced to approved UTM fields for GA and omitted from PostHog. The owner-only Analytics Cockpit queries GA4, PostHog, and finalized Search Console data with least-privilege server credentials; it never exposes credentials, returns visitor identifiers, or stores raw visitor events.

Legal publication creates a new `(slug, version)` record bound to the current business-identity version. Existing versions are retained. CardForge does not currently track acceptance of revised terms; adding acceptance tracking, notice rules, and enforcement remains a separate product/legal decision.

## Keep It Minimal

When changing CardForge:

- Prefer one owner for each responsibility.
- Do not add compatibility exports or duplicate owners; preserve stored user/provider data through explicit migrations when required.
- Keep docs current and short.
- Keep tests focused on live money, access, export, data, and core authoring behavior.
- Keep implementation history in Git and pull requests rather than the live documentation tree.
