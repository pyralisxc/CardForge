# CardForge Product Surface Map

Last updated: September 1, 2026

This document is the canonical placement map connecting current shipped capability owners to the approved product direction. `docs/architecture.md` remains authoritative for shipped runtime behavior. `docs/product-direction.md` owns intended product direction and delivery order.

## Status language

- **Shipped:** present in the current application/provider-backed product.
- **Shipped foundation:** a real lower-level capability exists, but the target composition is not complete.
- **Direction:** approved target placement/interaction.
- **Future:** credible later capability, not an implementation commitment.
- **Object:** work a user can select, inspect, change, organize, move, generate from, or output.
- **Tool:** an action applied to an object/surface. A tool is not automatically a destination.
- **Layer:** contextual detail shown over/beside the current object while preserving context.
- **Queue:** ordered work requiring review/follow-up.

## Scope and parity contract

- Every shipped capability remains available until a separately approved retirement/migration is complete.
- Consolidation may relocate a page into a tool/layer or combine destinations; it must not make normal actions undiscoverable or strand authored work.
- Advanced actions may move into inspectors, menus, sheets, drawers, or command access; expected actions stay visible near the object that owns them.
- Human and MCP surfaces resolve to the same native object owner, permission, revision, validation, and outcome.
- Feature/provider failures preserve boundary meaning: unavailable, auth required, not permitted, invalid input, conflict, not found, limit reached.
- Any implementation that changes placement materially updates this map in the same PR.

## Canonical private product model

| Surface | Kind | Primary object/question | Role |
| --- | --- | --- | --- |
| **Desk** | User surface | User-owned work containers and active work | The spatial account home: organize, resume, inspect, generate/export quickly, save/move, and act on owned contribution state. The current domain name is Set; provider/package labels may say Project without creating a second object. |
| **Library** | User surface | Reusable objects across Personal / entitlement-filtered Pipeline / Contributor Published scopes | Find, inspect, heart, compare, vote, source, reuse, and manage resource locations without becoming a persistence owner. |
| **Studio** | Focused workbench mode | Selected Set/artifact/Template/record/revision plus requested tool | Precision authoring, generation, validation, review-in-context, save, and output entered from selected work; not another collection or permanent navigation destination. |
| **Profile** | User surface | The person and personal relationship to CardForge | Identity, security, access, preferences, billing handoff, connection summary, temporary AI capacity, personal Contributor configuration, and protected owner operations when authorized. |
| **Production / Orders** | Future candidate | Frozen production bundle/order | Earns a zone only after CardForge owns durable quote/order/proof/tracking/reorder lifecycle. Until then production/output stays a Studio tool. |

**Contributor is a capability layer, not a permanent destination.**

The separate Developer/Cockpit destination is retired. Its shipped capabilities are composed through Desk, Library, Profile, focused Studio tools, and Profile owner operations; do not replace it with another permanent Contributor zone.

## Shared UI grammar

| Shared part | Contract |
| --- | --- |
| Primary navigation | Desk, Library, Profile. Protected owner operations appear within Profile when authorized. Studio opens from selected work. Contributor permissions enhance surfaces and tools rather than adding a destination. |
| Command band | Surface identity, current object/workspace switching, search/commands, strongest valid action. |
| Primary surface | One current object/collection dominates. Desk uses spatial object composition; Library uses collection views; Studio uses a precise canvas/tool workspace; Profile uses quiet aligned utilities. |
| Object treatment | Real authored objects use thumbnails/stacks/previews and selected depth. Comparable settings/status use rows and fine grouping. |
| Inspector/detail | Selected object raises/focuses and opens metadata, source, dependency, revision, permissions, and secondary actions. Closing restores exact prior context. |
| Action order | Primary action, one/two supporting actions, then predictable overflow. Commitment boundaries confirm explicitly. |
| Responsive behavior | Same hierarchy on desktop/mobile. Inspectors become sheets/focused views; dense data becomes compact rows, not long oversized cards. |
| Visual semantics | Imagery for authored nouns, recognizable marks for providers/sources, icons for actions/status, text for explanation. |

## Desk

### Shipped foundation

- Desk uses the shared Environment shell through the dedicated internal `home` feature owner.
- Meaningful local Sets plus recent provider/temporary work project onto one constrained visual Desk; an empty workspace stays empty until the user creates or imports work.
- Search, source filters, sort, persistent pinning, canonical CardForge card/Template preview stacks, source fallbacks, and compact account utilities are present.
- Focusing local work reveals its contained cards in place with search, selection, tags, reflective field/content facets, grid/stack/freeform arrangements, move, edit, duplicate, export handoff, and confirmed removal; Pull back restores the Desk.
- New Set opens one creation choice: a fresh Set or an independent local copy of an immutable Published Set package.
- Open, Generate, Save/Move, Rename, Duplicate, Export/print, pin, detail, exact-copy deletion, and Contributor-only Send to Pipeline resolve to their native owners. Desk hands the selected Set identity to the existing Pipeline submission tool instead of duplicating upload/publication logic.

### Direction

Desk is the user's real higher-level spatial account home, not merely a router/dashboard.

Required behavior:

- show meaningful work containers as visual authored objects;
- do not manufacture an `Untitled Set` or assign a starting Template before the user creates or imports work;
- allow constrained spatial grouping/stacks/saved views rather than a filesystem folder metaphor;
- preserve selection/position/context;
- opening a Set reveals its contained objects and pulling back restores the prior arrangement;
- expose object-scoped Open, Edit/Test, Rename, Duplicate, Delete/remove, Save/Move, Generate, Export/share where supported;
- show compact Pipeline/contribution state on Contributor-owned objects;
- expose Send to Pipeline / Submit Revision / review actions only when valid;
- keep account attention conditional and quiet.

Desk is **more spatial than Library**. Studio is more precise and tool-dense than either because it is entered for a specific change.

## Library — Personal / Pipeline / Published

### Shipped

- one Set identity pooled across device, Google Drive, and attached-folder copies, plus personal assets/fonts and temporary Studio drafts;
- search, source/location information, object detail, locations & connections tool;
- the same canonical authored-object preview used by Desk, including real published Template rendering;
- shared reviewed registry feeds Studio and exposes immutable Published Set package revisions without creating another starter registry;
- Contributor Pipeline loads every authorized shared entry plus the contributor's private work, projects one top-level object per stable lineage, keeps the current published revision primary when present, and expands revision history from the inspector;
- every account sees published Pipeline objects allowed by its entitlement; active Contributors see every Pipeline entry authorized by their scopes and gain a Published scope for their own published work;
- signed-in accounts can heart every visible Pipeline lineage; Contributors can vote up/down on every visible exact revision, with the Owner self-vote toggle enforced;
- Pipeline lifecycle, ownership, and voting are separate states: votes recorded outside active review remain feedback and cannot rebalance stable publication;
- Published and Pipeline collections use structured Template/style rendering, registry preview derivatives, real image previews where valid, semantic font samples, and truthful fallbacks instead of treating packages, fonts, or structured endpoints as images;
- Pipeline detail exposes contributor, current/published revision, lifecycle, review availability, tier, quality, votes, classification/rights, decision reasoning, and revision history. Structured Template revisions can open as an exact local Studio test copy.

### Direction

Library becomes one collection with scopes:

- **Personal:** user-owned reusable objects/resources and provider-backed content;
- **Pipeline:** published shared resources filtered to account level, enhanced with authorized review content for Contributors;
- **Published:** Contributor/Owner view over the contributor's published Pipeline work.

Rules:

- normal creators do not see unpublished Pipeline content;
- Personal/Published/Pipeline projections preserve stable lineage rather than inventing disconnected duplicate identity;
- Pipeline default view is one item per lineage, not every revision as a top-level tile;
- show current published revision when present, otherwise current/strongest active candidate;
- revisions expand from inspector;
- support Gallery, Compact List, and Expanded/Detail review densities;
- preserve current Forge Review filters and add saved views such as Needs my vote, My votes, New revisions, Near threshold, Changed since my vote, Published, Archived/recovery, family, Specialty, contributor, tier, status;
- hearts available wherever Pipeline objects display and quick exact-revision voting available to Contributors;
- testing an exact revision opens the contextual Design tool and returning restores Library scope/filter/position;
- source/rights/classification/decision detail stays available.

### Location tools

Library remains the owner of location management presentation:

- browser workspace health;
- portable project/Set packages;
- local-folder attach/save/open/reconnect/disconnect;
- Google Drive connect/folder/list/open/save-new/revision-safe update/delete/disconnect;
- default save-location preference plus verified Copy/Move between supported locations; Move never removes the source before the destination is readable;
- connected personal asset references;
- temporary AI workspace lifecycle.

CardForge Cloud Set Mirror is retired from normal runtime; do not restore it.

## Contextual creator tools — Design, Generate, Output, Pipeline

### Shipped creation foundation

- Template Studio canvas/layers/inspector/history/front/back workflows;
- text/rich text/images/icons/shapes/dividers/frames/semantic bindings;
- Template library create/clone/revise/import/export;
- single-card generation;
- bulk CSV/import mapping/validation;
- Set create/select/rename/import/export and front/back relationships;
- generated card gallery/edit/duplicate/remove;
- canonical preview/rendering;
- individual downloads/share;
- PNG ZIP, print PDF, quality/DPI, cut lines, duplex layout, TTS spritesheets;
- entitlement/watermark policy;
- portable project files;
- Google Drive/local-folder project save/open;
- temporary AI Studio-document handoff;
- command palette/mobile editor controls.

### Shipped contextual-tool consolidation

- Desk and Library retain the active Set/object context while Design, Generate, Output, Pipeline, and location controls layer over the current environment;
- Design and Generate remain the two focused authoring modes and preserve the active Set when switching;
- Generate progressively separates Template/back setup from card-data entry and validation, then returns the new card selection to its originating Desk context;
- Save/Move uses the Library storage owner, Output uses the native export owner, and Send to Pipeline embeds the native contribution owner;
- one tool-host contract owns focus restoration, Back/Escape/close unwind, crash isolation, and dirty-close rejection;
- legacy tab navigation, tab IDs, Set Library component, duplicate Studio Set Desk, and duplicate inline output surface are removed;
- `/studio` without an exact temporary document redirects to Desk Design; exact document handoffs remain compatibility ingress and install into the normal creator context;
- persisted legacy `desk`/`sets` destinations normalize without preserving a retired runtime surface.

### Current placement

Templates / Make Cards / Sets have been retired as competing top-level Studio destinations after preserving their native capability owners.

The creator tool runtime opens for one active object/tool context:

- the selected Set/object/revision and requested action determine the initial tool;
- Template editing focuses the selected Template/master;
- Generate is a contextual tool and returns outputs to the Desk;
- advanced Output is contextual and already knows object/group/Set scope;
- Save names the current durable destination;
- Library/source selection opens around the work;
- returning to Desk or Library restores the originating selection, filters, arrangement, inspector, and scroll context;
- Set switching and spatial organization stay on Desk;
- full editing power follows the focused object rather than turning every Desk object into a live editor.

### Save / contribution commitment language

- **Save · [destination]** — persist to current durable owner.
- **Save As / Move** — choose another durable location.
- **Send to Pipeline** — create a new reviewable contribution.
- **Submit Revision** — create a new reviewable revision on an existing shared lineage.
- **Publish Live** — Owner/policy boundary that changes stable Published Library truth.

Never conflate these actions.

### Contributor enhancements in Studio

- Pipeline candidates/unpublished revisions visible in source picker;
- published vs candidate/archived state explicit;
- one primary revision shown per lineage by default;
- inspector Revisions expansion;
- exact `Use this revision` pinning;
- contextual positive/negative vote on exact revision;
- compare revision/history/source/review notes;
- Send to Pipeline / Submit Revision from selected eligible objects;
- controlled rights/source/classification collection;
- candidate testing never silently publishes or updates a Project.

### New domain work required

- real Set/Project duplicate/delete actions;
- generalized Pipeline lineage for media/fonts/etc. beyond the strong Template revision model;
- exact candidate dependency pinning/materialization for durable Projects;
- shared source-capability projection;
- contributor Withdraw/Retire lifecycle distinct from Owner permanent purge.

## Profile — person and personal continuity

### Shipped

- Clerk identity/security/session management;
- access/plan presentation;
- Stripe checkout/Billing Portal handoff;
- temporary AI usage/allowance presentation;
- compact protected-access entry;
- Environment shell/focused utilities.

### Direction

Profile remains person-centered and quiet:

- actual display name/avatar rather than email-derived identity when available;
- personal Studio defaults/preferences only when ownership is truly personal;
- provider connection summary, with detailed management opening in Library;
- temporary AI capacity/retention status;
- Contributor access/scopes/meaningful personal limits when authorized;
- account/data lifecycle paths through the service that owns each datum.

Do not put work inventory or Pipeline queue here.

## Contributor capability placement

| Capability | Desk | Library | Studio | Profile |
| --- | --- | --- | --- | --- |
| Own contribution status | Compact owned-object state | Personal lineage detail | Selected-object state | Personal access only |
| Browse all Pipeline content | No | **Pipeline scope** | Through source picker/context | No |
| Vote | Owned exact revision when useful | **Primary review action** | **Contextual while testing/using** | No |
| Submit new candidate | Quick entry on eligible owned object | Possible from selected Personal object | **Native selected-object action** | No |
| Submit revision | Quick entry on linked owned object | Selected lineage action | **Native selected-object action** | No |
| Compare revisions | Inspector | **Inspector/detail** | **Inspector/detail** | No |
| Contributor scopes/limits | Attention only when meaningful | No | Permission resolves actions | **Personal configuration/status** |
| Campaign packages | Active visual shelf for authorized work | **Access-gated Campaigns scope for drafting, revision, media, and submission** | Later contextual editing where useful | Scope/status only |
| Site proposals | Retired | Retired | Retired | Historical records only; no active Contributor scope or mutation surface |

## Pipeline and revision policy

Current Forge Pipeline owner remains `contributor-assets` and associated Supabase records.

Preserve:

- lifecycle draft/submitted/voting/publish_candidate/published/archived/rejected;
- vote ledger and current-user vote;
- vote weights/self-vote policy;
- quality thresholds/capacity ranking;
- automatic archive/recovery;
- owner status/tier overrides;
- attribution/history;
- tombstoned permanent deletion.

Direction:

- one substantive revision = new immutable candidate signal;
- votes do not carry forward automatically;
- published revision stays stable until publication changes;
- Project dependencies pin exact revision/snapshot;
- revision history stays behind progressive disclosure;
- heavy old revision payload may later be pruned by policy, but lightweight audit history remains;
- Contributor may Withdraw unpublished own work and Retire published own work under policy/dependency checks;
- Owner retains permanent purge.

## Storage, providers, and MCP

### Durable user locations

- browser working/recovery copy;
- portable `.cardforge`/Set packages;
- local folders;
- Google Drive projects;
- future deliberate providers.

The `.cardforge` package is the one portability contract for import, export, provider transfer, Pipeline Set publication, and Published Set installation. Installing a Published Set creates new local Set/card/Template/resource identities while retaining the package as immutable published source material.

### Temporary CardForge-owned work

Temporary AI Studio documents only. They are revisioned, quota/retention governed, recoverable briefly after delete/expiry, and automatically cleaned. They are not project backups.

### MCP

MCP shares native owners:

- same renderer/validation/Pipeline/revisions;
- Google Drive project revision-safe checkout/commit;
- connected personal asset metadata search + explicit materialization;
- temporary working documents;
- Template Pipeline handoff.

Browser/local-folder work remains remote-inaccessible without explicit handoff or server-reachable provider save.

A future shared source-capability projection should expose human/agent reachability and revision/write/materialization semantics to both UI and MCP.

## Owner operations

Owner remains protected and auditable, but composes inside Profile rather than a separate navigation environment. `/owner` is compatibility ingress for older deep links and provider callbacks.

Current capability families remain preserved:

- action/readiness overview;
- marketing strategy/campaigns/distribution/results;
- growth/people/Contributor access/analytics/billing/contact;
- site/public-content controls;
- shared Studio Library review/publication/routing/removal;
- governance/legal/activity/retention.

Owner may reuse shared object renderers and Library review projections, but it must not become a second persistence owner or provider dashboard.

## Public site

Public remains the entrance:

- product proof/outcomes;
- plans/access explanation;
- Contributor program explanation/application;
- roadmap/voting/history;
- founder/about;
- contact/support;
- legal/policy;
- authentication;
- Specialty/Kits storytelling through outcomes.

Use Contributor in user-facing and runtime language. The former Developer, Developer Terms, standalone Profile, and Environment Lab routes are cold-cut rather than redirected; `/contributors`, `/contributor-terms`, and Account Profile are the current surfaces.

## Specialty / Kits placement

Specialties configure Desk/Library/Studio vocabulary and recommendations; they do not create separate Studios.

- Desk may group/recommend current Specialty work.
- Library ranks compatible resources.
- Studio changes suggested artifacts/components/validation/output profiles.
- Profile may retain personal default Specialty/Kit preference if truly personal.
- Pipeline contribution can carry controlled Specialty/use-case/compatibility classification.

Games remains the first active Specialty direction, including Playing Cards, Tarot/Oracle, TCG, Prototype, RPG/reference, Prompt/Trivia, coordinated Game Product, and later broader tabletop artifacts as validated by the product-direction standard.

## Feature-owner coverage ledger

| Feature owner | Current responsibility | Target home |
| --- | --- | --- |
| `account` | identity/access projection and Profile composition | Profile + compact Desk status |
| `home` | internal owner for Desk composition over native work/Library owners, including contained-card organization | Desk |
| `app-shell` | Studio bootstrap, focused mode switching, return handoffs, and contextual-tool composition | Focused Studio workbench + shared environment grammar |
| `card-generator` | generation, rendered-card editing, validation, output | Desk quick actions + focused Studio tools |
| `card-rendering` | canonical preview/render/watermark | Cross-surface service |
| `account` | ordinary signed-in account-tool capabilities, identity projection, plan, profile | Desk/Library/Profile/focused Studio/MCP account access |
| `contributor-access` | Contributor profile/scopes/access | Profile + permission resolution across Desk/Library/focused Studio; Owner people controls |
| `pipeline` | Pipeline submissions/votes/revisions/publication/registry | Library Pipeline, Studio contextual contribution/review, Owner publication |
| `contributor-program` | public program explanation/application | Public Contributor program |
| `marketing-content` | contributor campaign packages/media | Desk/Library/owning composition tool; Owner Marketing |
| `personal-library` | connected provider assets/fonts | Library + Studio source picker + MCP read |
| `project` | browser workspace, packages, folders, Drive, recovery | Desk + Library location truth + Studio save/open |
| `storage-management` | account unified inventory/location tools | Library; compact Profile summary |
| `studio-documents` | temporary AI documents/assets/revisions/MCP | Desk resume, Library temporary shelf, Studio, MCP |
| `template-editor` | Template canvas/layers/inspector/lifecycle | Studio selected Template tool |
| `mcp-usage` | assistant usage/capacity | Profile + Owner operations |
| `billing` | Stripe access/checkout/portal/webhooks | Profile/Desk status + Owner reconciliation |
| `owner` | operational authorization/composition | Profile owner operations; `/owner` compatibility ingress |

All other existing feature owners keep their native records/providers; placement changes do not transfer ownership.

## Consolidation decisions

- Three permanent user-navigation surfaces: **Desk, Library, Profile**.
- Studio is a focused authoring/production mode entered from selected work, not a fourth collection destination.
- **Contributor is a capability layer**, not a zone.
- **Owner remains protected** operations composed inside Profile.
- Desk is spatial authored-work organization, not only orientation/router.
- Library becomes a Personal / entitlement-filtered Pipeline collection, with Published added for Contributors and Owners.
- Studio provides Design/Generate/Validate/Output over the selected object, with Save/Pipeline as contextual commitments.
- Profile remains personal configuration.
- Templates / Make Cards / Sets peer Studio destinations are retired; their feature owners remain native tools.
- Developer Cockpit / nested Asset Hub navigation is retired; contribution actions resolve through Desk, Library, Profile, focused Studio tools, and Profile owner operations.
- CardForge Cloud Set Mirror remains retired.
- Provider save and Pipeline submission remain semantically separate.
- Review follows the object and is also available in Pipeline Library for deliberate batch review.
- Radial/marking interaction is a future accelerator over the same resolved actions, not a requirement for basic operation.

## Current open placement questions

1. Final public name for the one work container currently called Set in CardForge and Project by some provider/package paths.
2. Generalized revision-lineage schema for media/fonts/component recipes.
3. Heavy revision payload retention policy.
4. Which defaults belong in Profile versus Project.
5. When durable Production/Orders earns a separate zone.

These questions refine implementation; they do not reopen the three-surface navigation, focused-Studio, or Contributor-as-capability decisions.
