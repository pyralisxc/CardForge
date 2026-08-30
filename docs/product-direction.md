# CardForge Product Direction

Last updated: August 28, 2026

Status: living product direction. This document records the intended product model and next delivery sequence. It does not describe shipped behavior. [architecture.md](architecture.md) remains authoritative for the current application, while [product-surface-map.md](product-surface-map.md) records shipped-versus-direction placement and the live `/roadmap` owns publicly presented capability status and votes.

## Product Thesis

CardForge is one structured visual-production environment for repeatable, coordinated visual sets. It is not a collection of separate editors and it is not limited to game cards.

The shared promise is:

> Design once. Add structured information. Generate the whole coordinated set.

Working positioning:

> CardForge is the structured design studio for repeatable visual sets.

The engine stays broad. Specialties, Kits, permissions, and connected providers change what is suggested or available; they do not fork the core product.

## The Three Private Surfaces and Focused Workbench

CardForge has three permanent user-navigation surfaces and one focused workbench mode:

| Surface | Core question | Product role |
| --- | --- | --- |
| **Desk** | What am I working on? | The user's spatial home for authored work, active work, recent work, organization, and quick object actions. |
| **Library** | What resources can I access? | The user's structured collection across Personal and entitlement-filtered Pipeline scopes, with a Published scope added for Contributors and Owners. |
| **Profile** | Who am I here, and what follows me? | Identity, security, plan/access, preferences, provider summary, temporary AI capacity, and personal role configuration. |
| **Studio workbench** | What am I changing or producing right now? | A focused mode entered from selected work for authoring, generation, review-in-context, validation, saving, and output. It is not another collection or permanent navigation destination. |

**Contributor is not another surface.** Contributor is a protected capability layer that enhances Desk, Library, focused Studio tools, and Profile.

**Owner remains a separate protected operating environment** because the Owner's recurring job is operating CardForge itself: publishing reviewed truth, managing people/services, inspecting accountable history, and resolving operational queues.

The public site remains CardForge's entrance and explanation surface, not another private workspace.

## Product Language

Use these terms consistently:

- **Studio:** the focused authoring, generation, review, validation, save, and output workbench opened for a selected Set, artifact, Template, record, or revision.
- **Desk:** a persistent spatial working view over real CardForge objects. A Desk preserves selection, grouping, position, and return context without becoming a new persistence owner.
- **Desk:** the work-container-scale spatial surface and personal account home. It answers what the user is working on and provides quick actions without forcing a trip through another page.
- **Focused workbench:** the precision editing mode that keeps active Set/object identity and return context while Design, Generate, validation, Save, Output, or Pipeline tools operate on it.
- **Library:** one collection/read model over reusable objects and their native owners. Library does not become a second file registry or sync engine.
- **Pipeline:** the shared-content lifecycle behind discovery, hearts, contribution, revision voting, publication, archive/recovery, and attribution. Every account sees the published Pipeline content its entitlement allows; Contributors additionally see authorized unpublished/review history and exact-revision votes.
- **Contributor:** an approved user with additional contribution/review capabilities. Contributor access changes valid actions and visible Pipeline content; it does not create a parallel CardForge product.
- **Specialty:** a guided lens over Studio for a market/body of work such as Games, Events, Retail, or Learning. It changes recommendations, vocabulary, validation, and Kits, not the underlying editor.
- **Kit:** a versioned starting workflow inside a Specialty that defines a useful outcome, suggested artifacts, fields, components, validation, and output profiles.
- **Work container:** the creator's durable body of coordinated work: records, layouts, artifacts, assets, output settings, and selected Specialty/Kit context. The current CardForge domain name is **Set**; provider/package surfaces may still say **Project**. These are one product object, not a parent/child hierarchy or parallel registry. The final public label remains a naming decision, not an architectural split.
- **Artifact:** one designed surface/document inside a work container, such as a card face, card back, rules sheet, poster, badge, package surface, token, board, or social graphic.
- **Template/master:** a reusable layout for an artifact.
- **Component recipe:** a semantic insertable assembly made from existing Studio primitives.
- **Field contract:** the typed structured data expected by a Template or component recipe.
- **Output profile:** a validated destination contract for download, digital publishing, print preparation, or provider fulfillment.

The recommended internal/owner-facing phrase remains **Studio Specialty**. Specialty is guidance, not a prison.

## Workbench Doctrine

CardForge should reveal capability progressively without turning each feature, Specialty, artifact, permission, or provider into a page.

The user's current object remains grounded in its originating surface: tools open around it or enter the focused Studio workbench, and closing the tool returns to the same selection, grouping, zoom, position, and broader context. Desk owns spatial organization; Studio owns precision change and production.

Core rules:

1. Keep the current object and primary next action visible.
2. Let tools **reveal**, not navigate, whenever the current surface already owns the job.
3. Move advanced controls into inspectors, drawers, focused panels, sheets, or popovers that preserve context.
4. Let each feature own its actions/domain state. Shared presentation resolves and arranges actions; it does not become a second owner for Sets, generation, export, Pipeline, storage, or validation.
5. Use the same selection/action contract across visible buttons, menus, keyboard commands, mobile sheets, future radial/marking interaction, and agent actions.
6. Keep destructive, financial, permission, and live-publication commitments explicit.
7. Rearrange the same hierarchy across desktop, tablet, narrow windows, and mobile. A compact layout is not a different product model.
8. Reserve card-like visual treatment for authored/selectable objects or real boundaries. Comparable settings/status belong in quieter rows and aligned groups.
9. Defer radial/marking-menu accelerators until the visible progressive workflows are stable. They must present existing resolved actions, never create a second command system.

A useful shorthand is:

> **Surfaces navigate. Studio focuses. Tools reveal. Objects persist. Permissions enhance.**

## Spatial Model

CardForge should feel like one crafted working environment, not a file browser with editor pages attached.

### Desk: the higher-level spatial surface

Desk is no longer only a router or recent-work dashboard. It is the user's personal account home and work surface.

Work containers should read as authored work sitting on a working surface rather than folders in a filesystem. A work container may appear as a rendered stack, project board, product group, or compact visual cluster. The layout should provide breathing room and spatial identity without becoming an unconstrained infinite-canvas toy.

Desk supports:

- organize, group, stack, sort, and saved views;
- select one or several owned work objects;
- open/resume;
- rename;
- duplicate;
- delete/remove with exact-location semantics;
- Save / Save As / Move;
- Generate;
- Export/share where supported;
- Send to Pipeline / Submit Revision for eligible Contributor-owned work;
- compact Pipeline state and vote/review actions when an owned object has shared lineage;
- attention only when meaningful: expiring AI drafts, provider conflicts, failed save/export, review changes, or real limits.

Opening a work container changes focus rather than changing the mental model:

> Desk → focused work → contained objects

Contained objects may include Templates/masters, backs, generated artifacts, assets/fonts where dependencies are known, generation batches, rules/reference surfaces, packaging, or later Specialty artifacts. Pulling back restores the prior Desk arrangement and selection. Set-owned tag catalogs, card tag references, grouping/sort choices, and freeform card positions travel in the project document; field facets are derived from actual Template/card data rather than copied into a second taxonomy.

### Studio: the focused authoring and production workbench

Studio does not open another Set browser. It receives the active Set plus the selected artifact, Template, record, revision, or requested tool from Desk, Library, a public creation entry, or agent handoff.

The focus path is:

> selected work → artifact/Template/record → element-level editing or production tool

Selecting Edit, Generate, Test, Validate, or advanced Output opens the smallest useful Studio tool. Returning restores exact prior Desk or Library context.

The focused Studio workbench supports:

- multiple Templates/masters and artifact types;
- precise Template/master and element editing;
- structured record/card editing;
- single/bulk generation and CSV mapping into the active Set;
- exact candidate testing and review-in-context;
- validation and production readiness;
- advanced output profiles and export configuration;
- direct generation back into the Desk;
- contextual validation and export;
- contributor review/voting state where applicable.

Desk and Studio use the same object/action grammar with distinct jobs:

- **Desk:** organize the things I am making and the contained objects that belong together.
- **Studio:** change or produce the selected thing with precision.

## Desk: My Work

Desk's primary content is user-owned Sets/Projects and resumable work. It is not an account metrics dashboard.

Desk may surface browser-local work, Google Drive projects, attached local-folder projects, portable packages the user opens/indexes, and temporary AI work. Location is metadata on the work, not Desk's organizing principle.

New work has one creation boundary: start with a fresh Set or instantiate an independent browser-owned copy of a Published Set. Published starters are immutable reviewed `.cardforge` package revisions, not a second starter document format or a special Set subtype. The same portable package contract owns import, export, provider transfer, Pipeline publication, and starter installation; installation re-keys local object identity so editing a starter never mutates its published lineage.

A Contributor sees contribution/Pipeline state on their own objects when relevant. Other contributors' Pipeline objects do not appear on Desk simply because they are reviewable.

Desk quick actions use the same scope contract as Studio:

| Selection | Typical actions |
| --- | --- |
| No object | New Set/Project, import/open, search Library, resume recent work. |
| One Set/Project | Open, Edit/Test, Generate, Export, Save/Move, Duplicate, Delete, contribution actions when eligible. |
| Multiple objects | Batch move/tag/archive/export where the domain supports it. |
| One contained object | Edit/Test, Generate, Export, Duplicate, Pipeline/revision actions where valid. |

The untouched bootstrap `Untitled Set` must not masquerade as meaningful current work merely because internal state created it.

## Library: Personal, Pipeline, Published

Library is one structured collection of reusable resources and object identities.

Recommended scopes:

### Personal

User-owned reusable resources and provider-backed objects, including Templates, assets, fonts, styles, working drafts, and project resources where appropriate.

### Pipeline

Every user sees stable published CardForge shared resources available to their entitlement/compatibility. Signed-in users can heart any visible Pipeline lineage; the heart follows later revisions and never changes review thresholds or publication state.

Published Sets are reusable starting work, beginning with complete outcomes such as a standard playing-card deck. Their catalog entry points to one immutable portable package revision. Creators receive an independent Set copy; publication remains owned by Pipeline and durable creator storage remains browser, package, folder, or connected-provider owned.

### Published — Contributor and Owner

The contributor's own published Pipeline work, with its attribution, stable lineage, publication revision, audience hearts, and exact-revision review history. Owners may see the governed publication view required to operate the catalog.

Contributors see every Pipeline entry authorized by their scopes, including reviewable candidates, revisions, published lineage, and archived/recovery material when policy allows. Normal creators see only the published Pipeline content allowed by their account level.

The same lineage should not become disconnected copies merely because it appears in multiple scopes. For example, a contributor's personal `Dragon Frame` may show `Pipeline: r2 in review` in Personal, appear as revision r2 in Pipeline, and appear as Published r2 after approval. These are related projections over one lineage.

Pipeline default representation is **one item per lineage**, not a long list of revisions. Show the current published revision when one exists; otherwise show the current/strongest active candidate. Revision history expands from the inspector only when requested.

Pipeline Library needs multiple review densities:

- **Gallery:** visual cards/thumbnails with quick vote and compact progress.
- **Compact list:** high-volume triage.
- **Expanded/detail:** preserves the current rich Forge Review information such as contributor, tier, quality, classification, source, status, votes, reasons, and next step.

Useful filters/saved views include Needs my vote, My votes, New revisions, Changed since my vote, Near threshold, Publish candidates, Published, Archived/recovery, family/type, Specialty, use case, contributor, tier, status, newest, and score/rank when meaningful.

## Studio: One Enhanced Workbench

There is one Studio for every account class.

Current Template editing, single/bulk generation, card editing, Set management, canonical rendering, validation, sharing, PNG/ZIP/PDF/Tabletop Simulator output, watermarks, project files, connected saves, and AI handoff remain native capabilities.

The direction is to recompose them around the selected object:

- Template editing is a focused tool on a selected Template/master.
- Generate is a scope-aware tool on a Template, record, group, Set, or appropriate artifact.
- Bulk generation reuses current CSV/import/mapping/validation strength and returns generated objects visibly to the Desk.
- Export is a scope-aware output tool, not another destination.
- Set switching stays compact and preserves context.
- Library/source selection opens around the current work.
- Save targets the current durable owner and names that destination.

### Save semantics

These actions must remain unmistakably different:

- **Save · This device / Local folder / Google Drive / future provider:** persist the current work container to its durable owner.
- **Save As / Move:** choose another durable destination.
- **Send to Pipeline:** create a reviewable new shared candidate.
- **Submit Revision:** create a reviewable revision of an existing shared lineage.
- **Publish Live:** Owner/policy publication boundary that changes the stable shared Library.

Pipeline submission is never labeled Save. Provider persistence is never labeled Publish.

## Contributor Capability Layer

Contributor access enhances Desk, Library, focused Studio tools, and Profile. It does not create a parallel Contributor Studio or permanent Contributor zone.

A standard active Contributor may receive capabilities equivalent to:

- submit eligible shared assets;
- review/vote on Pipeline assets;
- submit shared-library revisions;
- create temporary private Studio drafts with AI;
- campaign drafting or site proposals only when separately granted/release-enabled.

Normal Contributor access does not imply live publication authority.

### Desk enhancements

- contribution status on owned work;
- Send to Pipeline / Submit Revision;
- review attention on owned lineage;
- Withdraw/Retire actions when policy allows;
- contextual Vote when the selected owned object maps to a voteable exact revision.

### Library enhancements

- Pipeline scope;
- quick voting;
- revision inspector/comparison;
- Test exact revision in Studio;
- source/rights/classification detail;
- review filters and saved views.

### Studio enhancements

- Pipeline candidates in the source/library picker;
- unpublished exact revisions;
- Pipeline status on selected objects;
- contextual voting;
- revision comparison/history;
- Use this revision;
- Send to Pipeline / Submit Revision;
- controlled rights/source/classification tools.

### Profile enhancements

Only personal role configuration belongs here:

- Contributor access status;
- granted scopes;
- meaningful personal limits/remaining allowance;
- temporary AI capacity/retention;
- provider summary;
- contribution-policy/help links.

The review queue does not belong in Profile.

### User-facing naming

Use **Contributor** for the creative/product role across public and private UI. Internal `developer` identifiers, `accessMode === 'dev'`, database names, and compatibility routes may remain until a deliberate migration is safe. Do not create a new permanent Contributor destination merely to rename the old Developer Cockpit.

## Pipeline, Revisions, Voting, and Publication

The existing Forge Pipeline remains the shared reviewed-content owner.

Supported lifecycle concepts include draft, submitted, voting, publish candidate, published, archived, and rejected, with automatic ranking/capacity policy plus explicit Owner overrides.

### Voting

Votes attach to the exact submission/revision, not to an eternal asset name. A new substantive revision earns its own signal. Previous revision votes remain historical evidence.

Contributor voting follows the exact displayed revision anywhere a visible Pipeline object appears. Votes may be recorded after publication/archive/rejection as durable feedback, but only active review states may rebalance automatic publication policy:

- vote directly in Pipeline or Published Library;
- vote from the Studio inspector while actually using/testing the revision;
- optionally vote from Desk when an owned selected object maps to an exact Pipeline revision.

### Hearts

Hearts are a separate audience metric attached once per signed-in account to a stable Pipeline lineage. Free, paid, Contributor, and Owner accounts can heart any Pipeline object visible to them. Hearts follow later revisions, never count as review votes, and never grant publication authority.

### Revision presentation

Do not show long revision lists by default.

For one lineage:

1. show the current published revision if one exists;
2. otherwise show the current/strongest active candidate;
3. expand **Revisions** from the inspector for history and alternatives.

The revision inspector may expose state, votes, current-user vote, author, dates, comparison, source, and Use this revision.

### Exact revision pinning

Using an unpublished candidate inside Studio must pin the exact revision/snapshot needed to prevent silent mutation. A later candidate never silently replaces it.

Possible actions include Update to newer candidate, Compare, Keep current revision, and Return to published.

Durable work must remain recoverable if a candidate later archives or becomes unavailable. Materialize/snapshot dependencies when necessary.

### Generalized revision lineage

Template revisions already have the strongest model: stable shared asset ID, base revision, next revision, immutable submission identity, complete structured payload, conflict detection, and current-published pointer.

Extend equivalent lineage concepts to revisionable media/fonts/component recipes and later Kits/Specialty material instead of treating every update as an unrelated upload.

### Removal semantics

Contributor ownership should support safe non-destructive lifecycle actions:

- Withdraw own unpublished candidate/revision;
- Retire own published contribution, subject to dependency/policy checks;
- Restore/resubmit where policy allows.

Permanent purge remains Owner-only and retains the existing explicit confirmation/tombstone authority boundary.

## Library, Storage, and Source Ownership

CardForge is local-first and provider-friendly. It does not operate durable first-party creator backup storage.

Durable creator locations include:

- browser workspace as fast local working/recovery copy;
- portable `.cardforge` Project/Set packages;
- browser-authorized local folders;
- Google Drive projects;
- future providers chosen deliberately.

Temporary AI Studio documents remain CardForge-owned bounded collaboration storage with explicit capacity, inactivity retention, recoverable trash, and cleanup. They are not project backups.

Library composes location/source truth; it does not own provider bytes or become a sync engine.

The first shared durable-work capability slice now covers device, Google Drive, and local-folder destinations. Desk and Library use it to set a default destination and to distinguish Copy from Move. Move is always copy, verify, then remove the exact source revision; paths that cannot be composed safely require an explicit device handoff. This is the seed of the broader source-capability projection below, not a universal sync service.

A shared source-capability projection should eventually describe, per source:

- authoritative owner;
- content kinds;
- human browse/read/write;
- Studio open/use;
- save/update;
- revision safety;
- Pipeline submission eligibility;
- materialization requirements;
- agent discover/read/edit/commit;
- server reachability;
- temporary versus durable;
- permission/connection state.

Desk, Library, Profile, focused Studio tools, and MCP should consume the same capability truth where applicable.

## Agent / MCP Direction

Agents operate on the same CardForge objects, renderer, validation, asset system, permission boundaries, and revisions as humans. MCP must not create a second Template format, renderer, asset store, publication path, or persistence owner.

Current strong patterns remain:

- revisioned temporary Studio documents;
- atomic sparse patches with exact expected revisions;
- canonical selective previews and full final renders;
- Google Drive project checkout/commit with provider + CardForge revision safety;
- connected personal-asset metadata discovery with explicit materialization before bytes are used;
- Template handoff into Forge Review.

Browser-only/local-folder work is not remotely agent-readable while the device/browser is unavailable. The user must hand it into temporary AI workspace or a server-reachable provider.

General media/font Pipeline contribution can become more agent-native later, but it must use the same human Pipeline lineage, rights/classification, and publication rules.

## Profile and Personal Continuity

Profile centers the person, not an account record.

Clerk remains the native identity/security owner. Stripe remains the native checkout/billing owner. Provider connection lifecycle remains with the provider integration, with Profile showing a compact summary and Library owning detailed location management.

Profile may hold durable personal defaults only when ownership is truly personal: presentation, default Specialty/Kit, accessibility choices, output preference, and Contributor configuration. Work-specific settings stay with the selected work container.

## Owner Environment

Owner remains a protected operational environment because its recurring object is CardForge itself.

Owner responsibilities include:

- action/readiness queues;
- people and Contributor scopes;
- shared Library review/publication/routing;
- owner overrides and permanent purge;
- public site controls;
- marketing strategy/approval/distribution;
- legal/governance/history;
- service/provider readiness;
- billing/usage/analytics reconciliation.

Owner may reuse the same object renderers, Library projections, and review surfaces, but authority remains explicit and auditable.

## Campaign and Site Contribution

Existing campaign package and site-proposal capabilities remain valid and must not be lost while Contributor stops being a separate zone.

First integration rule:

- Campaign packages are Set-like specialized work in the interaction model, while `marketing-content` remains their record and lifecycle owner.
- Desk surfaces a compact visual shelf for active campaign packages owned by or available to the current Contributor.
- Library adds a Campaigns scope only for Owners and Contributors granted `campaigns.draft`; normal accounts do not receive campaign packages or reusable campaign media through Pipeline entitlement.
- Contributors draft, revise, attach approved media, and submit campaign packages in Library. Owner retains strategy, approval, destination credentials, scheduling, publication, and delivery history.
- Profile owns personal Contributor access, limits, scopes, and the current user's site-proposal drafts/status. Owner reviews and publishes site proposals from Owner.
- Campaign and site tools reveal within their owning surface and return to the originating context; they do not create a replacement Contributor destination.

Do not create permanent geography merely because a permission exists. A future campaign/production environment earns a separate zone only if it develops a durable recurring object/queue users intentionally revisit outside normal editing.

## Studio Entry and Specialties

The public site's primary action can remain **Enter the Studio**. A launcher may guide users through:

1. choose a Specialty or Fully Custom;
2. choose a Kit or no Kit;
3. start with sample content, import structured data, or blank;
4. enter the same Studio with relevant recommendations already active.

Initial Specialty lanes remain:

- Games and decks;
- Events and signage;
- Products and retail;
- Learning and reference;
- Fully Custom.

A Specialty may declaratively configure:

- launcher name/summary/imagery/order;
- vocabulary;
- Kits and suggested starting points;
- featured Templates/styles/fonts/media/component recipes;
- suggested field contracts/import mappings;
- suggested artifact types/order;
- contextual Add Element/Section recommendations;
- code-supported validation/preflight;
- code-supported output profiles;
- contextual help/examples/completion guidance.

A Specialty must not deliver arbitrary executable code, unvalidated CSS, database expressions, or unrestricted UI definitions. Code owns the finite capability vocabulary; published configuration selects/arranges validated capabilities.

## Specialty Specification Standard

Every Specialty should answer:

1. Audience and job.
2. Domain hierarchy.
3. Kits.
4. Artifacts.
5. Shared/repeated/imported fields.
6. Semantic component recipes.
7. Import mappings.
8. Validation.
9. Outputs.
10. Recurring value.
11. Proof project.
12. Boundaries/exclusions.

A Specialty is complete when a real user can begin with their information and finish the intended coordinated outcome, not when it merely has Templates.

## Games Specialty

Games remains the first active Specialty and first proof of CardForge as a coordinated physical-product system rather than only an individual-card editor.

### Audience and outcome

Games serves tabletop designers, independent publishers, playtesters, game masters, educators using game mechanics, and creators producing collectible/reference systems.

The outcome is a coherent playable/publishable game product.

### Domain hierarchy

- **Game work container (currently Set):** shared identity, branding, credits, legal text, icon vocabulary, terminology, default production settings, and the organized body of related card pools/decks, rules artifacts, packaging, boards/tokens/reference materials, and promotional outputs.
- **Card/record:** one stable structured game object with front data and optional independent back data.
- **Deck/collection:** ordered/counted references to records; quantity does not duplicate source identity.
- **Product/pack:** distributable configuration defining included artifacts/quantities without becoming their source owner.
- **Artifact:** card face/back, token, divider, rules surface, package surface, reference sheet, board, sell sheet, or promotional graphic.

Single and bulk generation add results to an active Set. Legacy loose content imports into a clearly named recovered Set rather than becoming a permanent second model.

### Candidate Kits

Initial/future Kits may include:

- Playing Card Deck;
- Tarot or Oracle Deck;
- Trading or Collectible Card Set;
- Prototype Deck;
- Tabletop/RPG Reference Deck;
- Prompt/Party/Trivia Deck;
- Game Product Kit;
- later complete tabletop, board, tile/counter, roll-and-write, party/social-deduction, scenario/campaign, and educational tabletop projects where shared artifact foundations justify them.

The Arcane Playing Card proof remains a useful first physical proof, but the product architecture must support broader coordinated Sets.

### Shared game data

Games should eventually distinguish scoped values:

- Game-level identity and terminology;
- Set-level code/symbol/version/back/numbering/rarity/legal text;
- Record/card-level content;
- Deck-level references/quantities/order;
- Artifact-level role/master/output settings;
- Product-level included components/quantities/package copy/provider profile.

Templates bind to scoped values explicitly. Intentional local overrides are visible.

### Semantic components

Games should feature semantic recipes before generic primitives, including title blocks, artwork frames, cost/action badges, type lines, rules boxes, reminder text, structured stats, paired stats, rarity/set marks, collector numbers, credit/legal lines, flavor text, icon/resource rows, card/deck positions, and playtest/version markers.

Recipes assemble existing primitives and field contracts whenever possible rather than creating unnecessary renderer element types.

### Rules, packaging, boards, tokens, and player aids

Rules should progress from rich text to rules cards/reference sheets to fixed-page booklets; flowing automatic document layout is a separate capability and should use a mature paged-layout foundation rather than casually building another publishing engine.

Packaging remains provider-aware artwork preparation using exact provider dielines, semantic panels, guide layers, shared identity, preflight, and provider output profiles. CardForge does not issue retail identifiers or certify legal/structural compliance.

Boards, tokens, tiles, mats, dashboards, player aids, scorepads, labels, and trackers can reuse structured records/Templates/assets/output foundations, but each artifact type needs deliberate geometry, performance, duplex/cut/imposition, and provider rules.

A future Game component manifest should coordinate designed and externally supplied components, quantities, references, packaging copy, setup/rules descriptions, and later fulfillment preparation without pretending CardForge authors every physical part.

## Existing Foundation and Missing Orchestration

CardForge already has much of the lower-level engine:

- Template Studio primitives and semantic roles;
- typed field contracts;
- reusable appearance/element recipes;
- canonical rendering;
- single/bulk generation;
- Set and card models;
- reviewed shared asset registry;
- controlled Studio destinations;
- browser-local projects and portable packages;
- local-folder and Google Drive project persistence;
- connected personal assets/fonts;
- temporary AI documents and MCP collaboration;
- Pipeline submissions/votes/publication/archive/attribution.

The missing product layer is orchestration around those owners:

- the three-surface navigation model plus focused Studio workbench applied consistently;
- Desk as the spatial authored-work surface;
- Studio as object-focused authoring/production rather than another Set browser or competing workspace set;
- scope-aware action resolution;
- Library Personal/Published/Pipeline projections;
- generalized revision lineage beyond Templates;
- exact candidate pinning/materialization;
- shared source-capability projection;
- multi-artifact work-container model;
- Specialty manifests and versioned Kits;
- composite semantic component recipes;
- shared scoped data;
- output bundles/provider profiles.

This direction does not require a replacement renderer or a separate editor per market.

## Ownership and Persistence

Preserve ownership separation:

| Owner | Responsibilities |
| --- | --- |
| Code | Allowed capabilities, renderer behavior, element/field types, validation, compatibility, access control, output engines, provider interfaces. |
| Supabase | Published Specialty/Kit metadata, Pipeline/review state, shared registry, owner decisions, public/platform control records. |
| Browser/work owner | Working records/layouts/local assets/preferences/recovery, plus portable work-package contracts. |
| Connected provider/local folder | Durable user-owned project files, permissions, provider revisions, provider deletion. |
| Temporary AI workspace | Bounded private revisioned collaboration only; not durable creator backup. |
| External production provider | Dielines/product specs, availability, prices, orders, shipping, delivery. |

`cardforge_asset_registry` remains the canonical shared Studio catalog for Templates, styles, media, fonts, and similar reusable assets. Specialties/Kits orchestrate those assets; they are not forced into the asset registry.

### Version behavior

- Published Specialty/Kit revisions are immutable snapshots.
- New work containers receive current published configuration.
- Existing work containers store/pin sufficient configuration to remain usable.
- Publishing new configuration does not silently mutate existing work.
- Updating existing work is explicit and previewable.
- Published shared asset/revision updates do not silently mutate exact work dependencies.
- Supabase/provider outages never destroy creator-owned local work.

## Visual Direction

The visual system should reinforce object meaning rather than decorate every container.

Use:

- real work stacks and artifact thumbnails;
- actual Template previews;
- artwork thumbnails;
- font specimens;
- recognizable provider/source marks;
- semantic status glyphs;
- subtle depth/material changes for selection/focus;
- inspectors/sheets for detail.

Avoid:

- a folder/file-manager metaphor on Desk;
- walls of equal dashboard cards;
- long nested tab bars;
- architecture-oriented copy in user UI;
- borders as the primary hierarchy signal;
- exposing every revision by default.

Desk should be **more spatial than Library**. Library should intentionally remain the denser structured collection. Studio should be the most precise and tool-dense surface because it is entered for a specific change. Profile is the quietest structured utility surface.

The prior six alpha concept images remain historical hierarchy references, but the canonical visual direction is now:

- Desk: spatial authored-work organization over the current Set/project object;
- Library: Personal / Published / Pipeline collection with object inspectors;
- Studio: focused Design/Generate/Validate/Output workbench over the selected object;
- Profile: person-centered configuration;
- Owner: separate operational environment.

The old Developer-zone concept is superseded by Contributor enhancements across the three navigation surfaces and focused Studio tools.

## Delivery Sequence

1. **Surface/workbench contract and visual grammar** — keep Desk, Library, and Profile as permanent navigation; define Studio as the focused workbench entered from selected work.
2. **Desk** — meaningful owned-work projection, object thumbnails/spatial grouping, focused-work contents, scope actions, real Set duplicate/delete, return-state preservation.
3. **Library scopes** — Personal/Published/Pipeline, lineage grouping, gallery/list/expanded review, current filters/votes, revision inspector, Studio test handoff.
4. **Profile refinement** — finish the compact personal-control surface, native account/service controls, and concise cross-service status without turning Profile into another dashboard.
5. **Contributor, Owner, and public alignment** — move protected contribution and operational workflows into the shared surface/workbench grammar while keeping explicit authority and parity with their current owners.
6. **Source/MCP parity** — shared source capability projection, provider reachability clarity, connected personal assets, broader agent contribution where appropriate.
7. **Campaign/site integration** — campaign work is integrated into Desk/Library and site proposals into Profile/Owner; continue refining the shared object/tool grammar without restoring a separate Contributor destination.
8. **Studio focus and Pipeline in context** — remove the duplicate Set Desk and Templates/Make Cards/Sets destination model while preserving their native capability owners; then refine object-specific Design/Generate/Validate/Output, exact candidate pinning, contextual voting, revision comparison, generalized media/font revisions, Send to Pipeline, withdraw, and retire.
9. **Specialty/Kits orchestration** — publish validated Specialty manifests, versioned Kits, semantic recipes, shared scoped data, multi-artifact Sets, and output profiles on the stable Studio foundation.

## Product Constraints

Do not:

- create a fifth permanent Contributor zone;
- create a second Studio/editor for Contributors;
- create a second renderer, asset registry, vote model, persistence owner, or Pipeline;
- expose unpublished Pipeline content to normal creators;
- make Contributors implicit live publishers;
- conflate Save with Pipeline submission or Publish;
- silently update pinned revisions;
- rebuild provider-native storage/auth/billing lifecycles;
- turn Desk into an unconstrained infinite-canvas toy or Studio into another collection browser;
- retire a shipped capability before its new home proves parity;
- use radial/gesture-only interaction as a prerequisite for basic workflows.

## Remaining Product Questions

The next product decisions should focus on implementation details rather than reopening the three-surface navigation plus focused-workbench model:

1. Exact constrained Desk grouping and how much arrangement persists per device/work container.
2. Exact focused Studio geometry for Template, record, generation, validation, and output tools across desktop/tablet/mobile.
3. Final public naming for the one authored-work container currently called Set in CardForge and Project by some provider/package paths.
4. Which object types receive direct Generate/Export from Desk versus opening the focused Studio tool.
5. Exact stable lineage/schema for revisionable fonts/media/component recipes.
6. Retention policy for heavyweight old revision payloads while preserving lightweight audit history.
7. Which personal Studio defaults belong in Profile versus the active work container.
8. When a future Production/Orders lifecycle becomes durable enough to earn a separate zone.

The three-surface navigation model, focused Studio workbench, Contributor capability layer, spatial Desk ownership, and provider-owned durable storage direction are considered approved product direction.
