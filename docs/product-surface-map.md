# CardForge Product Surface Map

Last updated: September 12, 2026

This document is CardForge's canonical **placement map**. It answers where capabilities belong and whether a placement is shipped, direction, or future. It deliberately does not duplicate runtime ownership, provider contracts, detailed feature inventories, or implementation history.

- `docs/architecture.md` owns shipped runtime ownership and invariants.
- `docs/product-direction.md` owns intended product meaning and delivery sequence.
- `docs/integrations.md` owns provider seams.
- `docs/operations.md` owns operational procedure.
- the live `/roadmap` owns publicly presented capability status and votes.

When placement changes materially, update this map in the same accepted feature change. Do not preserve superseded layouts here for historical context; Git history owns that archaeology.

## Status language

- **Shipped:** present in the current application/provider-backed product.
- **Shipped foundation:** a real lower-level capability exists, but the intended composition is incomplete.
- **Direction:** approved target placement/interaction, not necessarily shipped.
- **Future:** credible later capability, not an implementation commitment.
- **Object:** authored or managed work a user can select, inspect, change, organize, move, generate from, or output.
- **Tool:** an action applied to an object/surface; a tool is not automatically a destination.
- **Layer:** contextual detail shown over/beside current work while preserving context.

## Placement invariants

- Permanent signed-in navigation is **Desk / Library / Profile**.
- **Studio is a focused workbench mode**, not a fourth collection destination.
- **Contributor is a capability layer**, not a permanent destination.
- Protected **Owner** operations compose through the surfaces that own the underlying work; Profile carries owner-only utilities that are genuinely person/governance scoped.
- One current object/collection should dominate the available center workspace. Do not nest a second visual "page" around a spatial work surface merely to repeat shell chrome.
- Expected actions stay near the object/surface that owns them; advanced actions may move into inspectors, menus, sheets, drawers, or command access.
- Placement changes do not transfer persistence or provider ownership. The native feature owner remains authoritative unless Architecture changes explicitly.
- Human and MCP paths resolve to the same native object owner, permission, revision, validation, and outcome.
- Feature/provider failures preserve their real boundary meaning; placement must not relabel unavailable/auth/conflict/not-found as empty or success.

## Canonical private product model

| Surface | Kind | Primary question | Placement contract |
| --- | --- | --- | --- |
| **Desk** | Permanent user surface | What work am I actively organizing or resuming? | Spatial account home for user-owned work containers, active Sets, provider/temporary projections, quick object actions, and entry into focused tools. |
| **Library** | Permanent user surface | What reusable/published/provider-backed resources can I find or manage? | Collection surface for Personal, Pipeline, Published, Campaign, asset, and location-management projections without becoming their persistence owner. |
| **Studio** | Focused workbench mode | What exact object/tool am I changing right now? | Precision Design/Generate/Output/Pipeline work entered from selected context; closes back to the originating Desk/Library state. |
| **Profile** | Permanent user surface | Who am I and what is my relationship to CardForge? | Identity, access, preferences, billing handoff, personal Contributor configuration, connection summary, and protected owner/person-level utilities. |
| **Production / Orders** | Future candidate | Is there durable quote/order/proof/tracking lifecycle? | Earns a permanent zone only after CardForge owns that lifecycle; until then production/output remains a Studio tool. |

The former Developer/Cockpit destination is retired. Do not recreate it under a new name.

## Shared shell and responsive grammar

### Shipped

- Primary navigation has one owner: **Desk / Library / Profile**.
- Signed-in top-right identity is account/avatar only; signed-out retains Sign in.
- The shell top rail owns contextual search/command access. Private surfaces do not grow duplicate top-level search owners.
- The bottom status rail owns compact workspace truth such as open-project count, Storage health, and browser-save state; those signals remain reachable on compact screens.
- Surface-specific controls stay with the surface. Desk Camera/Grid/Snap, for example, live outside the Desk world camera rather than consuming world coordinates.
- Narrow layouts compress labels/actions and move detail into compact presentation without silently deleting important capability.
- Portaled menus/dialogs keep normal event ownership; spatial surfaces claim only events that actually belong to them.

### Direction

Keep shell grammar stable across permanent surfaces. New cross-product chrome must justify why an existing shell owner cannot express it.

## Desk

### Shipped

- Desk uses one bounded logical spatial world for work containers; the available center workspace is the Desk surface rather than an outer page containing a second bordered Desk.
- Desk opens in **Fit** camera mode. Fit tracks viewport resize/orientation; **Custom** preserves the user's relative zoom and focal position.
- Meaningful local/provider/temporary work projects into Desk without manufacturing starter work before the user creates/imports something.
- Set positions persist. Desktop direct drag is the native spatial move interaction; keyboard/menu positioning remains an accessible non-drag path.
- Selection is object-local visual state. Selecting a Set does not manufacture a separate top selection rail.
- Double activation/Enter opens work; explicit object actions remain in predictable overflow/command paths.
- Opening a Set and then an Artifact preserves one spatial grammar and the full center workspace. Returning restores prior camera/selection context.
- Set presentation density is independent of camera zoom: small collections stay comfortable, larger collections compact/densify, and stacks compact further.
- Fit is an overview, not permission to reduce a large Set to unreadable dots. A physical readability floor may intentionally leave large Sets pannable.
- Focused individual Artifacts return to comfortable presentation even when their Set is dense.
- Inline scene controls render only when the Artifact has enough physical width to own the hit target; dense cards keep direct pointer/touch selection and pan behavior.
- Campaign and published/contribution projections remain projections of their native owners rather than duplicate Desk-owned records.

### Direction

Desk remains the higher-level spatial account home: organize, group, stack, sort, resume, inspect, and act on owned work without becoming an unconstrained infinite canvas or filesystem folder tree.

## Library

### Shipped

Library is one collection environment with capability-dependent scopes, including:

- **Personal** — user-owned reusable/project/provider-backed work and resources;
- **Pipeline** — published shared resources for normal accounts plus authorized review content for Contributors;
- **Published** — contributor/owner view over the contributor's published Pipeline work;
- **Campaigns** — access-gated campaign packages owned by the marketing-content domain where authorized.

Library owns collection/location **presentation**, not underlying persistence. It provides search/filter/detail, published/review projections, and Locations & connections around native owners.

### Location tools — shipped

Locations & connections is one native tool reachable from the relevant creator context. It presents:

- browser workspace health;
- portable `.cardforge`/Set packages;
- authorized local folders;
- connected Google Drive project location;
- default location/Copy/Move capabilities where supported;
- connected personal asset references;
- temporary AI workspace lifecycle.

Google Drive folder selection may use existing writable personal/shared folders. The UI identifies the active folder and destination changes refresh the relevant Library/Desk projection without requiring a full page reload. Detailed OAuth, resource-key, revision, thumbnail, reconnect, and failure semantics remain owned by `docs/integrations.md` and the Google Drive setup runbook.

Move never removes a source before the destination is verified readable according to the native owner. CardForge Cloud Set Mirror remains retired.

## Studio — contextual creator workbench

### Shipped

Studio is entered for one selected object/tool context rather than navigated as a competing collection.

- **Design** owns precision Template/card design around the selected object.
- **Generate** owns structured creation/mapping/validation and returns created work to its originating context.
- **Output** owns export/production actions with the current object/Set scope already resolved.
- **Pipeline** contribution/review actions embed the native Pipeline owner when permitted.
- Save/Move delegates to the native project/location owner.
- `/studio` is compatibility ingress into the same contextual runtime, including exact temporary Studio-document handoff; it is not a second application.
- one tool-host contract owns close/back/Escape unwind, focus restoration, crash isolation, and dirty-close rejection.

Templates / Make Cards / Sets are not peer top-level Studio destinations. Their feature owners remain native tools/capabilities inside the contextual workbench.

### Commitment language

Keep these meanings distinct:

- **Save · [destination]** — persist to current durable owner.
- **Save As / Copy** — create an independent durable copy where supported.
- **Move** — create/verify destination, then remove source only under the native safe-transfer contract.
- **Send to Pipeline** — create a reviewable contribution.
- **Submit Revision** — create a new reviewable revision on an existing shared lineage.
- **Publish Live** — Owner/policy boundary that changes stable Published Library truth.

## Profile

### Shipped

Profile remains person-centered:

- Clerk identity/security/session management;
- access/plan presentation and Stripe billing handoff;
- personal settings/defaults that are genuinely person scoped;
- temporary assisted-work usage/capacity presentation;
- Contributor access/scopes/personal configuration when authorized;
- provider-connection summary with detailed location management delegated to Library;
- protected owner/person/governance utilities when authorized.

Do not put work inventory or Pipeline queues in Profile merely because they belong to the signed-in account.

## Contributor capability placement

| Capability | Desk | Library | Studio | Profile |
| --- | --- | --- | --- | --- |
| Own contribution state | Compact object state | Lineage/detail | Selected-object state | Personal access summary only |
| Browse shared Pipeline | No broad queue | **Primary collection** | Source/context only | No |
| Vote/review | Only where object-local action is useful | **Primary batch/detail action** | Contextual while testing/using | No |
| Submit candidate/revision | Eligible object quick entry | Selected Personal/lineage entry | **Native selected-object action** | No |
| Compare revisions | Inspector/detail | **Inspector/detail** | **Inspector/detail** | No |
| Contributor scopes/limits | Attention only when meaningful | Permission-filtered content | Permission resolves actions | **Personal configuration/status** |
| Campaign packages | Authorized work objects | **Campaigns scope** | Contextual editing where useful | Scope/status only |

Site proposals remain retired as an active Contributor capability.

## Storage, providers, and MCP placement

### Durable user locations

- browser working/recovery copy;
- portable `.cardforge`/Set packages;
- authorized local folders;
- Google Drive projects;
- future deliberate providers.

The `.cardforge` package remains the portability contract for import/export/provider transfer and published Set installation. Storage semantics and exact identity/revision contracts belong to Architecture/Integrations, not this placement map.

### Temporary CardForge-owned work

Temporary AI Studio documents are revisioned, quota/retention governed working documents. They are not project backups or another durable project owner.

### MCP

MCP exposes the same native owners rather than alternate product surfaces: rendering/validation, temporary working documents, provider-backed project checkout/commit where reachable, connected asset materialization, and Pipeline handoff according to permission.

Browser/local-folder work remains remote-inaccessible without explicit handoff or a server-reachable provider copy.

## Owner operations

Owner remains protected and auditable but is not a separate product universe.

- Campaign operations live with Campaigns.
- Pipeline review/publication lives with Pipeline/Library.
- public-site controls live with their public/content owners.
- Roadmap mutations live with `/roadmap`.
- person/governance/authorization utilities that genuinely belong to the account compose through protected Profile owner controls.
- `/owner` remains compatibility ingress for older callbacks/deep links where required.

Owner composition must not become a second persistence owner or provider dashboard.

## Public site

Public remains the entrance for product proof, plans/access explanation, Contributor program, roadmap/history, founder/about, contact/support, legal/policy, authentication, and Specialty/Kits storytelling through outcomes.

Use **Contributor** in current user-facing/runtime language. Retired Developer/Cockpit surfaces must not reappear as parallel destinations.

## Specialty / Kits placement

Specialties configure vocabulary, recommendations, validation, components, and output profiles across Desk/Library/Studio. They do not create separate Studios.

Games remains the first active Specialty direction; later artifact families must satisfy the validation standard in `docs/product-direction.md` rather than earning surfaces by taxonomy alone.

## Consolidation decisions that are not open

- Permanent user navigation is **Desk / Library / Profile**.
- Studio is focused workbench mode, not a permanent collection destination.
- Contributor is a capability layer, not a zone.
- Owner is protected authority composed through native surfaces, not another persistence/product universe.
- Desk is spatial authored-work organization.
- Library is collection/reuse/review/location presentation.
- Provider save and Pipeline submission are separate commitments.
- Review follows the object and also has a deliberate Pipeline Library home.
- CardForge Cloud Set Mirror remains retired.
- Radial/marking interaction, if added later, accelerates already-resolved actions rather than replacing discoverable basic operation.

## Current open placement questions

1. Final public name for the one work container currently called **Set** in CardForge and **Project** in some provider/package paths.
2. Generalized revision-lineage placement for media/fonts/component recipes as those owners mature.
3. Which truly personal defaults belong in Profile versus Set/Project scope.
4. When durable Production/Orders lifecycle earns a separate permanent surface.

These questions may refine placement. They do not reopen the three-surface navigation, focused-Studio model, or Contributor-as-capability decision.
