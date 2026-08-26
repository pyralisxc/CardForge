# CardForge Product Surface Map

Last updated: August 24, 2026

This document is the canonical placement map for CardForge's user-facing and operator-facing capabilities. It answers two questions: **where does this belong?** and **what is it doing there?**

The current visual alpha family for this model lives in [`assets/brand/cardforge-studio/concepts/`](../assets/brand/cardforge-studio/concepts/): Home, Library, Studio, Profile, Developer, and Owner. These images are hierarchy and interaction-direction references, not a claim that the shown interfaces are implemented.

`docs/architecture.md` remains authoritative for shipped runtime behavior. `docs/product-direction.md` remains authoritative for intended product direction and delivery order. This map connects those truths without presenting planned work as shipped.

## Status and shape language

- **Shipped:** present in the current application or provider-backed product.
- **Direction:** approved target shape that should guide redesign and consolidation.
- **Future:** credible later capability that is not yet an implementation commitment.
- **Zone:** a durable environment with its own primary object, posture, and permission boundary.
- **Object:** work a person can pick up, inspect, change, organize, or move.
- **Tool:** an action applied to an object or zone. A tool is not automatically a destination.
- **Layer:** temporary detail shown over or beside the active object without abandoning its context.
- **Queue:** ordered work that needs attention, review, or follow-up.
- **Service:** a cross-zone capability whose lifecycle is owned once and surfaced where relevant.

The inventory is intentionally organized by meaningful product capability rather than by route, API endpoint, or source file. Internal methods that serve the same user job are one feature family here.

## Scope and parity contract

The alpha environment family is product scope for hierarchy, placement, and interaction direction. It is not permission to simplify CardForge by omitting mature behavior.

- Every **Shipped** capability remains available through the redesign until a separately approved retirement, migration, or provider-native replacement is complete.
- Consolidating destinations may relocate a feature, turn a page into a tool or layer, or combine several entry points. It must not make the feature undiscoverable, remove its failure states, or strand authored work.
- A feature may be removed only when the product direction explicitly names the cold cut, identifies the replacement, protects existing user data, and records the rollout boundary. The planned CardForge cloud Set-mirror retirement is one such explicit transition; it is not precedent for incidental feature loss.
- Advanced actions may move into inspectors, menus, command access, or scoped tools, but normal expected actions must remain visible at the object or queue where a user would look for them.
- Human and MCP surfaces must resolve to the same object owner, permissions, revision rules, validation, and outcomes even when their interaction styles differ.
- Any implementation that adds, moves, retires, or materially changes a user-facing capability updates this document in the same change. `docs/architecture.md` is updated when shipped behavior actually changes.

Before retiring an old navigation surface, compare its complete shipped action set with the target zone. The cut is ready only when every action is either preserved in its recorded home or explicitly retired through the rule above.

## Canonical environment map

| Environment | Kind | Primary object or question | Product role |
| --- | --- | --- | --- |
| Public site | Entrance, not a private zone | “What is CardForge, and should I enter?” | Explain the product, show proof, publish trust and policy, and route people into Studio or an account. |
| Home | Zone | “What needs my attention, and where was I?” | Orient the person, resume recent work, and expose only the most relevant account or workflow status. |
| Library | Zone | “What do I own or have access to?” | Pool projects, Sets, Templates, assets, and temporary drafts into one searchable inventory independent of storage location. |
| Studio | Zone | “What am I making right now?” | Make the active Set or project the desk; author, generate, organize, inspect, validate, and output its objects in place. |
| Profile | Zone | “Who am I here, and what follows me?” | Manage identity, security, personal defaults, access, and compact account utilities. |
| Developer | Protected zone | “What am I contributing to CardForge?” | Prepare reviewable library assets, campaigns, and site proposals under explicit scopes and standards. |
| Owner | Protected zone | “How is CardForge operating?” | Run the business, public experience, shared library, people, marketing, governance, and provider readiness. |
| Production | Future candidate zone | “What is being manufactured or fulfilled?” | Become a separate environment only after CardForge owns durable quotes, orders, status, proofs, and reorders. Until then, production and export remain Set tools in Studio. |

This keeps the permanent navigation small. Storage, billing, export, review, settings, integrations, specialties, and AI are capabilities inside these environments—not extra top-level places.

## Shared zone UI grammar

The six alpha screens are one interface family. Reuse the same shell and interaction vocabulary across zones to reduce code, relearning, and visual drift while letting each zone remain faithful to its own object or queue.

| Shared part | Contract across zones |
| --- | --- |
| Zone rail | One stable ordered destination rail for Home, Library, Studio, and Profile, followed by permission-separated Developer and Owner destinations. Hidden permissions remove inaccessible destinations without changing the order of the remaining core zones. |
| Command band | One compact top band owns zone identity, current workspace/object switching, global search or commands, and the strongest valid creation or continuation action. |
| Primary surface | One current object, collection, or queue dominates. Home centers resumable work; Library centers inventory; Studio centers the Set Desk; Profile centers the person; Developer centers a contribution; Owner centers an accountable action queue. |
| Comparable information | Use aligned rows, ledgers, tables, groups, and fine dividers. Do not turn every fact, status, or setting into a card. |
| Authored objects | Use thumbnail, document, package, stack, or spatial-object treatment only when the thing is genuinely selectable and independently actionable. |
| Context detail | Selecting an object raises or highlights it and opens a consistent inspector/dock/sheet for metadata, dependencies, history, locations, permissions, and secondary actions. Closing detail restores the prior position and selection. |
| Actions | Use the same scope order everywhere: primary action, one or two supporting actions, then a predictable overflow for advanced actions. Destructive, financial, permission, and publication commitments receive explicit confirmation. |
| Status and failure | Use one semantic status vocabulary and preserve boundary meaning: unavailable, authentication required, not permitted, invalid input, conflict, not found, limit reached, and retryable failure. Color never carries meaning alone. |
| Responsive behavior | Compact and mobile layouts preserve the same object hierarchy. Rails become compact navigation, inspectors become sheets or focused views, and ledgers become dense stacked rows—not a long series of oversized cards. |

Shared presentation components should own the rail, command band, ledger/row rhythm, contextual inspector frame, action hierarchy, status language, and responsive transitions. Feature modules continue to own their actions, data, validation, permissions, and provider boundaries. Consistency means a shared way to operate CardForge; it does not mean forcing every zone into the same content layout.

## Public site: the entrance

| Capability | Status | Home and behavior |
| --- | --- | --- |
| Product landing and outcome proof | Shipped | Public home explains structured card production, shows examples and workflow proof, and leads into Studio. |
| About and founder presence | Shipped | About and Cameron surfaces establish the operator, product intent, and social destinations. |
| Plans and access comparison | Shipped | Public plan presentation explains Free, Creator, and Designer access without owning billing state. |
| Developer program | Shipped | Public developer surface explains contribution access and routes approved contributors into the Developer zone. |
| Creator Pool | Shipped | Public participation surface explains the relevant creator program and terms. |
| Roadmap, voting, and shipped history | Shipped | Public roadmap presents official work, suggestions, votes, funding checkpoints, and completed history from live roadmap records. |
| Contact and support request | Shipped | Public contact validates and routes support/developer inquiries while preserving delivery history server-side. |
| Legal and policy publications | Shipped | Terms, privacy, accessibility, refunds, Creator Pass, supporter, and developer publications communicate current binding policy. |
| Authentication entry | Shipped | Sign-in and sign-up use Clerk and return the person to the intended protected destination. |
| Public navigation, content, SEO, media, and structured data | Shipped | The public shell presents owner-approved content and media within code-owned routes, validation, accessibility, and capability claims. |
| Consent-aware analytics | Shipped | Public and product surfaces emit only the approved sanitized analytics vocabulary after consent. |
| Specialty storytelling | Direction | Public proof should explain the active Specialty and Kits through finished outcomes rather than expose internal editor complexity. |

The public site is not another workspace. It is the front door to the workspace system.

## Home zone: orientation and return

| Capability | Status | Home and behavior |
| --- | --- | --- |
| Recent and resumable work | Shipped foundation | The account home uses the unified Library read model to surface recent Sets, projects, and working drafts. |
| Continue work | Shipped foundation | Resume a local Set, connected project, cloud-only Set, or temporary draft through the action appropriate to its location and state. |
| Access and security status | Shipped | Compact status rows report current plan/access and Clerk-backed account security without turning either into a dashboard of cards. |
| Studio, Library, Profile, Developer, and Owner entry | Shipped foundation | Relevant destinations are reachable from the account shell and utilities; protected entries appear only when granted. |
| Attention strip | Direction | Show a small ordered list of meaningful interruptions: expiring AI work, reconnect-required storage, conflicts, failed exports, pending review, or provider unavailability. Empty status should stay quiet. |
| Active desk preview | Direction | Show the last active Set or project as one strong resume target rather than a gallery of equal cards. |
| Personal shortcuts | Direction | Offer compact actions such as New Set, Open Studio, Import project, and Search Library based on recent behavior and capability. |

Home is a landing surface, not a second Library, Profile, or Owner overview. It summarizes and routes; the owning zone does the work.

## Library zone: possession, retrieval, and location

### Objects in the Library

| Capability | Status | Home and behavior |
| --- | --- | --- |
| Unified inventory | Shipped | Pool local Sets, CardForge cloud mirrors, Google Drive projects, attached local folders, connected personal assets, and temporary Studio drafts into one read model. |
| Sets | Shipped | Show card count, revision, locations, update time, size when known, and actions to open or manage the Set. |
| Projects | Shipped | Show durable `.cardforge` projects from Google Drive and attached local folders, including revision and attachment state. |
| Personal assets | Shipped | Index explicitly authorized Google Drive artwork, frames, and fonts without copying or deleting the provider source. |
| Working drafts | Shipped | Show private Studio/assistant documents with revision, creation source, expiry, and continue/install status. |
| Templates and shared Studio resources | Shipped foundation | Shared registry content, personal Templates, fonts, styles, and approved assets already feed Studio; the Library should expose them as first-class reusable objects. |
| Search, kind filters, and location filters | Shipped foundation | Find work by name and narrow it by object kind and source while keeping one inventory. |
| Object detail layer | Shipped foundation | The selected Library object opens compact desktop detail or a mobile sheet for available metadata, location, and actions instead of expanding every row into a card. Rich dependency, permission, and history detail remains direction. |
| Grouping and saved views | Direction | Group by project, Set, Template, tag, Specialty, Kit, source, or recent use without changing the underlying ownership. |
| Dependency view | Direction | Show which Sets and artifacts use a Template, asset, font, back, or provider profile before changing or removing it. |
| Specialty-aware discovery | Direction | Prioritize compatible Templates, semantic components, icons, fonts, and assets for the active Specialty while preserving global search. |

### Location and connection tools

| Capability | Status | Home and behavior |
| --- | --- | --- |
| Browser workspace health | Shipped | Report actual browser persistence availability, usage when available, recovery state, and real write/read failures. It is not a metered CardForge quota. |
| Portable project files | Shipped | Import, export, merge, and replace `.cardforge` project packages with explicit conflict and recovery behavior. |
| Local project folder | Shipped | Attach a folder, save and reopen the current project, report permission state, and disconnect without deleting authored work. |
| Google Drive projects | Shipped | Connect Drive, create/list/open/commit project files with provider revision checks, and disconnect without deleting Drive content. |
| Connected personal asset library | Shipped | Add or remove Drive file references by semantic role; removal only changes CardForge's index. |
| CardForge cloud Set mirror | Shipped, retiring | Current private Set backup with slots, metadata/artwork limits, revision-safe load/save, and explicit removal. The approved direction removes this durable mirror after protected migration because Drive, local folders, browser work, and portable packages own durable creator storage. |
| Temporary AI workspace | Shipped foundation, Direction | Private Studio documents use plan-based capacity, retention, expiry, recoverable trash, and revision-safe handoff. Present this as temporary working space, never as durable project storage. |
| Locations and connections tool | Shipped | One compact Library tool presents browser, cloud, draft, local-folder, Google Drive project/asset, and usage sources with their available status and native actions. |
| Per-object location manager | Direction | One compact layer attached to the selected Library object shows every copy/reference and the valid connect, reconnect, save, move, detach, or delete-from-location action. |
| Save-to destination chooser | Direction | At creation, handoff, and export boundaries, choose browser, project package, local folder, Google Drive, or a future provider through one consistent location picker. |

Storage is a tool of the Library. The Library is about the work; locations explain where that work currently lives.

## Studio zone: the active Set Desk

### Current creation foundation

| Capability | Status | Home and behavior |
| --- | --- | --- |
| Browser-local working copy and recovery | Shipped | IndexedDB workspace state, scoped persistence, snapshots, assets, fonts, preferences, and storage-failure reporting keep normal editing local-first. |
| Template Studio | Shipped | Create and edit front/back Templates on a canvas with layers, library, inspector, variables, dimensions, styles, and preview. |
| Element authoring | Shipped | Add and edit text, rich text, images, icons, vector shapes, dividers, frames, and semantic field bindings with alignment and transform controls. |
| Template library | Shipped | Browse bootstrap, shared reviewed, and personal Templates; create, duplicate, revise, import, export, and route eligible work into review. |
| Single-card generation | Shipped | Bind one structured record to a selected Template and generate the result into the active Set. |
| Bulk generation | Shipped | Parse CSV, map fields, resolve missing data, preview validation, and generate many records into the active Set. |
| Set management | Shipped | Create, rename, select, import, export, and inspect Sets with front/back Template relationships. |
| Card gallery and editing | Shipped | Inspect generated cards, edit record data, preview exact rendering, share, and download individual cards. |
| Set output | Shipped | Export individual PNGs, ZIP bundles, print PDF, contact-sheet-style outputs, and Tabletop Simulator spritesheets with quality and layout controls. |
| Watermark and clean-export policy | Shipped | Rendering applies the authoritative entitlement policy consistently across preview, download, share, and bulk output. |
| Studio document handoff | Shipped | Open a revision-specific private Studio/assistant draft, hydrate assets, preview it with the canonical renderer, and install it into the normal workspace. |
| Command palette and responsive controls | Shipped foundation | Template commands, mobile canvas controls, confirmations, banners, and first-run guidance provide alternate ways to operate the current editor. |

### Target Set Desk

| Capability | Status | Home and behavior |
| --- | --- | --- |
| Active Set as the desk | Direction | Opening Studio reveals the current Set/project viewport, not three disconnected top-level tabs. The work occupies the surface; chrome stays compact. |
| Mixed artifact surface | Direction | Place multiple Template masters, card instances, shared backs, rules pages, packaging surfaces, tokens, boards, and reference artifacts in one navigable workspace. |
| Pick up, inspect, and put down | Direction | Selecting an object raises it in place and opens the smallest useful context dock; closing detail returns it to the same spatial/group context. |
| Multi-Template authoring | Direction | A Set can contain multiple front systems, backs, and non-card masters. Any selected Template receives full canvas, layer, variable, and inspector power. |
| Variant generation | Direction | Generate one or many variants from the selected Template or record flow, reuse the current bulk-mapping strength, and place results visibly into the active Set. |
| Stacks and groups | Direction | Automatically or manually group objects by Template, type, tag, deck, collection, artifact role, status, or user-defined grouping; expand, collapse, reorder, split, and combine without losing identity. |
| Scope-aware actions | Direction | Edit, duplicate, validate, tag, move, share, and export work consistently on one object, a selection, a group, an artifact, a Set, or the whole project. |
| Fast Set switching | Direction | Switch Sets without leaving Studio; preserve viewport, selection, unsaved state, and return position per Set. |
| Shared identity and variables | Direction | Game, Set, Product, Artifact, and Record values update every bound object while making intentional local overrides visible. |
| Set health and preflight | Direction | Show missing dependencies, invalid records, duplicate numbering, unresolved assets, unsafe layout, provider-profile mismatch, and stale revisions at the relevant scope. |
| History and recoverability | Direction | Revision, undo/redo, snapshots, conflicts, import previews, and destructive confirmations preserve authored work across local, provider, and agent boundaries. |
| Specialty mode | Direction | The active Specialty configures vocabulary, Kits, artifact recipes, semantic components, validation, library ranking, and output profiles without forking the core Studio. |
| Kit start and expansion | Direction | Start from a coordinated Kit or blank Set, then add artifacts without replacing the user's work with a wizard-owned path. |
| AI collaboration layer | Direction | Agents create or revise structured objects through the same schema, renderer, revision rules, assets, and handoff used by Studio. Temporary AI work is visibly temporary until saved into a durable destination. |

### Games Specialty capability families

| Capability | Status | Home and behavior |
| --- | --- | --- |
| Playing, tarot/oracle, collectible, prototype, RPG/reference, and prompt/trivia Kits | Direction | Coordinated starter Sets combine suitable Templates, records, shared backs, and expected supporting artifacts. |
| Game, Set, deck, artifact, and product hierarchy | Direction | Stable objects organize cards and other artifacts without leaving loose generated cards as a second model. |
| Rules artifacts and lexicon | Direction | Rules cards, reference sheets, fixed-page booklets, semantic rules components, and shared terms live beside the objects they govern. |
| Packaging | Direction | Provider-backed dielines, semantic panels, safe-area guides, identity bindings, and preflight produce package artwork without claiming structural or legal certification. |
| Boards, tokens, tiles, and player aids | Future | Reuse the structured record, Template, asset, validation, and output foundations with deliberate artifact-specific geometry and performance contracts. |
| Game component manifest | Direction | One manifest coordinates designed and externally supplied components, quantities, references, packaging copy, rules setup, and later fulfillment preparation. |
| Playtest support | Direction | Version markers, printable proxy output, playtest groups, notes, and reference artifacts keep physical iterations distinguishable. |
| Project and Set packages | Direction | Portable project packages carry the full project; Set packages carry one Set plus exact dependencies with add, merge, and explicit replace behavior. |
| Print and provider profiles | Direction | Exact provider dimensions, dielines, file requirements, checks, and output bundles are selected at export/production time rather than baked into general Templates. |

Templates, Make Cards, and Sets remain valuable capabilities, but they become work modes and tools inside one Set Desk rather than three competing destinations.

## Profile zone: identity and personal continuity

| Capability | Status | Home and behavior |
| --- | --- | --- |
| Identity and profile details | Shipped | Clerk owns name, email, avatar, and verified identity; CardForge presents them in the product environment. |
| Sign-in methods, devices, sessions, and security | Shipped | Clerk's native management surface owns security-sensitive account operations. |
| Plan and billing | Shipped | Show current CardForge access and usage, then hand checkout, invoices, payment methods, plan changes, and cancellation to Stripe's native Checkout or Billing Portal. |
| Usage and temporary AI allowance | Shipped | Present current MCP/assistant plan limits without confusing them with durable storage or browser capacity. |
| Developer and owner access status | Shipped | Explain granted contributor/owner authority and route to the correct protected zone. |
| Personal Studio defaults | Direction | Keep durable preferences such as presentation, default Specialty/Kit, output profile, and accessibility choices with the person when ownership is clear. Project-specific settings remain with the project. |
| Connections summary | Direction | Show connected providers and security state compactly, then open the selected connection in Library's location manager. |
| Data and account lifecycle | Direction | Provide clear export, disconnection, deletion, retention, and support paths through the service that actually owns each datum. |

Plan, billing, security, and connections should read as compact utilities around the person—not as four more dashboard zones.

## Developer zone: reviewed contribution

| Capability | Status | Home and behavior |
| --- | --- | --- |
| Scope and readiness overview | Shipped | Show approved contribution scopes, current program readiness, marketing direction, and the next valid workspace. |
| Asset contributions | Shipped | Upload eligible media/fonts, apply controlled taxonomy and license/attribution evidence, inspect status, and participate in the reviewed shared-library pipeline. |
| Template contribution bridge | Shipped foundation | Studio documents and Template revision flows let contributors prepare structured work for exact preview, installation, and Forge Review rather than upload parallel JSON formats. |
| Forge Review, voting, publication, and attribution | Shipped | Review queues, revisions, votes, routing, publication, tombstones, and historical attribution protect the shared Studio catalog. |
| Campaign packages | Shipped, release-gated for extended contributors | Compose variants, associations, destinations, and reviewable campaign packages without owning provider credentials or publication authority. |
| Campaign media | Shipped owner-only surface | Owners inspect campaign media and approval state inside the contribution/marketing workflow. |
| Site proposals | Shipped, release-gated for extended contributors | Prepare deliberate proposals against current public content; owner review remains the publication boundary. |
| Contribution standards | Shipped | Explain content, licensing, truthfulness, review, and provider boundaries in the working context. |
| Contributor roadmap updates | Shipped | Eligible contributors publish appropriate shipped progress while financial checkpoints remain owner-only. |
| Studio-native contribution | Direction | A contributor should prepare assets, Templates, Kits, or Specialty material in the same Studio/Library grammar and then send the selected object into review, instead of working through detached forms. |

Developer is a protected production environment for contributions. It is not a second personal Studio or an owner console.

## Owner zone: operating CardForge

| Workspace | Status | Capabilities and behavior |
| --- | --- | --- |
| Overview | Shipped | Action center, release/readiness signals, connected-service inventory, and system health route the owner to the actual owner of a problem. |
| Marketing | Shipped | Strategy, campaigns, contributor packages, approvals, destinations, scheduling, manual delivery, native Meta publication when enabled, and results/history live in one marketing workflow. |
| Growth & People | Shipped | Consent-aware analytics, Clerk/CardForge people directory, developer access, billing reconciliation, plan and MCP usage targets, and contact inbox retain their distinct records inside one operational zone. |
| Site Controls | Shipped | Business identity, founder profile, pages/navigation/SEO, public copy, media, experience/access presentation, offers, and roadmap mechanics change within code-owned allowlists. |
| Studio Library | Shipped | Shared registry inventory, contributor review, votes, revisions, routing, publication, removal/tombstones, and approved Studio destinations operate the reusable catalog. |
| Governance | Shipped | Legal drafts/publications/history, roles and permissions, append-only owner activity, and deletion/retention controls preserve authority and record integrity. |
| Production operations | Future | Provider profiles, quote/order policy, proof approvals, failures, tracking, and support should join Owner only when CardForge actually owns those operational records. |

Owner can compose feature-owned controls, but it must not become a second database, provider dashboard, billing ledger, or publishing system. Provider credentials and provider-native configuration remain with the provider.

## Production: tool now, possible zone later

| Capability | Status | Placement |
| --- | --- | --- |
| PNG, ZIP, PDF, and TTS output | Shipped | Studio tool on the selected card, group, Set, or project. |
| Print validation and layout controls | Shipped foundation | Studio inspector/preflight attached to the export scope. |
| Provider profiles and dielines | Direction | Studio production layer attached to compatible artifacts and Sets. |
| Quote and upload handoff | Direction | Studio action that preserves the exact source revision and output manifest. |
| In-CardForge purchase | Future | If implemented, checkout remains provider/payment-native while CardForge records purpose, source revision, quote, and status. |
| Orders, proofs, tracking, reorders, and support | Future | Promote Production to a zone only when these become durable objects that people repeatedly revisit outside the editing session. Home may show attention; Library may retain the source; Owner may operate exceptions. |

This decision prevents an empty “Orders” destination from appearing years before it earns a workspace.

## Cross-zone services

| Service | Native owner | Where it appears |
| --- | --- | --- |
| Identity and session | Clerk | Public sign-in; Profile management; authorization checks in Account, Developer, Owner, Studio documents, and MCP. |
| Entitlement and billing | Stripe plus CardForge access policy | Profile/Home status; Studio output gates; Owner billing and reconciliation. |
| Browser workspace and portable packages | CardForge project owner | Studio working copy; Library inventory/location tools; Home resume. |
| Connected project storage | Google Drive or local folder with CardForge revision bridge | Library location manager; Studio open/save; MCP revision-safe project tools. |
| Shared platform state | Supabase | Roadmap, owner settings, legal, billing ledgers, contributions, campaigns, shared library, temporary documents, and activity records through feature owners. |
| Shared Studio catalog | CardForge asset registry in Supabase | Library discovery; Studio insertion; Developer contribution; Owner review/routing. |
| Canonical rendering | CardForge rendering domain | Studio preview/export, public examples, MCP previews, review surfaces, and render artifacts. |
| Agent/MCP work | Clerk OAuth plus CardForge Studio-document policy | Temporary drafts in Library; structured creation/revision in Studio; usage in Profile; operational visibility in Owner. |
| Analytics and consent | CardForge vocabulary; GA4/PostHog provider records | Public/product events after consent; aggregate Owner reporting. |
| Email delivery | Resend | Contact and support submission; owner inbox/history; provider delivery remains outside the workspace. |
| Social publishing | Meta or manual destination; CardForge approval/history | Developer preparation; Owner approval/distribution/results. |
| Search and command access | CardForge | Global zone switch/search, Library search, Studio commands, and scoped Owner/Developer navigation. |
| Error and boundary meaning | Feature owner plus shared API contract | Every zone distinguishes unavailable, authentication required, not permitted, invalid input, conflict, not found, limit reached, and retryable failures. |

An MCP capability should rhyme with the human home of the same object. It may extend a zone, but it must not create a second object model, renderer, asset store, permission system, or persistence owner.

## Canonical object homes

| Object | Canonical home | Supporting appearances |
| --- | --- | --- |
| Project | Library for possession; Studio when active | Home resume; Drive/local-folder location detail; future Production source reference. |
| Set | Library for possession; Studio Set Desk when active | Home resume; future order source. |
| Template or master | Library for discovery/ownership; Studio when editing | Developer review; Owner shared-library operation. |
| Card or repeated record | Studio inside a Set/artifact | Library only through its containing Set/project; public proof only as approved output. |
| Asset, font, icon, or style | Library | Studio insertion; Developer contribution; Owner catalog review. |
| Temporary AI draft | Library temporary shelf; Studio when opened | Home expiry attention; Profile usage; Owner aggregate operations. |
| Storage connection | Library tool | Profile summary; Studio open/save boundary. |
| Plan, invoice, or payment method | Profile utility with Stripe handoff | Home access status; Owner reconciliation/summary. |
| Campaign | Developer when preparing; Owner Marketing when operating | Public only through approved output/history. |
| Contribution submission | Developer | Owner Studio Library or Marketing review. |
| Site proposal | Developer | Owner Site Controls review/publication. |
| Roadmap item | Public roadmap | Owner Site Controls; limited Developer update tools. |
| Legal publication | Owner Governance | Public legal routes; Profile links when relevant. |
| Order | Future Production zone | Home attention, Library source link, Owner exceptions. |

## Current feature-owner coverage ledger

This ledger is checked against the current `src/features/*` owners. It connects shipped implementation ownership to the new environment model so visual consolidation cannot silently drop a capability.

| Feature owner | Current capability family | Canonical UI home | Preservation and presentation contract |
| --- | --- | --- | --- |
| `account` | Entitlement projection, account identity, access labels, Home/Profile composition, developer/owner entry | Home and Profile | Preserve sign-in-aware identity, unavailable-versus-signed-out meaning, access status, focused account utilities, native provider handoffs, and protected-zone entry through the shared environment shell. |
| `analytics` | Consent-aware event collection and owner reporting | Cross-zone service; Owner Growth & People | Preserve consent, sanitized event vocabulary, GA4/PostHog configuration boundaries, and aggregate owner reports. Do not add analytics dashboards to personal zones. |
| `app-shell` | Studio bootstrap, shell, navigation, first-run guidance, confirmations, workspace handoffs | Studio; shared zone shell direction | Preserve bootstrapping, save state, confirmations, entitlement messaging, and handoffs while replacing Templates/Make Cards/Sets as competing destinations. Reuse shell grammar without moving feature state into the shell. |
| `billing` | Checkout, Billing Portal, product/support purpose separation, webhooks, revenue, reconciliation | Profile utility; Home access status; Owner Growth & People | Preserve Creator/Designer purchase and management, support billing separation, failure meaning, ledgers, and owner reconciliation. Stripe remains the native financial surface. |
| `brand-presentation` | Product presentation context and theme application | All zones and public entrance | Preserve runtime presentation selection. Extend common tokens and materials across zones rather than duplicating per-page styling. |
| `business-identity` | Canonical operator/brand identity and owner editing | Public entrance and Owner Site Controls | Preserve the single operator record and provider/public consistency. Profile identity remains separate from business identity. |
| `card-generator` | Single generation, bulk CSV/mapping/validation, generated gallery, Set management, sharing, PNG/ZIP/PDF/TTS output | Studio Set Desk | Preserve every single/bulk generation, edit, preview, share, import/export, quality, layout, and output action as scope-aware Set Desk tools. |
| `card-rendering` | Canonical card preview, rich text, vector shapes, thumbnails, watermark policy | Cross-zone service; primarily Studio | Preserve one renderer and watermark policy across Studio, public examples, MCP previews, Developer review, Owner review, share, and export. |
| `contact` | Public contact/support requests, routing, email operation, owner-visible history | Public entrance and Owner Growth & People/Inbox | Preserve request validation, delivery outcome, reply path, and retained operational history. |
| `developer-access` | Contributor profile, scopes, session projection, protected access | Profile, Developer, and Owner Growth & People | Preserve explicit active/inactive state, scopes, owner authority, protected routing, and denial meaning. |
| `developer-assets` | Shared registry, catalog, taxonomy, uploads, submissions, votes, review, publication, attribution, tombstones, Studio routing | Library/Studio discovery; Developer contributions; Owner Studio Library | Preserve the complete reviewed-library lifecycle. Developer prepares objects; Owner governs publication; Library and Studio consume approved resources. |
| `developer-cockpit` | Contributor overview, asset lane composition, site proposals, protected cockpit API/store | Developer | Preserve scope/readiness overview, contribution access, proposal history, lazy loading, and release-gated lanes while consolidating navigation into the Developer desk. |
| `developer-program` | Public contributor-program explanation and entry | Public entrance | Preserve eligibility, terms, expectations, and route into protected Developer access. |
| `experience-settings` | Owner-controlled presentation/access behavior and public cache | Owner Site Controls; affected public/product surfaces | Preserve code-validated settings, unavailable behavior, and live presentation changes. Personal preferences belong to Profile only when they are truly user-owned. |
| `legal` | Versioned legal documents, public publication, owner controls, history | Public entrance and Owner Governance | Preserve current publications, draft/publish/rollback flow, immutable history, and exact authority boundaries. |
| `marketing` | Owner strategy, campaign operation, distribution workspace, results | Owner Marketing | Preserve strategy-through-publication workflow and keep it one owner environment rather than disconnected dashboards. |
| `marketing-content` | Campaign packages, variants, associations, media ingest/approval, contributor queues | Developer Campaigns and Owner Marketing | Preserve contributor preparation, media relationships, approval state, previews, pagination, and owner publication authority. |
| `marketing-distribution` | Destination policy, Meta connection/token encryption, scheduling/dispatch history | Owner Marketing | Preserve release gates, exact destinations, encrypted authorization, retry/idempotency semantics, and delivery history. Provider credentials remain provider-owned. |
| `mcp-usage` | Plan allowances, account usage, owner plan/usage controls, workflow telemetry | Profile and Owner Growth & People | Preserve usage truth, plan targets, temporary-work allowance meaning, and owner controls without presenting it as durable storage. |
| `owner` | Authorization, action/readiness summary, services, people, inbox, site controls, media, founder, governance, activity | Owner | Preserve all six current owner workspaces and their feature-owned controls. The alpha Action Center is the entry hierarchy, not a reduction to one review queue. |
| `personal-library` | Connected Drive asset/font references, pickers, import, search, MCP access | Library and Studio | Preserve semantic roles, provider revisions, provider-source links, removal-without-source-deletion, Studio insertion, and read-only MCP discovery. |
| `project` | Browser workspace, IndexedDB, recovery, assets/fonts, preferences, portable packages, local folders, Drive projects, cloud-set bridge, production plan | Library and Studio; Home resume | Preserve local-first work, snapshots, import/merge/replace, assets, project files, revision conflicts, and recoverability. Cloud-set behavior remains until its explicit protected retirement is complete. |
| `public-site` | Public shell, navigation, landing, examples, plans, founder, configurable content/media, SEO/structured data | Public entrance; Owner Site Controls | Preserve every public route and proof surface while keeping owner-editable content within code-owned structural and accessibility boundaries. |
| `render-artifacts` | Canonical server/browser render artifacts and contact sheets | Cross-zone service | Preserve exact render evidence for MCP, review, export, and public/product proofs; do not introduce a parallel preview renderer. |
| `roadmap` | Public roadmap, suggestions, voting, shipped history, developer/owner controls, funding checkpoints | Public entrance; Owner Site Controls; limited Developer tools | Preserve live status/votes/history, suggestion rules, developer publication scope, and owner-only financial control. |
| `social-publishing` | Provider-native Meta publication bridge | Owner Marketing | Preserve owner approval, exact destination, external result meaning, and release gating. It remains a publishing service, not another zone. |
| `storage-management` | Unified account Library read model, storage health, cloud mirrors, local folder, Drive projects, connected assets, temporary drafts | Library; compact Profile connection summary | Preserve every current location action and status inside Library's shipped locations tool. Extend selected-object detail toward multi-location management without restoring Storage as a destination. |
| `studio-documents` | Private Template/card/working documents, revisions, assets, previews, install/handoff, agent/MCP tools, project/cloud bridges | Library temporary shelf; Studio; Developer contribution bridge; MCP service | Preserve revision-safe creation/update, temporary retention, recoverable deletion, asset hydration, exact preview, Studio installation, project-source workflows, and failure semantics. Retire cloud-set MCP tools only with the cloud-mirror cutover. |
| `template-editor` | Canvas, layers, library, variables, element editing, inspectors, commands, Template lifecycle | Studio Set Desk | Preserve full Template editing power, every supported element/inspector, responsive controls, draft recovery, library actions, and front/back workflows when Templates become selectable Set objects. |

When a new `src/features/*` owner appears, add it here before the UI is considered placed. When an owner is retired, remove it only in the same reviewed change that removes or transfers its shipped responsibility.

## Consolidation decisions

- **Storage has been retired as an account destination.** Storage locations and connections now operate as tools inside Library, with Profile reserved for compact personal and connection summaries.
- Retire **Templates**, **Make Cards**, and **Sets** as competing Studio destinations. Preserve their capabilities as modes on one active Set Desk.
- Retire durable **CardForge Cloud** Set storage after protected migration. Keep limited CardForge-managed capacity only for temporary AI working documents and required platform records; durable creator work belongs in browser storage, portable packages, local folders, Google Drive, or a later provider chosen deliberately.
- Keep **billing** native to Stripe and present it as a compact Profile/account utility, not a custom finance workspace.
- Keep **export**, **share**, **validation**, and **production** attached to the selected scope instead of sending the person to detached pages.
- Keep **review** attached to the object being contributed and the protected queue that owns the decision.
- Keep **specialties and Kits** as ways to configure Studio, Library discovery, validation, and outputs—not as separate applications.
- Use layers, inspectors, sheets, drawers, menus, command access, and grouped rows before inventing another permanent tab or card grid.

## Remaining placement decisions

1. Define the exact Set Desk object geometry and grouping rules that work on desktop, tablet, and mobile without turning the surface into an infinite-canvas toy.
2. Decide which personal Studio defaults belong to Profile versus the active project.
3. Specify the protected migration and removal sequence for existing CardForge cloud Set mirrors and MCP cloud-set tools.
4. Decide when Production has enough durable lifecycle to earn a top-level zone.
5. Reconcile current Studio navigation with this map before visual polish; Account already uses the shared environment shell and no longer preserves Storage as a peer destination.
