Warning: truncated output (original token count: 7691)
Total output lines: 169

# CardForge Architecture

Last updated: September 4, 2026

CardForge is a live local-first card production studio at `https://cardforges.com`. This document describes current product ownership and runtime invariants only. Historical rollout steps belong in Git/provider history; provider-specific ownership details belong in `docs/integrations.md`.

## Product truth

- Public product: `/`, `/about`, `/cameron`, `/roadmap`, `/contributors`, `/contact`, and legal pages.
- Creator environment: Desk at `/account` owns working context. Design, Generate, Output, Pipeline, and storage/location controls are lazy contextual tools layered over Desk or Library. `/studio` is compatibility ingress for an exact temporary Studio document and otherwise redirects to Desk Design.
- Desk tool launches resolve the focused Artifact, selected Artifact, or first card of the target Set from persisted card identities. Explicit revision and front/back editing choices take precedence. A launch waits for required Templates through the existing Library bootstrap, without replacing missing Templates or clearing a card back; changing focus cancels the pending launch. The context rail owns closing non-modal Desk tools, so their visually hidden headings contain no duplicate keyboard control.
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

Opening a Drive or folder package adds independently editable local identities without replacing other browser Sets, Templates, or assets. A single-Set package retains its provider binding under the imported Set identity for subsequent saves. Multi-Set packages retain the workspace binding. Imports acknowledge the final IndexedDB workspace transaction before reporting success; asset merges reject unreadable existing catalogs without replacing them. A failed browser commit leaves a Move's provider source intact.

Library reports partial availability when a source fails but collection objects remain usable. It preserves the source's failure and recovery details alongside those objects; a search with no matches does not turn partial availability into an empty or wholly unavailable collection.

CardForge does not operate a durable first-party creator backup lane. Cloud Set Mirror creation, updates, account promotion, and agent workflows are retired from the runtime. Production ownership was resolved before deletion: the two remaining mirrors belonged to the explicitly approved owner test accounts, and the mirror rows plus dedicated artwork bucket were erased through their Supabase-native owners. The now-empty legacy table and Studio lineage columns remain only until the runtime cut reaches production; a separate forward schema contraction removes them afterward so the old production runtime is never pointed at missing columns or tables.

### Supabase platform state

Server-only CardForge cod…4691 tokens truncated…ion boundaries used by browser Studio. There is no second agent template format, renderer, asset catalog, or publication path. Image generation produces standalone artwork only; CardForge Templates, card data, and the native renderer remain responsible for card/set assembly.

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
