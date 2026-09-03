# CardForge Architecture

Last updated: September 1, 2026

CardForge is a live local-first card production studio at `https://cardforges.com`. This document describes current product ownership and runtime invariants only. Historical rollout steps belong in Git/provider history; provider-specific ownership details belong in `docs/integrations.md`.

## Product truth

- Public product: `/`, `/about`, `/cameron`, `/roadmap`, `/contributors`, `/contact`, and legal pages.
- Creator environment: Desk at `/account` owns working context. Design, Generate, Output, Pipeline, and storage/location controls are lazy contextual tools layered over Desk or Library. `/studio` is compatibility ingress for an exact temporary Studio document and otherwise redirects to Desk Design.
- Account/access: Clerk identifies users; CardForge applies free, Creator Pass, Designer Pass, contributor, and owner policy.
- Billing: Stripe owns Checkout, subscriptions, customers, webhooks, and Billing Portal state; CardForge maps eligible product subscriptions into application access.
- Shared platform state: Supabase owns CardForge shared records, temporary private Studio documents, and approved managed media.
- User projects: Templates, generated cards, project uploads, preferences, and project files use the browser-local workspace as the normal working copy. Durable copies belong in portable `.cardforge`/Set files, user-authorized local folders, or connected providers such as Google Drive; arbitrary local workspace state is not automatically uploaded.
- Email: Resend owns delivery; CardForge owns support/contributor request validation/routing/history.
- Analytics: GA4, PostHog, and Search Console own provider records; CardForge owns consent, event vocabulary, and owner report composition.
- Social publication: Meta owns external authorization/posts; CardForge owns approval, destination policy, scheduling, retries, and delivery history.

## Storage lanes

CardForge has four deliberate storage lanes.

### Browser workspace

`src/features/project` owns Zustand workspace state, IndexedDB persistence, account/guest scoping, explicit guest adoption before account hydration, revisioned compare-and-set writes, visible multi-tab conflict recovery, recovery snapshots, storage-health handling, local project assets, and portable project files. Persisted workspace and asset-catalog JSON retain account/project-scoped content-addressed references; mounted renderers and asset pickers acquire Blob object URLs on demand and release them after the last consumer. Browser package imports persist verified bytes directly as scoped Blobs and install references into runtime state instead of expanding package assets to Base64. Base64 data URLs remain accepted as legacy/input values and are externalized before persistence. When supported, CardForge reports the browser's current persistence state and offers a user-triggered `StorageManager.persist()` request with explicit “resilience, not backup” language. The browser workspace remains the normal working copy, local sets remain unlimited, and there is no parallel localStorage compatibility owner.

### User-owned durable locations

Portable Set/Project files, browser-authorized local project folders, and connected providers own durable creator copies outside the browser workspace. `src/features/project` owns the shared v2 project package writer, v1/v2 compatibility reader, archive safety bounds, and revision contracts; each location adapter owns only its native permission, read, write, remove, and conflict lifecycle. Device File System Access saves stream the archive directly; download, Pipeline, MCP, and Google Drive boundaries that require a complete body use the same writer's bounded Blob form without redundant byte-array copies. New Desk/Library saves isolate one Set per package so a work container keeps one stable CardForge identity while gaining multiple location records. The same validated `.cardforge` package owns import, export, provider transfer, Pipeline Set publication, and Published Set installation. Installing a published revision creates independently editable local identities; it does not introduce a starter schema, mutate Pipeline lineage, or create CardForge-owned durable creator storage. Google Drive stores work identity as `cardforgeWorkId` beside the exact provider and package revisions; updates preserve it even when an older Studio or MCP caller omits it. Local-folder writes are read back and decoded before CardForge reports success. Browser-only and local-folder work remain unavailable to remote agents unless the user explicitly hands it into the temporary Studio-document workspace or saves it to a server-reachable provider.

`src/features/storage-management/model/workLocations.ts` is the current human-facing capability owner for device, Google Drive, and local-folder destinations. Copy and Move are separate commitments: Copy leaves the source unchanged, while Move may remove the source only after the destination package has been written and verified. Unsupported provider-to-provider paths require opening a device copy first rather than pretending CardForge operates a universal sync layer. The default save-location preference is browser/workspace state, not provider authority.

CardForge does not operate a durable first-party creator backup lane. Cloud Set Mirror creation, updates, account promotion, and agent workflows are retired from the runtime. Production ownership was resolved before deletion: the two remaining mirrors belonged to the explicitly approved owner test accounts, and the mirror rows plus dedicated artwork bucket were erased through their Supabase-native owners. The now-empty legacy table and Studio lineage columns remain only until the runtime cut reaches production; a separate forward schema contraction removes them afterward so the old production runtime is never pointed at missing columns or tables.

### Supabase platform state

Server-only CardForge code reaches Supabase through `src/infrastructure/database/supabaseServer.ts`, preferring `SUPABASE_SECRET_KEY` with a deploy-safe legacy service-role fallback. Browser-direct database writes are not a product path; direct browser object transfers occur only through server-issued signed URLs.

Supabase stores owner/public settings, legal/business identity, roadmap/votes, billing ledgers, contributor profiles/submissions/votes, asset registry state, campaign content/media/distribution history, contact history, temporary private Studio documents, and other shared control-plane records.

### Pipeline-owned Studio catalog

`cardforge_asset_registry` is the single runtime shared Studio catalog and discovery index. A published Template's linked immutable `cardforge_contributor_asset_submissions.source_payload` revision owns its structured document; the registry stores only the active pointer, routing, access, ordering, and discovery metadata. Embedded Template media is normalized once into content-addressed WebP objects recorded by `cardforge_pipeline_template_assets`, while revision JSON stores `cardforge-pipeline-asset://` references. Database constraints prohibit embedded Base64 in Template revisions and prohibit registry metadata from cloning Template documents. `data/pipeline-bootstrap` is importer input only and `public/site-fallbacks` is public-page fallback art only; neither competes with the registry.

`npm run pipeline:sync-defaults` imports missing stable IDs and referenced media without overwriting owner decisions or recreating tombstoned assets. Code owns finite Studio destinations/compatibility; Supabase owns live placement, ordering, featured state, and owner overrides.

## Core ownership

- `src/domain`: pure Artifact, Card, Template, Rendering, and Entitlements policy. Set exposes a generic Artifact identity/type seam while current creation and type-specific payload rules remain card-specialized.
- `src/features/app-shell`: creator interaction sessions, feature-owned action execution, shared Environment shell, contextual-tool boundaries, and compatibility Studio ingress.
- `src/features/creator-workbench`: focused Design/Generate/Output/Pipeline composition and workspace bootstrap over native feature owners.
- `src/features/desk`: user-facing spatial Desk composition, select-first Set objects, stable world coordinates, group movement, marquee/touch/keyboard interaction, reflective organization, persistent Set/Artifact focus projection, context-rail actions, culling/LOD, ordered non-visual navigation, and return context over the native project and Library owners.
- `src/features/template-editor`: Template Studio session/draft lifecycle, canvas/layer/inspector commands, history, and native Template-library commands.
- `src/features/card-generator`: single/bulk card creation, generated-card editing, image controls, validation, and production exports. Desk remains the native presentation owner for Set/card organization.
- `src/features/card-rendering`: shared preview/rendering, rich text, vector shapes, thumbnails, appearance, and watermarks.
- `src/features/project`: browser workspace/persistence/recovery/assets, portable project/Set files, local-folder persistence, and connected-project adapters. Its client boundary is split by workspace, persistence, package, asset, provider, location, and UI responsibility.
- `src/features/account`: current Clerk-backed user projection, entitlement surfaces, ordinary signed-in account-tool capabilities, profile, and account administration.
- `src/features/billing`: Stripe checkout/portal/webhooks, product/support classification, durable billing event/subscription records, and reconciliation.
- `src/features/contributor-access`: Contributor identity/profile status/contribution-scope owner and the only runtime access owner for Contributor profiles. It does not gate ordinary signed-in Studio/agent work.
- `src/features/pipeline`: Forge Review submissions, voting, revisions, publication, attribution, Studio routing, archive/recovery, and registry operations.
- `src/features/studio-documents`: private account Studio documents and agent authoring tools.
- `src/features/contributor-program`: public contributor recruitment/explanation.
- Historical site-proposal records and legacy database columns remain retained for audit, but they are non-authoritative: the runtime no longer reads or writes a proposal grant, no current Owner control can enable one, and the compatibility API always fails closed with `site_proposal_retired`.
- `src/features/marketing`: strategy, audiences, campaign containers, offer/claim policy.
- `src/features/marketing-content`: content packages, variants, canonical campaign media/derivatives/attachments, contributor workflow, review, and approval.
- `src/features/marketing-distribution`: destinations, encrypted provider connections, schedules, jobs, retries, manual-publication records, and provider-post mappings.
- `src/features/social-publishing`: stateless provider protocol adapters only.
- `src/features/public-site`: public copy, constrained navigation/home/SEO settings, public brand/marketing media, caches, public presentation, and server-gated contextual Owner editing on the native public surfaces. Anonymous RSC output never includes Owner controls or unpublished control payloads.
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

Cross-feature consumers use declared public interfaces. `src/lib`, `src/store`, and `src/types` are retired root ownership lanes and must not return. The architecture report also prints feature fan-in/fan-out and public-interface export breadth as dependency-gravity review evidence; these are visibility signals, not arbitrary hard caps.

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

- Free: local design/generation and whatever portable-project access the owner-controlled experience policy currently allows.
- Creator Pass: clean paid finished-output entitlement and portable-project access.
- Designer Pass: Creator Pass-grade Studio access plus the higher Designer MCP capacity target; it does not grant contributor access.
- Contributor: Creator Pass-grade output plus contribution/Pipeline capabilities according to the active contributor profile and granted scopes.
- Owner: protected Profile operations plus contributor-grade tooling.
- Public Clerk metadata is display-only; trusted access comes from Clerk private metadata and server-owned allowlists/policy.

`src/features/account/lib/accountExperience.ts` projects those independent axes into the shared product surfaces: plan (`free`, `creator`, or `designer`), active scoped contribution access, and explicit owner authority. Desk, Library, and Profile remain the same navigation environments for every account; catalog visibility, portable-project capability, Pipeline scope/actions, focused Studio capabilities, and owner governance layer onto them. A `contributor` entitlement without an active Contributor profile grants no contribution surface, and every Forge Review HTTP mutation independently requires its exact contribution scope. In the Environment vocabulary, `member` means any signed-in account and never means Creator Pass.

Current account resolution uses Clerk's current-user identity directly; CardForge does not maintain a second session/profile fallback. Explicit user-id administration uses Clerk's Backend API.

## Card and Template model

Desk is the persistent creator environment. Set focus expands the selected Set object inside the same scene and exposes its saved Artifact organization; the original Set stack remains as the visual anchor. Choosing an Artifact keeps the Set field mounted as a dimmed spatial context while a camera-fitted rendering of that Artifact moves to the foreground. One context rail owns the changing Desk → Set → Artifact → tool identity and the actions appropriate to that depth. Back/Escape unwinds Artifact → Set → Desk while restoring the prior camera and selection, but an open menu or selector consumes Escape before navigation. Design promotes the focused object into the precision canvas inside the Environment rather than opening a second application. Generate, Output, and Pipeline use non-modal desktop docks or compact mobile sheets so the creative scene remains visible; provider handoffs and consequential confirmations remain genuinely modal. The interaction session's `CreatorToolPresentation` is the only tool-presentation contract. The shared host restores focus, unwinds history, isolates tool crashes, and can reject a dirty close without imposing a modal focus trap on routine creative tools. Template Editor still owns reusable front Templates and separate card-back Templates; Card Generator owns one single/bulk generation runtime, rendered-card editing, validation, and output. Project owns Set identity, tags, grouping/sort, freeform positions, browser persistence, packages, folders, and Drive transfers. Pipeline owns submission and publication. `/studio` translates exact agent/temporary-document handoffs into Desk Design; it is not a second active creator application. In current domain truth, `Set` is the one authored-work container and contains generalized Artifacts, with cards the first shipped specialized type. Provider/package surfaces may still call the same container a project, but CardForge does not model a separate Project parent or registry.

Account Desk, Library, and Profile use the shared CardForge Environment shell and its stable zone rail, searchable action palette, aligned object/setting rows, detail inspector or mobile sheet, and boundary vocabulary. Desk adds a persistent context rail beneath the zone band; focused mobile work hides the global bottom navigation so orientation and creative actions do not compete for the viewport. Desk is a constrained spatial surface over meaningful local Sets plus recent provider or temporary work. One activation selects, deliberate Open enters, multi-selection moves as a relative group, and Back restores the parent selection/camera. Filters project visibility; meaningful Template-backed facets group; explicit Arrange alone mutates positions. A new workspace contains no Set until the user explicitly creates or imports one. Library uses the same preview owner and pools device, Google Drive, and attached-folder location records under the Set identity instead of presenting a second Project object. It remains a combined read model and owns no bytes, sync protocol, or second content registry. **Storage & connections** is a focused Library tool that composes browser, local-folder, Google Drive, personal-library, and temporary-draft lifecycle owners while keeping every default, save, transfer, reconnect, detach, and location-specific deletion scoped to the named source. **Profile** leads with identity, independent commercial plan, Contributor/Owner authority, temporary grants, usage, and provider health. Generated cards own independent front `data` and back `backingData`; layouts remain reusable blueprints.

Text/image editability is expressed through native field contracts and real canvas elements. Image fields retain generator-side fit/position/scale/rotation/offset/flip controls.

Template canvas pointer semantics have one interaction owner in `useCanvasPointerInteractions`. A primary tap/click selects a layer; another quick tap/click while that selected layer remains under the pointer performs tap-through to the next visible overlapping layer, wrapping through the stack. Movement converts the same press into drag/resize instead of tap-through. Long-press and right-click use the same selected-layer context action, and multi-touch canvas gestures cancel any pending press. `TemplateEditableElement` renders/forwards interaction surfaces only; it does not own a separate gesture timer or mobile-only selection model. Canvas pinch/pan remains distinct from page, pane, sheet, and dialog scroll ownership.

Template side panels use `TemplatePanelWorkspace` as their shared navigation contract. Library and Inspector are focused by default: one section is active in a visually flat tool surface while the persistent top section menu remains visible. Pinning a section keeps it rendered while another section becomes active, so multi-section workspaces are explicit user composition rather than the default long-scroll layout. Inspector keeps active/pinned section memory and panel position for the ten most recently edited layer contexts during the editor session and filters remembered sections that the current layer type cannot use. On compact screens active Template editing is a canvas-first application viewport rather than a scrolling website page: Studio chrome is compressed, the page footer is removed from the editing viewport, editor controls/status remain in normal flow, and the live canvas stays visible beside the active panel. Portrait places the resizable panel below the canvas and landscape places it beside the canvas; the shared divider snaps to 28%, 40%, or 60%. `TemplatePanelWorkspace` owns compact panel close/resize behavior; there is no second outer overlay/backdrop or retired Inspector-tab navigation owner. Touch swipes on non-canvas stage space remain an optional Library/Canvas/Inspector shortcut while visible buttons remain the canonical navigation path. Desktop retains the three-column workspace with the same focused/pinned section model.

Shared structured Template revisions originate in Template Studio: contributor edits become numbered Forge Review submissions while the published version stays live; owner edits record/publish the numbered revision atomically. Generic contributor uploads accept media/fonts only rather than parallel JSON Template authoring.

## Contributor Pipeline

Contributor submissions use one durable lifecycle from draft/submission through voting/review/publication, with explicit contributor withdrawal and retirement plus owner archive/rejection/purge paths. `cardforge_pipeline_asset_lineages` owns stable identity across revisions and registry publication. Contributor lifecycle state is durable so automatic rebalance cannot silently republish withdrawn work; an audited Owner override may recover it. Retiring the exact current published revision removes it from new discovery while existing installed copies remain usable. The Pipeline Library shows current, candidate, published, and immutable revision history on the same object. Structured Template/style payloads, registry preview derivatives, raster images, fonts, and package fallbacks resolve through typed owners; direct contributor SVG upload is rejected while normalized CardForge-owned SVG catalog assets remain supported. The official Standard 52-card deck is a normal free published Set package and the primary end-to-end fixture, not a tutorial schema. Owner permanent deletion remains the only full lineage/storage purge and leaves a private tombstone.

The pipeline is operational infrastructure, not an active payout program. Retired contributor identities remain presentation aliases for historical attribution; they are not active contributors.

Profile owner operations control both monthly submission count and the maximum source-file size for Forge Review media/font candidates. Source files upload directly through short-lived signed Supabase Storage URLs, then the server verifies account ownership, object size, file policy, remaining allowance, and pipeline metadata before committing the submission. This keeps production-quality sources out of Vercel Function request bodies. The Storage bucket enforces the 50 MB platform hard ceiling; the owner may choose a lower CardForge ceiling. Failed finalization compensates the uploaded object, and the browser also requests cleanup for an unfinished attempt.

## Boundary failures

CardForge uses one reusable boundary vocabulary across browser UI, HTTP APIs, and agent-facing tools: authentication, authorization, invalid input, conflict, not found, limit, and unavailable. API errors include a stable code and kind, retryability, a correlation id, and optional next-action, retry timing, or structured limit metadata. Provider failure must never masquerade as a lower entitlement or missing user-owned content. Tolerant reads remain appropriate for optional visual lists; portability, provider, billing, entitlement, and permission boundaries use strict reads and explicit failures.

## Campaign and publication model

Campaign strategy, content, media, distribution, and provider protocol are separate owners. Campaign media has stable CardForge identity; storage object paths are server-only implementation detail. Approval creates provider-safe derivatives; protected originals/masters remain private.

Only `marketing-distribution` owns delivery state/retries/idempotency/history. `social-publishing` receives provider-safe payloads and returns provider results; it persists no campaign/connection/delivery state.

Extended contributor lanes and native Meta publication are independent owner-controlled gates and remain off until their production checklist passes.

## MCP / agent authoring

`/mcp` uses the MCP protocol and Clerk OAuth/token verification. Agent tools operate on the same private Studio documents, Template validation, production planning, library assets, renderer, and publication boundaries used by browser Studio. There is no second agent template format, renderer, asset catalog, or publication path. Image generation produces standalone artwork only; CardForge Templates, card data, and the native renderer remain responsible for card/set assembly.

Published MCP tools pair concise model-visible results with strict output schemas that accept the complete runtime `structuredContent`; schema and payload changes ship under one MCP contract version. Revision-bound Studio links name the exact server revision, and Studio records installation only after the browser has applied the local project change and the acknowledgement request succeeds. A failed acknowledgement leaves the revision link recoverable for retry and must not be reported as server-confirmed. The MCP skills extension serves the packaged design and card/set `SKILL.md` files as static, digest-verified submission resources; the Markdown remains the single instruction owner for both the local plugin bundle and OpenAI import.

`mcp-usage` owns plan presentation, capacity targets, and usage observation; it does not create billing entitlements. Profile owner operations provide the only mutable surface for plan names, descriptions, feature lines, CTA labels, visibility, and capacity targets. MCP access itself follows authenticated account identity: signed-out requests fail closed, signed-in Free/Creator/Designer accounts receive the shared Studio assistant scope, and approved contributors or the owner must still pass the contributor-access boundary for contributor scopes. Tool telemetry fails open so an observation outage cannot break an otherwise authorized action. Because observation writes aggregate usage, every observed MCP tool declares a non-read-only side effect even when its product action only reads data. Successful user-visible mutations count as assisted actions; reads, previews, failures, and retries remain visible operational calls but consume no action unit. Numeric plan and storage targets are informational until a separately reviewed quota and billing policy is approved.

Private Studio documents remain the temporary revisioned collaboration surface for ChatGPT. Their owner-controlled inactivity windows default to 12 hours for Free, 24 for Creator, and 48 for Designer/owner/contributor accounts. Only a real document open or update refreshes activity; account listing does not. Expired and manually deleted drafts enter 24-hour recoverable trash before an idempotent Supabase retention worker removes their complete private Storage prefix and database row. Raster artwork is normalized to WebP and content-addressed in a private Studio-document bucket rather than repeated as base64 inside JSON; short-lived signed URLs rehydrate the normal browser Studio handoff. Revision updates never eagerly delete unreferenced objects because a stale revision must not race a newer upload; the short draft lifecycle owns whole-prefix cleanup instead. Storage observation counts both the compact JSON and the real private object bytes. Durable agent commits use provider-authorized project files with exact provider and CardForge revisions; temporary documents never become silent permanent backups.

## Roadmap and voting

Supabase `cardforge_roadmap_items` and `cardforge_roadmap_votes` are the live roadmap source of truth. Official capabilities move through `planned`, `in_progress`, `testing`, and `shipped`; shipped records remain as completed history so votes/provenance are not lost. User suggestions may be archived for configured negative signal. Mistaken/duplicate rows may be deleted deliberately; completed legitimate work must not remain presented as future work.

## Owner operations

Profile composes three protected cross-product groups for owners: Overview, Growth & People, and Governance. Campaign strategy, approval, distribution, and results live in Library → Campaigns; Pipeline objects, publication controls, Contributor program policy, routing, and Content Health live in Library → Pipeline. Site settings, modeled public copy, and relevant media publish contextually on the public homepage, while Roadmap rules and item-status changes live on `/roadmap`; Profile presents only a read-only Roadmap summary and navigation. Profile People writes commercial plan, Contributor authority, and Owner authority independently. `/owner` remains permission-gated compatibility ingress, not a fourth navigation environment.

## Source of truth

Current code + these four docs + live provider state define CardForge. Old PRs/migration rollout notes/chat history are not required to understand current behavior. Keep completed deployment/cutover instructions out of live docs; preserve them in immutable Git/provider history.

## Canonical rendering doctrine

CardForge has one canonical visual rendering implementation. Templates and structured card data are interpreted only by the browser CardPreview/export pipeline. Studio exports, assistant previews, and future downstream output systems must reuse artifacts produced by that renderer or invoke that exact renderer with an explicit profile; integrations must not independently reinterpret Templates for convenience.

Canonical render artifacts are immutable derivatives bound to source identity, source revision, render subject, face, output profile, and a renderer contract version. A source revision can therefore remain unchanged while a renderer fix produces a new derivative contract, preventing stale pixels from surviving a rendering bug fix. Private render artifacts are cache/output data, not a second source of truth.

MCP static creative review returns these exact CardForge-rendered artifacts as native image content. Rich widget/iframe UI is reserved for interactions that actually require persistent controls; displaying a finished CardForge render does not. Set contact sheets may compose canonical card PNGs downstream, but they must never re-render or reinterpret the underlying Template.
