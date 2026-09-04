Warning: truncated output (original token count: 10466)
Total output lines: 690

# CardForge Product Direction

Last updated: September 3, 2026

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

**Owner is a protected capability layer within Profile.** The Owner's recurring job remains operating CardForge itself—publishing reviewed truth, managing people/services, inspecting accountable history, and resolving operational queues—but it does not create a fourth navigation surface.

The public site remains CardForge's entrance and explanation surface, not another private workspace.

## Product Language

Use these terms consistently:

- **Studio:** the focused authoring, generation, review, validation, save, and output workbench opened for a selected Set, artifact, Template, record, or revision.
- **Desk:** the persistent work-container-scale spatial surface and personal account home over real CardForge objects. It preserves selection, grouping, position, and return context without becoming a new persistence owner.
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

Artifact focus is a closer camera depth inside the same creative scene, not a detached inspector or replacement application. The chosen Artifact moves to the camera-fitted foreground while its Set field remains visibly present at reduced emphasis. The contextual rail carries identity and primary actions; detailed Artifact camera controls stay with the Artifact. Back/Escape restores the exact Set camera and selection before the next unwind returns to Desk.

### Studio: the focused authoring and production workbench

Studio does not open another Set browser. It receives the active Set plus the selected artifact, Template, record, revision, or requested tool from Desk, Library, a public creation entry, or agent handoff.

The focus path is:

> selected work → artifact/Template/record → element-level editing or production tool

Selecting Edit, Generate, Test, Validate, or advanced Output opens the smallest useful Studio tool. Returning restores exact prior Desk or Library context.

Design is the exclusive full-viewport precision canvas inside the persistent creator Environment whil…5466 tokens truncated…nguish scoped values:

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

## Existing Foundation and Remaining Orchestration

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
- a select-first constrained spatial Desk with persistent grouping, shared-object Set opening, reflective organization, and equivalent pointer/touch/keyboard paths;
- one semantic action runtime presented through Desk, focused work, and the command palette;
- Personal/Published/Pipeline Library scopes, exact revision editing, contributor withdrawal/retirement, and Content Health;
- one source-agnostic Library Picker contract used by resource-selecting tools;
- visible browser recovery, revision-safe Google Drive boundaries, exact checkout return, and independent commercial/authority entitlement axes;
- a complete 52-card Published Set starter on the same immutable portable-package contract;
- contextual Owner editing and Roadmap controls on their native public surfaces.

The remaining product direction is orchestration that builds on those shipped owners:

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

The prior alpha concept images remain historical hierarchy references, but the canonical visual direction is now:

- Desk: spatial authored-work organization over the current Set/project object;
- Library: Personal / Published / Pipeline collection with object inspectors;
- Studio: focused Design/Generate/Validate/Output workbench over the selected object;
- Profile: person-centered configuration;
- Owner: protected operations composed inside Profile.

The old Developer-zone concept is superseded by Contributor enhancements across the three navigation surfaces and focused Studio tools.

## Next Delivery Sequence

The three-surface navigation, spatial Desk, focused Studio workbench, Library scopes, Pipeline lifecycle, contextual Owner/public controls, recovery boundaries, and starter Set are shipped foundations rather than future milestones.

1. **Shared source capability projection** — make Desk, Library, Studio, and MCP consume one answer for ownership, reachability, permissions, exact-revision safety, materialization, and durable versus temporary status.
2. **Highest-value MCP parity** — close published-resource-to-personal-work, published-resource-to-Design, explicit Set output, and broader safe Pipeline/revision gaps without inventing a second workflow.
3. **Generalized revisions** — extend exact lineage, comparison, pinning, and materialization from Templates/Sets to revisionable media, fonts, and component recipes.
4. **Campaign refinement** — complete the already-integrated Desk/Library Campaign composition and shared object/tool grammar without restoring a separate Contributor destination.
5. **Specialty/Kits orchestration** — publish validated Specialty manifests, versioned Kits, semantic recipes, shared scoped data, multi-artifact Sets, and output profiles on the stable Studio foundation.

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

1. Exact focused Studio geometry for Template, record, generation, validation, and output tools across desktop/tablet/mobile.
2. Final public naming for the one authored-work container currently called Set in CardForge and Project by some provider/package paths.
3. Which object types receive direct Generate/Export from Desk versus opening the focused Studio tool.
4. Exact stable lineage/schema for revisionable fonts/media/component recipes.
5. Retention policy for heavyweight old revision payloads while preserving lightweight audit history.
6. Which personal Studio defaults belong in Profile versus the active work container.
7. When a future Production/Orders lifecycle becomes durable enough to earn a separate zone.

The three-surface navigation model, focused Studio workbench, Contributor capability layer, spatial Desk ownership, and provider-owned durable storage direction are considered approved product direction.
