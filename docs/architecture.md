# CardForge Architecture

Last updated: August 21, 2026

CardForge is a live local-first card production studio at `https://cardforges.com`. This document describes current product ownership and runtime invariants only. Historical rollout steps belong in Git/provider history; provider-specific ownership details belong in `docs/integrations.md`.

## Product truth

- Public product: `/`, `/about`, `/cameron`, `/roadmap`, `/developer`, `/contact`, and legal pages.
- Studio: `/studio` contains three product workspaces: Templates, Make Cards, and Sets.
- Account/access: Clerk identifies users; CardForge applies free, Creator Pass, Designer Pass, developer, and owner policy.
- Billing: Stripe owns Checkout, subscriptions, customers, webhooks, and Billing Portal state; CardForge maps eligible product subscriptions into application access.
- Shared platform state: Supabase owns CardForge shared records, private account cloud-set mirrors, and approved managed media.
- User projects: Templates, generated cards, project uploads, preferences, and project files use the browser-local workspace as the normal working copy. Signed-in users may explicitly mirror selected card sets to their private CardForge cloud library; arbitrary local workspace state is not automatically uploaded.
- Email: Resend owns delivery; CardForge owns support/developer request validation/routing/history.
- Analytics: GA4, PostHog, and Search Console own provider records; CardForge owns consent, event vocabulary, and owner report composition.
- Social publication: Meta owns external authorization/posts; CardForge owns approval, destination policy, scheduling, retries, and delivery history.

## Storage lanes

CardForge has four deliberate storage lanes.

### Browser workspace

`src/features/project` owns Zustand workspace state, IndexedDB persistence, account/guest scoping, recovery snapshots, storage-health handling, local project assets, and portable project files. The browser workspace remains the normal working copy, local sets remain unlimited, and there is no parallel localStorage compatibility owner.

### Account cloud set mirror

Signed-in users may explicitly back up selected CardForge sets to their account. Free accounts receive one cloud-set slot; Creator Pass, developer, and owner-grade access receive five. The quota limits cloud mirrors, not local creation.

`cardforge_cloud_sets` stores one private account-owned CardForge Transfer V1 set manifest per saved set, including its cards and required personal Templates. Embedded artwork is removed from that JSON manifest, content-hashed, and stored in the private `cardforge-cloud-set-assets` Supabase Storage bucket. A cloud set is capped at 128 MB total, including up to 3 MB of metadata and referenced artwork subject to CardForge's existing 8 MB-per-local-artwork ceiling.

Cloud artwork does not pass through Next.js request bodies. CardForge server routes authorize the account, enforce slot/storage limits, validate the manifest, and issue short-lived signed Supabase Storage URLs; the browser transfers the artwork directly to/from the private bucket. Loading a cloud set rehydrates the same Transfer V1 payload and merges it through the normal local CardForge import path. Removing a cloud mirror never deletes a device-local copy.

The cloud set layer is a durable account backup/cross-device mirror, not a second editor state store or a replacement for browser persistence.

### Supabase platform state

Server-only CardForge code reaches Supabase through `src/infrastructure/database/supabaseServer.ts`, preferring `SUPABASE_SECRET_KEY` with a deploy-safe legacy service-role fallback. Browser-direct database writes are not a product path; direct browser object transfers occur only through server-issued signed URLs.

Supabase stores owner/public settings, legal/business identity, roadmap/votes, billing ledgers, developer profiles/submissions/votes, asset registry state, campaign content/media/distribution history, contact history, private Studio documents, cloud-set manifests/private set artwork, and other shared control-plane records.

### Pipeline-owned Studio catalog

`cardforge_asset_registry` is the single runtime shared Studio catalog. `data/pipeline-bootstrap` is importer input only and `public/site-fallbacks` is public-page fallback art only; neither competes with the registry.

`npm run pipeline:sync-defaults` imports missing stable IDs and referenced media without overwriting owner decisions or recreating tombstoned assets. Code owns finite Studio destinations/compatibility; Supabase owns live placement, ordering, featured state, and owner overrides.

## Core ownership

- `src/domain`: pure Cards, Templates, Rendering, and Entitlements policy.
- `src/features/app-shell`: Studio shell and workspace bootstrap.
- `src/features/template-editor`: Template Studio session/draft lifecycle, canvas/layer/inspector commands, history, and native Template-library commands.
- `src/features/card-generator`: single/bulk card creation, generated output gallery, Studio Set Library composition, image controls, set/cloud-save controls, and exports.
- `src/features/card-rendering`: shared preview/rendering, rich text, vector shapes, thumbnails, appearance, and watermarks.
- `src/features/project`: browser workspace/persistence/recovery/assets/project files plus the account cloud-set mirror and its canonical Transfer V1 packing/hydration.
- `src/features/account`: current Clerk-backed user projection, entitlement surfaces, profile, and account administration.
- `src/features/billing`: Stripe checkout/portal/webhooks, product/support classification, durable billing event/subscription records, and reconciliation.
- `src/features/developer-access`: developer identity/profile status/contribution-scope owner and the only runtime access owner for developer profiles.
- `src/features/developer-assets`: Forge Review submissions, voting, revisions, publication, attribution, Studio routing, archive/recovery, and registry operations.
- `src/features/studio-documents`: private account Studio documents and agent authoring tools.
- `src/features/developer-program`: public contributor recruitment/explanation.
- `src/features/developer-cockpit`: protected contributor composition and site-copy proposal workflow; it does not absorb the features it composes.
- `src/features/marketing`: strategy, audiences, campaign containers, offer/claim policy.
- `src/features/marketing-content`: content packages, variants, canonical campaign media/derivatives/attachments, contributor workflow, review, and approval.
- `src/features/marketing-distribution`: destinations, encrypted provider connections, schedules, jobs, retries, manual-publication records, and provider-post mappings.
- `src/features/social-publishing`: stateless provider protocol adapters only.
- `src/features/public-site`: public copy, constrained navigation/home/SEO settings, public brand/marketing media, caches, and public presentation.
- `src/features/business-identity`: canonical operator identity.
- `src/features/legal`: immutable versioned legal publication.
- `src/features/contact`: contact/support routing and request history.
- `src/features/roadmap`: public roadmap, suggestions/voting, official status, settings, and owner roadmap operations.
- `src/features/analytics`: consent boundary, safe event contract, organic UTM policy, and owner provider reports.
- `src/features/experience-settings`: launch-time experience policy and sanitized public projection.
- `src/features/owner`: owner authorization, provider/database health, people/integration projections, append-only activity, and lazy composition of feature-owned controls.
- `src/infrastructure`: provider adapters and generic server infrastructure.
- `src/shared`: framework-independent utilities.
- `src/components/ui`: generic UI primitives.

Cross-feature consumers use declared public interfaces. `src/lib`, `src/store`, and `src/types` are retired root ownership lanes and must not return.

## Dependency rules

`npm run architecture:check` scans TypeScript imports and fails directly on ownership violations. There is no exception baseline.

- App Router composes features through declared interfaces.
- Features do not import App composition.
- Cross-feature imports use the target feature public interface.
- Client modules never import server interfaces.
- Domain/Shared/Infrastructure/generic UI retain one-way dependency direction.
- Feature dependency cycles are forbidden.
- Oversized files are review warnings, not automatic split requirements; split by responsibility when human traceability improves.

## Access model

- Free: local design/generation, one signed-in cloud-set slot, and whatever portable-project access the owner-controlled experience policy currently allows.
- Creator Pass: clean paid finished-output entitlement, portable-project access, and five cloud-set slots.
- Designer Pass: Creator Pass-grade Studio access and cloud storage plus the higher Designer MCP capacity target; it does not grant contributor access.
- Developer: Creator Pass-grade output, five cloud-set slots, plus contribution/pipeline capabilities according to active developer profile/scopes.
- Owner: owner console plus developer-grade tooling and five cloud-set slots.
- Public Clerk metadata is display-only; trusted access comes from Clerk private metadata and server-owned allowlists/policy.

Current account resolution uses Clerk's current-user identity directly; CardForge does not maintain a second session/profile fallback. Explicit user-id administration uses Clerk's Backend API.

## Card and Template model

Studio navigation has three product workspaces over the same project state. **Templates** owns reusable front Templates and separate card-back Templates. **Make Cards** owns active production for the currently selected set: its selected front Template/back, card values, generation, review, and export settings. **Sets** is the normal production library for browsing local sets, loading cloud mirrors into the local workspace, renaming/selecting sets, reviewing their cards, importing/exporting, backing up a set, and handing the selected set to Make Cards. Sets composes the existing `cardSets`, transfer, renderer, and cloud-mirror owners; it does not create another set registry. Account Storage remains the storage/account lens for device/cloud usage, storage location, AI drafts, and location-specific deletion rather than a second production set library. Generated cards own independent front `data` and back `backingData`; layouts remain reusable blueprints.

Text/image editability is expressed through native field contracts and real canvas elements. Image fields retain generator-side fit/position/scale/rotation/offset/flip controls.

Template canvas pointer semantics have one interaction owner in `useCanvasPointerInteractions`. A primary tap/click selects a layer; another quick tap/click while that selected layer remains under the pointer performs tap-through to the next visible overlapping layer, wrapping through the stack. Movement converts the same press into drag/resize instead of tap-through. Long-press and right-click use the same selected-layer context action, and multi-touch canvas gestures cancel any pending press. `TemplateEditableElement` renders/forwards interaction surfaces only; it does not own a separate gesture timer or mobile-only selection model. Canvas pinch/pan remains distinct from page, pane, sheet, and dialog scroll ownership.

Template side panels use `TemplatePanelWorkspace` as their shared navigation contract. Library and Inspector are focused by default: one section is active in a visually flat tool surface while the persistent top section menu remains visible. Pinning a section keeps it rendered while another section becomes active, so multi-section workspaces are explicit user composition rather than the default long-scroll layout. Inspector keeps active/pinned section memory and panel position for the ten most recently edited layer contexts during the editor session and filters remembered sections that the current layer type cannot use. On compact screens active Template editing is a canvas-first application viewport rather than a scrolling website page: Studio chrome is compressed, the page footer is removed from the editing viewport, editor controls/status remain in normal flow, and the live canvas stays visible beside the active panel. Portrait places the resizable panel below the canvas and landscape places it beside the canvas; the shared divider snaps to 28%, 40%, or 60%. `TemplatePanelWorkspace` owns compact panel close/resize behavior; there is no second outer overlay/backdrop or retired Inspector-tab navigation owner. Touch swipes on non-canvas stage space remain an optional Library/Canvas/Inspector shortcut while visible buttons remain the canonical navigation path. Desktop retains the three-column workspace with the same focused/pinned section model.

Shared structured Template revisions originate in Template Studio: developer edits become numbered Forge Review submissions while the published version stays live; owner edits record/publish the numbered revision atomically. Generic developer uploads accept media/fonts only rather than parallel JSON Template authoring.

## Developer pipeline

Developer submissions use one durable lifecycle from draft/submission through voting/review/publication, with archive/rejection paths. Published shared assets retain attribution and lineage. Owner permanent deletion removes active registry/submission/revision/vote/storage lineage and leaves only a private tombstone that prevents bootstrap recreation.

The pipeline is operational infrastructure, not an active payout program. Retired contributor identities remain presentation aliases for historical attribution; they are not active developers.

## Campaign and publication model

Campaign strategy, content, media, distribution, and provider protocol are separate owners. Campaign media has stable CardForge identity; storage object paths are server-only implementation detail. Approval creates provider-safe derivatives; protected originals/masters remain private.

Only `marketing-distribution` owns delivery state/retries/idempotency/history. `social-publishing` receives provider-safe payloads and returns provider results; it persists no campaign/connection/delivery state.

Extended contributor lanes and native Meta publication are independent owner-controlled gates and remain off until their production checklist passes.

## MCP / agent authoring

`/mcp` uses the MCP protocol and Clerk OAuth/token verification. Agent tools operate on the same private Studio documents, Template validation, production planning, library assets, renderer, and publication boundaries used by browser Studio. There is no second agent template format, renderer, asset catalog, or publication path. Image generation produces standalone artwork only; CardForge Templates, card data, and the native renderer remain responsible for card/set assembly.

Published MCP tools pair concise model-visible results with explicit output schemas. The MCP skills extension serves the packaged design and card/set `SKILL.md` files as static, digest-verified submission resources; the Markdown remains the single instruction owner for both the local plugin bundle and OpenAI import.

`mcp-usage` owns plan presentation, capacity targets, and usage observation; it does not create billing entitlements. The Owner Console is the only mutable source for plan names, descriptions, feature lines, CTA labels, visibility, and capacity targets. MCP access itself follows authenticated account identity: signed-out requests fail closed, signed-in Free/Creator/Designer accounts receive the shared Studio assistant scope, and approved developers or the owner must still pass the developer-access boundary for developer scopes. Tool telemetry fails open so an observation outage cannot break an otherwise authorized action. Because observation writes aggregate usage, every observed MCP tool declares a non-read-only side effect even when its product action only reads data. Successful user-visible mutations count as assisted actions; reads, previews, failures, and retries remain visible operational calls but consume no action unit. Numeric plan and storage targets are informational until a separately reviewed quota and billing policy is approved.

Private Studio documents remain the temporary revisioned collaboration surface for ChatGPT. Their owner-controlled inactivity windows default to 12 hours for Free, 24 for Creator, and 48 for Designer/owner/developer accounts. Only a real document open or update refreshes activity; account listing does not. Expired and manually deleted drafts enter 24-hour recoverable trash before an idempotent Supabase retention worker removes their complete private Storage prefix and database row. Raster artwork is normalized to WebP and content-addressed in a private Studio-document bucket rather than repeated as base64 inside JSON; short-lived signed URLs rehydrate the normal browser Studio handoff. Revision updates never eagerly delete unreferenced objects because a stale revision must not race a newer upload; the short draft lifecycle owns whole-prefix cleanup instead. Storage observation counts both the compact JSON and the real private object bytes. Account cloud-set saves are the separate durable backup/cross-device library, and the MCP read-only `list_cloud_sets` / `get_cloud_set` tools expose only sets the account intentionally saved there.

## Roadmap and voting

Supabase `cardforge_roadmap_items` and `cardforge_roadmap_votes` are the live roadmap source of truth. Official capabilities move through `planned`, `in_progress`, `testing`, and `shipped`; shipped records remain as completed history so votes/provenance are not lost. User suggestions may be archived for configured negative signal. Mistaken/duplicate rows may be deleted deliberately; completed legitimate work must not remain presented as future work.

## Owner console

The Owner Console composes six job-oriented workspaces: Overview, Marketing, Growth & People, Site Controls, Studio Library, and Governance. Feature modules remain authoritative for their data/mutations. Growth & People presents the plan catalog, capacity targets, and MCP usage observation owned by `mcp-usage`; the console only composes that authority. General Site Controls no longer carry a duplicate Creator Pass visibility switch. Owner does not become a parallel database, provider config system, or product-domain owner.

## Source of truth

Current code + these four docs + live provider state define CardForge. Old PRs/migration rollout notes/chat history are not required to understand current behavior. Keep completed deployment/cutover instructions out of live docs; preserve them in immutable Git/provider history.
