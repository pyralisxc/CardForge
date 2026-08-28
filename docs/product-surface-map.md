# CardForge Product Surface Map

Last updated: August 27, 2026

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
| **Home** | User surface | User-owned work containers and active work | The spatial Desk: organize, resume, inspect, generate/export quickly, save/move, and act on owned contribution state. The current domain name is Set; provider/package labels may say Project without creating a second object. |
| **Library** | User surface | Reusable objects across Personal / Published / Contributor-only Pipeline scopes | Find, inspect, compare, vote, source, reuse, and manage resource locations without becoming a persistence owner. |
| **Studio** | User surface | Active work container and selected artifact/Template/record/element | The one enhanced workbench for authoring, generation, validation, review-in-context, save, and output. |
| **Profile** | User surface | The person and personal relationship to CardForge | Identity, security, access, preferences, billing handoff, connection summary, temporary AI capacity, personal Contributor configuration. |
| **Owner** | Protected operational environment | CardForge operational queue/control record | Run CardForge, publish reviewed truth, manage people/services, operate public experience, governance, marketing, and accountable history. |
| **Production / Orders** | Future candidate | Frozen production bundle/order | Earns a zone only after CardForge owns durable quote/order/proof/tracking/reorder lifecycle. Until then production/output stays a Studio tool. |

**Contributor is a capability layer, not a permanent destination.**

The existing Developer/Cockpit route remains shipped legacy composition until its capabilities are rehomed with parity. Do not replace it with another permanent Contributor zone.

## Shared UI grammar

| Shared part | Contract |
| --- | --- |
| Primary navigation | Home, Library, Studio, Profile. Owner appears only when authorized. Contributor permissions enhance surfaces rather than adding a destination. |
| Command band | Surface identity, current object/workspace switching, search/commands, strongest valid action. |
| Primary surface | One current object/collection dominates. Home and Studio use spatial object composition; Library uses collection views; Profile uses quiet aligned utilities. |
| Object treatment | Real authored objects use thumbnails/stacks/previews and selected depth. Comparable settings/status use rows and fine grouping. |
| Inspector/detail | Selected object raises/focuses and opens metadata, source, dependency, revision, permissions, and secondary actions. Closing restores exact prior context. |
| Action order | Primary action, one/two supporting actions, then predictable overflow. Commitment boundaries confirm explicitly. |
| Responsive behavior | Same hierarchy on desktop/mobile. Inspectors become sheets/focused views; dense data becomes compact rows, not long oversized cards. |
| Visual semantics | Imagery for authored nouns, recognizable marks for providers/sources, icons for actions/status, text for explanation. |

## Home — Desk

### Shipped foundation

- Home uses the shared Environment shell through the dedicated `home` feature owner.
- Meaningful local Sets plus recent provider/temporary work project onto one constrained visual Desk; the untouched bootstrap Set stays out of the meaningful-work view.
- Search, source filters, sort, persistent pinning, canonical CardForge card/Template preview stacks, source fallbacks, and compact account utilities are present.
- Focusing local work reveals its contained cards in place with search, selection, move, edit, duplicate, export handoff, and confirmed removal; Back restores the Home Desk.
- New Set opens one creation choice: a fresh Set or an independent local copy of an immutable Published Set package.
- Open, Generate, Save/Move, Rename, Duplicate, Export/print, pin, detail, and exact-copy deletion resolve to their native owners.

### Direction

Home becomes the user's real higher-level spatial Desk, not merely a router/dashboard.

Required behavior:

- show meaningful work containers as visual authored objects;
- do not promote untouched bootstrap `Untitled Set` state as meaningful work;
- allow constrained spatial grouping/stacks/saved views rather than a filesystem folder metaphor;
- preserve selection/position/context;
- opening a Set reveals its contained objects and pulling back restores the prior arrangement;
- expose object-scoped Open, Edit/Test, Rename, Duplicate, Delete/remove, Save/Move, Generate, Export/share where supported;
- show compact Pipeline/contribution state on Contributor-owned objects;
- expose Send to Pipeline / Submit Revision / review actions only when valid;
- keep account attention conditional and quiet.

Home is **more spatial than Library** and less detailed than Studio.

## Library — Personal / Published / Pipeline

### Shipped

- one Set identity pooled across device, Google Drive, and attached-folder copies, plus personal assets/fonts and temporary Studio drafts;
- search, source/location information, object detail, locations & connections tool;
- the same canonical authored-object preview used by Home, including real published Template rendering;
- shared reviewed registry feeds Studio and exposes immutable Published Set package revisions without creating another starter registry;
- Developer Asset Hub / Forge Review currently exposes voteable Pipeline submissions, filters, previews, status/tier/quality/votes/revisions.

### Direction

Library becomes one collection with scopes:

- **Personal:** user-owned reusable objects/resources and provider-backed content;
- **Published:** stable reviewed CardForge shared resources;
- **Pipeline:** Contributor-only reviewed contribution content.

Rules:

- normal creators do not see unpublished Pipeline content;
- Personal/Published/Pipeline projections preserve stable lineage rather than inventing disconnected duplicate identity;
- Pipeline default view is one item per lineage, not every revision as a top-level tile;
- show current published revision when present, otherwise current/strongest active candidate;
- revisions expand from inspector;
- support Gallery, Compact List, and Expanded/Detail review densities;
- preserve current Forge Review filters and add saved views such as Needs my vote, My votes, New revisions, Near threshold, Changed since my vote, Published, Archived/recovery, family, Specialty, contributor, tier, status;
- quick voting available directly in Pipeline scope;
- Test in Studio opens the exact selected revision and returning restores Library scope/filter/position;
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

## Studio — Set Desk and contextual tools

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

### Direction

Retire Templates / Make Cards / Sets as competing top-level Studio destinations only after parity.

Studio opens to one active Set Desk:

- selected object determines tools;
- Template editing focuses the selected Template/master;
- Generate is a contextual tool and returns outputs to the Desk;
- Export is contextual and already knows object/group/Set scope;
- Save names the current durable destination;
- Library/source selection opens around the work;
- Set switching preserves per-Set selection/viewport;
- stacks/groups preserve stable IDs;
- full editing power follows focused object rather than turning every overview object into a live editor.

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

| Capability | Home | Library | Studio | Profile |
| --- | --- | --- | --- | --- |
| Own contribution status | Compact owned-object state | Personal lineage detail | Selected-object state | Personal access only |
| Browse all Pipeline content | No | **Pipeline scope** | Through source picker/context | No |
| Vote | Owned exact revision when useful | **Primary review action** | **Contextual while testing/using** | No |
| Submit new candidate | Quick entry on eligible owned object | Possible from selected Personal object | **Native selected-object action** | No |
| Submit revision | Quick entry on linked owned object | Selected lineage action | **Native selected-object action** | No |
| Compare revisions | Inspector | **Inspector/detail** | **Inspector/detail** | No |
| Contributor scopes/limits | Attention only when meaningful | No | Permission resolves actions | **Personal configuration/status** |
| Campaign/site contribution | Active owned work where useful | Reusable resources where appropriate | Owning composition tool / legacy bridge until parity | Scope status only |

## Pipeline and revision policy

Current Forge Pipeline owner remains `developer-assets` and associated Supabase records.

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

## Owner environment

Owner remains a separate protected operational environment.

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

Use Contributor in user-facing role language. Technical `/developer` compatibility may remain until a deliberate route migration.

## Specialty / Kits placement

Specialties configure Home/Library/Studio vocabulary and recommendations; they do not create separate Studios.

- Home may group/recommend current Specialty work.
- Library ranks compatible resources.
- Studio changes suggested artifacts/components/validation/output profiles.
- Profile may retain personal default Specialty/Kit preference if truly personal.
- Pipeline contribution can carry controlled Specialty/use-case/compatibility classification.

Games remains the first active Specialty direction, including Playing Cards, Tarot/Oracle, TCG, Prototype, RPG/reference, Prompt/Trivia, coordinated Game Product, and later broader tabletop artifacts as validated by the product-direction standard.

## Feature-owner coverage ledger

| Feature owner | Current responsibility | Target home |
| --- | --- | --- |
| `account` | identity/access projection and Profile composition | Profile + compact Home status |
| `home` | two-scale Home Desk composition over native work/Library owners | Home |
| `app-shell` | Studio bootstrap/navigation/handoffs | Studio + shared environment grammar |
| `card-generator` | generation, gallery, Set management, output | Home quick actions + Studio tools |
| `card-rendering` | canonical preview/render/watermark | Cross-surface service |
| `developer-access` | Contributor profile/scopes/access | Profile + permission resolution across Home/Library/Studio; Owner people controls |
| `developer-assets` | Pipeline submissions/votes/revisions/publication/registry | Library Pipeline, Studio contextual contribution/review, Owner publication |
| `developer-cockpit` | current protected composition/legacy contribution surfaces | **Legacy migration source; retire destination after parity** |
| `developer-program` | public program explanation/application | Public Contributor program |
| `marketing-content` | contributor campaign packages/media | Home/Library/owning composition tool; Owner Marketing |
| `personal-library` | connected provider assets/fonts | Library + Studio source picker + MCP read |
| `project` | browser workspace, packages, folders, Drive, recovery | Home + Library location truth + Studio save/open |
| `storage-management` | account unified inventory/location tools | Library; compact Profile summary |
| `studio-documents` | temporary AI documents/assets/revisions/MCP | Home resume, Library temporary shelf, Studio, MCP |
| `template-editor` | Template canvas/layers/inspector/lifecycle | Studio selected Template tool |
| `mcp-usage` | assistant usage/capacity | Profile + Owner operations |
| `billing` | Stripe access/checkout/portal/webhooks | Profile/Home status + Owner reconciliation |
| `owner` | operational authorization/composition | Owner |

All other existing feature owners keep their native records/providers; placement changes do not transfer ownership.

## Consolidation decisions

- Four permanent user surfaces: **Home, Library, Studio, Profile**.
- **Contributor is a capability layer**, not a zone.
- **Owner remains separate** operations.
- Home becomes spatial Desk, not only orientation/router.
- Library becomes Personal / Published / Contributor-only Pipeline collection.
- Studio becomes one Set Desk with Generate/Export/Save/Review as tools.
- Profile remains personal configuration.
- Retire Templates / Make Cards / Sets as peer Studio destinations only after parity.
- Retire Developer Cockpit / nested Asset Hub navigation only after every shipped action has a new home.
- CardForge Cloud Set Mirror remains retired.
- Provider save and Pipeline submission remain semantically separate.
- Review follows the object and is also available in Pipeline Library for deliberate batch review.
- Radial/marking interaction is a future accelerator over the same resolved actions, not a requirement for basic operation.

## Current open placement questions

1. Exact spatial geometry/persistence for Home Desk.
2. Exact Set Desk geometry/virtualization across screen sizes.
3. Final public name for the one work container currently called Set in CardForge and Project by some provider/package paths.
4. Which Home objects get direct Generate/Export versus opening focused Studio tool.
5. Generalized revision-lineage schema for media/fonts/component recipes.
6. Heavy revision payload retention policy.
7. Which defaults belong in Profile versus Project.
8. When durable Production/Orders earns a separate zone.

These questions refine implementation; they do not reopen the four-surface model or Contributor-as-capability decision.
