# CardForge Product Direction

Status: branch-local product and interaction context, not an implementation inventory or second future roadmap. These experience contracts include intended behavior; use the [revision guide](revision-guide.md) and [architecture](architecture.md) to check source ownership and evidence limits. The live `/roadmap` owns publicly presented capability status and votes.

The [Confluence blueprint](https://pyralisholdings.atlassian.net/wiki/spaces/PYPH/pages/590018) owns cross-branch future direction, founder decisions, and open questions; its [version roadmap](https://pyralisholdings.atlassian.net/wiki/spaces/PYPH/pages/1966082) owns milestone targets. In particular, desired independently owned Set Templates differ from this revision's shared Template-reference model. Resolve that difference before changing ownership; do not present the goal as shipped. If Confluence is unavailable, retain this branch's context and flag newer direction as unchecked. Source, tests, deployment, and provider evidence remain separate.

The [Experience, Surfaces and Authority protocol](https://pyralisholdings.atlassian.net/wiki/spaces/PYPH/pages/2785295) owns the durable intended UX/UI geography, authority projection, placement rules, states and handoffs. This document retains branch-local interaction context; the [shared shell source map](revision-guide.md#shared-shell-source-map) identifies the implemented projection and its verification limits, not a second intended surface matrix.

## Product Thesis

CardForge is one structured visual-production environment for repeatable, coordinated visual sets. It is not a collection of separate editors and it is not limited to game cards.

The shared promise is:

> Design once. Add structured information. Generate the whole coordinated set.

Working positioning:

> CardForge is the structured design studio for repeatable visual sets.

The engine stays broad. Specialties, Kits, permissions, and connected providers change what is suggested or available; they do not fork the core product.

The **current offered product remains card-first**. Broader Artifact families are architectural runway, not a marketing claim or a reason to make today's CardForge generic. New families earn product status only after their native authoring, validation, output, and continuity contracts are real.

## Controls, defaults, and familiar lifecycles

Desired contract: offer a coherent normal flow and meaningful safe alternatives, not one hard-coded implementation preference. The [Confluence configurability principle](https://pyralisholdings.atlassian.net/wiki/spaces/PYPH/pages/917505) owns the cross-branch direction. Product defaults and supported policies belong on the proper authorized Owner surface; personal preferences belong in the user's settings and work-specific choices stay with the Set. Separate website and product authority where the setup requires it; that separation is not established merely by the current shared Owner role. Reveal advanced controls progressively instead of requiring configuration before ordinary work.

A default supplies an initial value, not permission to silently replace an explicit user choice. Mandatory policy, authorization, commercial entitlement, finite service capacity, provider permission and file/runtime constraints are different facts. Explain which one actually limits an action and offer a supported alternative; unknown/loading/unavailable is not zero capacity or a Free-plan downgrade. Browser space is not a CardForge-metered allowance. An Owner setting cannot invent an unsupported provider feature or bypass safety, authorization or accepted commitments. See [Technical Contracts](https://pyralisholdings.atlassian.net/wiki/spaces/PYPH/pages/917545) for the authority distinctions.

Use familiar object lifecycles through their existing feature owners: Save commits the advertised work; Save As/Copy creates an independent destination/identity; Move removes the exact source only after verified destination persistence; Trash/Restore differs from permanent deletion; disconnect/revoke/uninstall differs from deleting work or canceling external billing; Save/Submit/Publish are distinct commitments. Preserve scope, dirty-state warnings, Cancel before commitment, and truthful committed/failed/unknown results. After a possible external commit, reconcile before retrying rather than promising that Cancel or a generic Undo reverses it. Do not add a universal sync, version-control UI, retry queue, or settings framework merely to make these interactions consistent.

## The Three Private Surfaces and Focused Workbench

CardForge has three permanent user-navigation surfaces and one focused workbench mode:

| Surface | Core question | Product role |
| --- | --- | --- |
| **Desk** | How am I working on my content? | The spatial, context-first route from the Set overview into the user's authored work, selected objects, fields and tools. |
| **Library** | How do I browse and work with my content? | The structured, tab-based route through Sets, Templates, Artifacts and reusable resources across Personal, Pipeline and authorized Published scopes, with the same valid native actions as Desk. |
| **Profile** | Who am I here, and what follows me? | Identity, security, plan/access, preferences, provider summary, temporary AI capacity, and personal role configuration. |
| **Studio workbench** | What am I changing or producing right now? | A focused mode entered from selected work for authoring, generation, review-in-context, validation, saving, and output. It is not another collection or permanent navigation destination. |

**Contributor is not another surface.** Contributor is a protected capability layer that enhances Desk, Library, focused Studio tools, and Profile.

**Owner is a protected capability layer across native surfaces, with cross-product operations composed in Profile.** The Owner's recurring job remains operating CardForge itself—publishing reviewed truth, managing people/services, inspecting accountable history, and resolving operational queues—but it does not create a fourth navigation surface. Object-specific authority stays with its native job, such as Pipeline review in Library or website editing on the public page.

The browser Owner experience and the dedicated **CardForge Owner** agent/plugin surface are two clients of the same feature-owned control plane. The Owner plugin is not a fourth private navigation zone and does not share CardForge Studio's creator tool catalog. It reuses the same Clerk identity plus server-resolved Owner authority, canonical state, validation, revision/conflict rules, cache invalidation, and activity history as browser Owner operations.

The agent installation model has **two CardForge product plugins and four clearly named environment connections**, not four implementations or another Contributor product. CardForge Studio (creator and scoped Contributor capabilities) and CardForge Owner (server-enforced Owner operations) each use their canonical production MCP endpoint. Studio Preview and Owner Preview are **unpublished developer plugins**, installed through supported developer settings rather than a public marketplace. Private/developer describes distribution, not website secrecy or network isolation. Preview is the publicly reachable live testing website: testers use the same CardForge sign-in, consent and server-enforced role workflows as Production, with separate Development accounts and Staging providers. Public pages are accessible without a Vercel account; private account data and privileged operations remain protected by CardForge. The four connections share canonical Studio/Owner code, tool contracts and feature-owned commands. Verify actual server environment rather than a plugin display name. A plugin or Work browser session is an authorized client, not a provider credential, a second state owner, or permission to publish Production because Staging passed. Production Studio publication and Owner operation have independent gates; staging records never automatically copy into Production.

For the public property, **code defines capability, the Owner publishes presentation, and providers supply the facts they own**. Vercel Preview proves changes to what the site can do; ordinary production copy/media/navigation/SEO/presentation changes publish through the live Owner surface. Do not add a staging-to-production content-promotion CMS merely to reproduce that solo-owner workflow.

Owner-directed website editing should feel like operating the page: inspect the canonical state, change a supported block or stage, save through the shared revision-safe command, and visually verify the result. Technical revisions prevent overwrites; they are not a separate founder-facing feature-planning or approval workflow for routine reversible presentation edits.

The homepage showcase uses a bounded, ordered vocabulary of screenshot views and real rendered demonstration Sets, with each screenshot referring only to an Owner-managed public media slot. Browser Owner and Owner MCP edit the same approved stage sequence while preserving existing pinned Template examples. Legacy stage copy stays active until the Owner explicitly publishes a new sequence; adding a stage must not silently relabel an unrelated screenshot. Authenticated screenshots are acquired only from a purpose-built demonstration session with private account information excluded, not by borrowing arbitrary user sessions or credentials. Arbitrary executable blocks, routes, full Sites/CMS creation and auto-publishing private screenshots are not part of this step.

The approved long-term direction is a **website creator built from CardForge's own design capabilities**, beginning with CardForge's first-party pages as the proving ground. Ordinary copy, layout, responsive presentation, artwork, calls to action, feature explanations and page arrangement should become Owner-controlled design operations rather than source edits. New executable primitives, account authorization, product capabilities, payment/provider integrations, routing/security and shared renderer improvements remain engineering-owned. Site editing must not execute arbitrary HTML/CSS/JavaScript, allow remote unvetted embeds, or leak signed-in creator work.

The first coherent Owner Site Composer foundation uses the **existing Owner settings row** and published public media owner. The existing site stays exactly as published unless explicitly changed. Owners can add/remove/reorder validated content sections, choose stack/split/grid responsive patterns, theme/spacing/alignment, edit named blocks (headlines, text, features, managed imagery and internal actions), and edit their walkthrough stages. Browser page selection and focused Owner MCP tools operate through the same guarded command and revision. New section image slots are scoped to stable source-block identifiers, stored with other Owner media, and must be deliberately uploaded/published; duplicated blocks may deliberately reuse those published images or select a new independent slot. First-party pages use the same trusted composition, with safe unreserved paths, navigation and SEO in the existing settings row. Unpublished pages are excluded from public routes, sitemap, navigation and serialized public props. The browser supports section/block duplication, local undo/redo/cancel and script-disabled desktop/tablet/phone draft canvases using the live renderer. Existing provider-controlled pages and facts remain native. Pixel-level handles, arbitrary executable content and richer typography are not implied by these supported operations. Real marketing screenshots require consentful demo-session capture, visual review and Owner media publication; an automated browser fixture is not proof of the founder's signed-in private state.

The public site remains CardForge's entrance and explanation surface, not another private workspace.

## Product Language

The following vocabulary records this revision's product model and proposed concepts. Specialty, Kit, and future Artifact families are not a verified inventory of implemented features:

- **Studio:** the focused authoring, generation, review, validation, save, and output workbench opened for a selected Set, Artifact, Template, record, or revision.
- **Desk:** the persistent work-container-scale spatial surface and personal account home over real CardForge objects. It preserves selection, grouping, position, and return context without becoming a new persistence owner.
- **Focused workbench:** the precision editing mode that keeps active Set/object identity and return context while Design, Generate, validation, Save, Output, or Pipeline tools operate on it.
- **Library:** one collection/read model over reusable objects and their native owners. Library does not become a second file registry or sync engine.
- **Pipeline:** the shared-content lifecycle behind discovery, hearts, contribution, revision voting, publication, archive/recovery, and attribution. Every account sees the published Pipeline content its entitlement allows; Contributors additionally see authorized unpublished/review history and exact-revision votes.
- **Contributor:** an approved user with additional contribution/review capabilities. Contributor access changes valid actions and visible Pipeline content; it does not create a parallel CardForge product.
- **Specialty:** a guided lens over Studio for a market/body of work such as Games, Events, Retail, or Learning. It changes recommendations, vocabulary, validation, and Kits, not the underlying editor.
- **Kit:** a versioned starting workflow inside a Specialty that defines a useful outcome, suggested artifacts, fields, components, validation, and output profiles.
- **Work container:** the creator's durable body of coordinated work: records, layouts, Artifacts, assets, output settings, and selected Specialty/Kit context. The current CardForge domain name is **Set**; provider/package surfaces may still say **Project**. These are one product object, not a parent/child hierarchy or parallel registry. A Set may intentionally reference reusable Templates before any Artifact has been generated. The final public label remains a naming decision, not an architectural split.
- **Artifact:** one produced/content-bearing thing inside a work container. In the current card domain, one Artifact is one whole card with stable identity, a required front face, and an optional back face. Future artifact families may be single-surface documents such as posters, badges, boards, tokens, or social graphics without changing the identity rule.
- **Face:** a rendering side inside a multi-face Artifact. Card fronts are required; card backs are optional. A face is not a second card Artifact.
- **Template/master:** reusable design authority for layout, style, field contract, and face role. In this revision's model, Sets reference Templates without owning them; multiple Sets may intentionally share the same Template lineage. This is not the blueprint's newer independent Set-owned Template direction; see the [revision guide](revision-guide.md#journey-duplicate-save-export-and-reopen-work) and Confluence blueprint before changing ownership.
- **Component recipe:** a semantic insertable assembly made from existing Studio primitives.
- **Field contract:** the typed structured data expected by a Template or component recipe.
- **Output profile:** a recorded intended destination contract for download, digital publishing, print preparation, or provider fulfillment. The proposed CardForge **print-ready** profile owns vendor-neutral trim/bleed/safe geometry, front/back orientation, imposition/preflight, color/output-intent behavior, and deterministic production packaging; a printer/provider profile specializes that contract for a real vendor rather than defining the generic model. This is not proof of independent press validation or printer acceptance.

The recommended internal/owner-facing phrase remains **Studio Specialty**. Specialty is guidance, not a prison.

## Workbench Doctrine

The following interaction doctrine records the model for this revision; individual implementations, accessibility and deployed behavior require verification.

CardForge should reveal capability progressively without turning each feature, Specialty, Artifact, permission, or provider into a page.

The user's current object remains grounded in its originating surface: tools open around it or enter the focused Studio workbench, and closing the tool returns to the same selection, grouping, zoom, position, and broader context. Desk owns spatial organization; Studio owns precision change and production.

Core rules:

1. Keep the current object and primary next action visible.
2. Let tools **reveal**, not navigate, whenever the current surface already owns the job.
3. Move advanced controls into inspectors, drawers, focused panels, sheets, or popovers that preserve context.
4. Let each feature own its actions/domain state. Shared presentation resolves and arranges actions; it does not become a second owner for Sets, generation, export, Pipeline, storage, or validation.
5. Use the same selection/action contract across visible buttons, menus, keyboard commands, mobile sheets, future radial/marking interaction, and agent actions: **focus supplies context; selection supplies scope**. Selection actions must remain discoverable without entering an unrelated organization mode.
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

The recorded Desk model calls for the following, where supported:

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

Opening a work container unfolds its three-to-five representative Artifacts into the Set spread, with additional Artifacts emerging from that same origin. Focus and Edit continue moving the same Artifact while the surrounding tools change. Returning reverses the movement and restores the original arrangement. This requires visible geometry and uninterrupted object identity, not merely retained data or a mounted background container.

The Desk and open Set are one continuous **Creator Spatial Environment** rather than bounded page-layout canvases. Authored objects live in signed parent/local coordinate spaces and remain stable unless the creator explicitly moves or resizes them. Desk Set placement is personal workspace organization; Artifact placement inside a Set is portable Set-authored organization. Derived content bounds may grow or shrink in every direction, but bounds never rebase siblings or move the camera. **Fit Work**, **Fit Selection**, and **Whole** are explicit camera commands; ordinary entry uses Fit Work with useful breathing room, while any direct pan, zoom, drag, marquee, wheel, or pinch yields to **Custom**. Custom camera projection is signed independent state and is never driven by scroll-surface dimensions, provider arrival, filtering, or changing world extents.

Physical work uses one canonical measurement model from Studio through Set organization and output. Printable Artifact dimensions resolve from the same Template/CardFormat truth used by export, with millimeters as the canonical physical unit and creator-facing display in millimeters, centimeters, inches, or canvas pixels where a real pixel mapping exists. A Letter sheet therefore occupies genuinely more Set space than a poker card at the same camera scale. Each coordinate space owns or inherits a configurable lattice used by grid, snap, resize, rulers, guides, and keyboard movement; showing the grid and snapping to it remain independent preferences. Changing preferred units, lattice visibility, snap state, camera zoom, or derived bounds never changes authored physical dimensions.

Desk and Set use one orthographic world-to-screen transform per active spatial view. Grid, objects, selection chrome, world labels, and transient guides may render in separate DOM layers but consume the same camera transform. Gentle edge-pan moves the camera while a dragged object remains attached to the pointer; non-dragged objects keep their authored transforms. Culling and semantic zoom may reduce pixel detail but never scene membership or replay entrance animation. Intentional Set unfurl and Artifact focus are semantic transitions only: the transition layer may temporarily own travelling pixels, then the settled scene node resumes ownership. Studio/Design is a precision tool depth over the same focused Artifact and physical geometry, not a second authoring universe.

Opening a work container changes focus rather than changing the mental model:

> Desk → focused work → contained objects

Contained objects may include Templates/masters, backs, generated Artifacts, assets/fonts where dependencies are known, generation batches, rules/reference surfaces, packaging, or later Specialty Artifacts. Pulling back restores the prior Desk arrangement and selection. Set-owned tag catalogs, card tag references, grouping/sort choices, freeform card positions, and intentional Template references travel in the project document; field facets are derived from actual Template/card data rather than copied into a second taxonomy.

Artifact focus is a closer camera depth inside the same creative scene, not a detached inspector or replacement application. The chosen Artifact moves to the camera-fitted foreground while its Set field remains visibly present at reduced emphasis. The contextual rail carries identity and primary actions; detailed Artifact camera controls stay with the Artifact. Back/Escape restores the exact Set camera and selection before the next unwind returns to Desk.

### Studio: the focused authoring and production workbench

Studio does not open another Set browser. It receives the active Set plus the selected Artifact, Template, record, revision, or requested tool from Desk, Library, a public creation entry, or agent handoff.

The focus path is:

> selected work → Artifact/Template/record → element-level editing or production tool

Selecting Edit, Generate, Test, Validate, or advanced Output opens the smallest useful Studio tool. Returning restores exact prior Desk or Library context.

Templates and their generated cards must be distinguishable inside a Set: show the actual referenced Templates separately, including intentionally prepared Templates with no generated cards yet; pair their solid borders with matching dashed card borders; and retain names/type labels so color is never the only cue.

Editing an individual Artifact preserves its visual identity while card tools appear around it. The Set spread remains recognizable behind the focused Artifact; tool controls must not replace it with another preview. **Edit** is an explicit mode that changes Artifact content only: the rendered field regions are direct targets, the same field grammar remains available as an accessible complete list, and live draft pixels stay on the focused Artifact until Save & Done or Cancel resolves them. Swipe/pan navigation is inactive while field editing owns the gesture. **Design** changes reusable Template structure; selecting a Template-owned region explains that boundary and offers the exact current face Template. A compatible multi-selection uses the same conceptual editor with mixed values and sparse patches: untouched fields remain unchanged. Artifact-scoped Design begins from the referenced face Template without cloning or rebinding anything merely because the tool opened. If the creator saves design divergence for the selected Artifact scope, Save creates an independent personal Template lineage and rebinds exactly that scope atomically; cancel or no saved divergence creates no extra Template. Shared Template Save updates the reusable design lineage and makes consequences explicit when field requirements/removals affect linked Artifacts. Keep existing field contracts and layer locks rather than adding an override hierarchy. Shared Template Design can use the full viewport for element-level precision, with its distinct editing target explicit. The selected canvas is centered and fully visible at Fit across desktop and mobile; only deliberate zoom introduces scrolling, and that scrolling remains inside the canvas rather than the surrounding document. Tool-local controls replace page navigation, and one close path returns to the originating object.

The recorded focused Studio model calls for the following, where supported:

- multiple Templates/masters and Artifact types;
- precise Template/master and element editing;
- structured record/card editing, including direct compatible-selection editing;
- bulk generation and CSV mapping into the active Set;
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

Desk's primary content is user-owned Sets/Projects and active work. The Set overview is the broadest personal-work context; spatial investigation moves inward through a Set, its Templates and Artifacts, then fields, values and focused tools. Desk makes the destination and action scope clear through that depth, rather than defining a different capability set from [Library](#library-personal-pipeline-published). It is not an account metrics dashboard.

Desk may surface browser-local work, Google Drive projects, attached local-folder projects, portable packages the user opens/indexes, and temporary AI work. Location is metadata on the work, not Desk's organizing principle.

Signing in carries browser-authored guest work into the next account workspace when that account has no saved browser workspace, preserving the work's Desk identity and placement. An existing account remains authoritative for its own work: any retained guest work stays recoverable and may be added as independent account copies, never replacing or silently merging into existing account work. Desk does not add a separate recent-work or resume layer for this transition.

Desk restores each source independently. A transient same-account failure keeps already loaded items with an honest unavailable state; an account switch, revoked capability, or expired protected session clears that protected source. Folder-only remembered work remains visible as a reconnectable work location. Drive/AI listing follows provider cursors, and discovery never imports provider work merely because a person logged in.

**My work** is the quiet default. Authorized people may opt into and combine **Campaigns** and **My published**, or save a custom view; a newly granted permission never changes the default selection. Views, types, tags, and sources are genuine multi-select filters, tags may use any/all matching, and Reset returns to My work rather than broad protected content. Compact Desk layouts hold the full filter set behind one explicit disclosure while keeping the active restriction readable. Filtering must not rewrite spatial positions, pins, saved order, or the identity of already selected Artifacts.

Set metadata separates its supported workflow from descriptive type and reusable personal tags. Built-in types describe shipped card-set work; creators may use custom types such as `Postcards`. Labels never grant a capability. Authored Set metadata travels in the project package; organization applied to an immutable publication/shared resource is private to the account and cannot mutate its public revision. Set tags do not silently tag contained cards.

New work has one creation boundary: start with a fresh Set or instantiate an independent browser-owned copy of a Published Set. Published starters are immutable reviewed `.cardforge` package revisions, not a second starter document format or a special Set subtype. The same portable package contract owns import, export, provider transfer, Pipeline publication, and starter installation; installation re-keys local object identity so editing a starter never mutates its published lineage.

A Contributor sees contribution/Pipeline state on their own objects when relevant. Other contributors' Pipeline objects do not appear on Desk simply because they are reviewable.

Desk quick actions use the same scope contract as Studio:

| Selection | Typical actions |
| --- | --- |
| No object | New Set/Project, import/open, search Library. |
| One Set/Project | Open, Edit/Test, Generate, Export, Save/Move, Duplicate, Delete, contribution actions when eligible. |
| Multiple work objects | Batch move/tag/archive/export where the domain supports it. |
| One contained Artifact | Edit, Design, Generate, Export, Duplicate, Pipeline/revision actions where valid. |
| Multiple contained Artifacts | Edit selected when the exact Template contract is compatible; Move, Duplicate, Tag, Output, or Remove where supported. Mixed Template scopes never silently retarget or infer semantic field equivalence. |

Desired recovery: ordinary **Remove from Set** is immediately undoable, without a separate individual-card Trash system, as accepted in [Studio and Sets](https://pyralisholdings.atlassian.net/wiki/spaces/PYPH/pages/622613). This does not change device-copy deletion, provider Trash or shared-catalog retirement; the [Desk source map](revision-guide.md#desk-current-state-surface-map) records the current implementation gap.

An empty account begins with an empty Desk. CardForge must not manufacture an `Untitled Set`, assign a starting Template, or present internal bootstrap state as user-authored work. A Set is a neutral spatial container that may intentionally reference reusable Templates before generation; each card Artifact owns its own front/back Template references and content data.

## Library: Personal, Pipeline, Published

Library is the structured, tab-based or folder-like route into the same object world as Desk: Sets, Templates, Artifacts, field values, artwork, fonts and other supported resources. It is not only a resource shelf or a reduced editor. Both routes expose the same valid object actions and editing authority; navigation and context framing differ, not object ownership or persistence.

A person can open a Set, navigate its Templates and Artifacts, and edit field values from Library without first going to Desk. Either route opens the same Studio workbench when precision Design is needed and preserves its originating context on return. A Template defines fields or slots; an Artifact holds field values; artwork and fonts are reusable resources assignable to compatible fields or design properties. Text can remain a field value without becoming a separate Library or Pipeline resource.

Primary tabs remain working layers with search and filters inside them. Object type describes what a thing is; provenance describes its personal, shared or provider-governed origin. Location, compatibility, status and tags are separate facets, not interchangeable ownership trees. Personal, Pipeline and Published remain the relevant collection scopes/projections rather than a forced redesign around either object type or source. Reusable resources do not become physically owned by every Set that references them merely because Library presents a structured path.

Library can inspect or edit an owned resource before it occupies a field. For **Apply**, resolve missing working context: the relevant Set, Artifact or Template, then the compatible field, role or design property as needed. Show the destination and consequences before commitment; applying artwork to one Artifact is different from changing a Template used by several Artifacts. Use the native action and offer the resulting context without requiring a manual spatial retrace. Unavailable, incompatible or unauthorized destinations must not cause a partial application or lose authored work. Applying is not saving, submitting or publishing.

Recommended scopes:

### Personal

User-owned Sets, Artifacts, reusable resources and provider-backed objects, including Templates, assets, fonts, styles, working drafts, and project resources where appropriate. An owner can add, rename or remove their resource's tags and supported organization metadata.

### Pipeline

Every user sees stable published CardForge shared resources available to their entitlement/compatibility. Signed-in users can heart any visible Pipeline lineage; the heart follows later revisions and never changes review thresholds or publication state.

Published Sets are reusable starting work, beginning with complete outcomes such as a standard playing-card deck. Their catalog entry points to one immutable portable package revision. Creators receive an independent Set copy; publication remains owned by Pipeline and durable creator storage remains browser, package, folder, or connected-provider owned.

Using shared Pipeline work retains attribution, lineage and the exact acquired revision as provenance, not a live dependency on its publisher. Editing creates an independent private derivative with its own identity or, when authorized, a new revision candidate against the shared lineage; it never overwrites a published revision in place. Existing Sets retain their acquired state until the creator explicitly reviews and accepts an available Update. Source retirement must not silently change or break acquired work. These behavior rules constrain file/version handling without selecting a version engine, schema or unlimited history policy; see [Product and Direction](https://pyralisholdings.atlassian.net/wiki/spaces/PYPH/pages/917505) and [Studio and Sets](https://pyralisholdings.atlassian.net/wiki/spaces/PYPH/pages/622613).

Canonical Pipeline tags and classification belong to the governed shared revision. Only authorized author/governance and revision/publication paths may change them; access or use does not grant shared metadata editing authority. Canonical content or classification changes are revision-governed, not in-place edits of published content.

Every user can organize resources they can access through private tags, saved filters and views/collections without rewriting the shared classification or another account's organization. Personal overlays do not create shared revisions. Filters must distinguish personal organization from canonical classification; detailed filter controls and matching behavior still need resolution and current Preview verification, not an assumption of implemented parity.

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

Current Template editing, bulk generation, card editing, Set management, canonical rendering, validation, sharing, PNG/ZIP/PDF/Tabletop Simulator output, watermarks, project files, connected saves, and AI handoff remain native capabilities.

The direction is to recompose them around the selected object:

- Template editing is a focused tool on a selected Template/master.
- Generate is a scope-aware tool on a Template, record, group, Set, or appropriate Artifact. Artifact-origin generation resolves that Artifact's front/back Template relationship; a Set with multiple eligible referenced Templates requires an explicit design choice rather than falling back to an arbitrary first card.
- Bulk generation reuses current CSV/import/mapping/validation strength and returns generated objects visibly to the Desk.
- Direct multi-Artifact Edit reuses the normal field grammar for exact compatible Template contracts; structured Update from data remains a distinct reconciliation workflow.
- Export is a scope-aware output tool, not another destination.
- Set switching stays compact and preserves context.
- Library/source selection opens around the current work.
- Save targets the current commitment boundary and names the consequence.

### Save semantics

Desired contract: **manual Save by default; automatic mechanics after the chosen Save**. The initial autosave default is off. Offer optional autosave with meaningful supported frequency/trigger controls through saving preferences and the appropriate Owner defaults/policy surface, not a fixed hidden timer. Resolve effective settings within the advertised scope without overwriting explicit user choices or silently enabling external writes for existing work. Manual and enabled automatic saves use the same feature-owned safe commit path; neither requires a manual version bump or named checkpoint. Any required compatible conversion, revision bookkeeping and recovery support belongs inside that path, not an extra user chore. Do not imply every-keystroke history or unlimited cloud retention.

These commitments must remain unmistakably different:

- **Draft/recovery persistence:** if used, preserve unsaved working state separately from the last confirmed Set save. Browser recovery is not a saved provider file, backup, publication or acceptance of source Updates; do not label the whole Set saved merely because a cache write succeeded.
- **Editor Save:** commit the advertised authored draft scope; consequential Template-contract changes surface impact before commit. Artifact-scoped saved design divergence creates a new personal Template lineage only at this boundary. If this commits only a working draft, name that consequence rather than claiming the destination file was saved.
- **Save · This device / Local folder / Google Drive / future provider:** commit the scoped Set and its required Templates/assets to the named destination without separate dependency-saving or revision-management chores. Do not include unrelated Sets or unaccepted drafts. Advance saved state only after the native boundary confirms it; failed/uncertain outcomes retain recoverable edits and remain visibly unsaved/unconfirmed.
- **Save As / Copy / Move:** choose or create another durable destination; Move removes a source only after verified destination persistence.
- **Send to Pipeline:** create a reviewable new shared candidate.
- **Submit Revision:** create a reviewable revision of an existing shared lineage.
- **Publish Live:** Owner/policy publication boundary that changes the stable shared Library.

Pipeline submission is never labeled Save. Provider persistence is never labeled Publish. A newer same-lineage Template may be offered to an older saved Set as an explicit update; it is never silently substituted for the snapshot the Set saved.

## Contributor Capability Layer

Contributor access enhances Desk, Library, focused Studio tools, and Profile. It does not create a parallel Contributor Studio or permanent Contributor zone.

A standard active Contributor may receive capabilities equivalent to:

- submit eligible shared assets;
- review/vote on Pipeline assets;
- submit shared-library revisions;
- create temporary private Studio drafts with AI;
- campaign drafting only when separately granted/release-enabled.

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

Use **Contributor** for the creative/product role across public and private UI and runtime ownership. Contributor identity, access, Pipeline records, and storage use Contributor names directly. The former Developer/Profile routes and Contributor Cockpit are not compatibility surfaces; Desk, Library, Account Profile, focused Studio tools, and Owner own those capabilities.

## Pipeline, Revisions, Voting, and Publication

The existing Forge Pipeline remains the shared reviewed-content owner.

Studio should project each published resource where it is useful, not repeat every resource in every picker. Explicit Pipeline destinations override kind defaults. Counterpart suggestions must remain contextual: Template-derived treatments match the current face and physical format, a front may reveal compatible published backs, and foundation or border artwork with declared orientation compatibility should not be offered to an opposing canvas orientation. Unclassified artwork remains broadly available rather than disappearing through inference. Published Library details should name contextual Studio placement instead of advertising a generic action that cannot be completed. Future family or specialty relationships should refine this same projection without creating duplicate assets or a second Studio catalog.

The initial Template surface is a representative quick view, not the full catalog rendered at once. It prefers distinct creation domains, keeps the complete catalog in the selector, and lets the creator deliberately expand Templates or card backs in place. Catalog growth targets each supported use case with roughly three to five Starter Templates and two to five Creator Pass Templates, subject to quality review rather than filler quotas.

SVG is a first-class but narrow design lane. Contributors may submit it for icons, dividers, and transparent border overlays only; CardForge sanitizes the source before publication, Studio gives icons and dividers original-color and tint controls, and border overlays preserve their authored color. Photographs, textures, and full-frame artwork remain raster lanes. Pipeline catalog capacity is owner-operated, modeled against a 500 MB asset allocation (half of the current Supabase Free Storage quota), and the owner UI distinguishes tracked Pipeline bytes from provider-authoritative organization usage.

Supported lifecycle concepts include draft, submitted, voting, publish candidate, published, archived, and rejected, with automatic ranking/capacity policy plus explicit Owner overrides.

### Voting

Votes attach to the exact submission/revision, not to an eternal asset name. A new substantive revision earns its own signal. Previous revision votes remain historical evidence. Each Contributor has one positive preference per lineage and may move it atomically to another revision; that same Contributor may record one negative objection on any visible non-Trash revision. Contributors and the Owner may vote on their own submitted work. One person always contributes one unit of signal, and Owner authority is an explicit audited override rather than a weighted community vote. Voting begins after draft submission. Hearts remain a separate reaction to the lineage.

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

The registry's exact `contributor_submission_id` is the live pointer. A newer row whose status still says published is history unless the registry points to it. The compact roles are Reviewing, Live, History, Trash, and Purged; Archive is a filtered presentation across History and recoverable Trash rather than a permanent lifecycle state.

The revision inspector may expose state, votes, current-user vote, author, dates, comparison, source, and Use this revision.

### Exact revision pinning

Using an unpublished candidate inside Studio must pin the exact revision/snapshot needed to prevent silent mutation. A later candidate never silently replaces it.

Possible actions include Update to newer candidate, Compare, Keep current revision, and Return to published.

Durable work must remain recoverable if a candidate later archives or becomes unavailable. Materialize/snapshot dependencies when necessary.

### Generalized revision lineage

Template revisions already have the strongest model: stable shared asset ID, base revision, next revision, immutable submission identity, complete structured payload, conflict detection, and current-published pointer. Personal Templates additionally distinguish reusable lineage, exact revision identity, and fork provenance so a derived personal design is not confused with ownership of its source.

Extend equivalent lineage concepts to revisionable media/fonts/component recipes and later Kits/Specialty material instead of treating every update as an unrelated upload.

### Removal semantics

The Owner may move any Contributor’s exact revision to recoverable Trash; Contributors may Trash only their own exact work. Only the Owner may request early permanent deletion, after Trash and the applicable native ownership, hold, reference and worker checks. Contributors cannot quick-delete content. Normal retention otherwise applies.

Revision recovery uses one exact-revision Trash clock, normally 30 days, whether entry came from voting, the Contributor or the Owner. Shared Trash remains browseable and votable under existing account eligibility; private drafts and unknown legacy sharing provenance do not become public. Trash is absent from Studio discovery and new insertion while retained references and bytes remain intact. Positive voting may recover vote-origin Trash through the existing grading policy, but never reverses manual Contributor or Owner Trash. The original Contributor may restore self- or vote-origin Trash, never Owner moderation. Restore returns ordinary review/publication eligibility without rewriting source or replacing a newer current revision; a restored private draft stays private until ordinary submission. Unchanged decision evidence cannot immediately re-trash a restored revision or reset its clock. Holds, dependency protections and committed or uncertain destructive attempts remain authoritative. Legacy unknown visibility remains unavailable rather than inventing sharing or moderation history. Removing an exact current publication still requires proven retained runtime compatibility and native consumer admission.

Manual recoverable removal of eligible catalog media previews known exact consumers and requires fresh impact confirmation when references exist. Affected current Pipeline objects receive technical dependency-unavailable findings in Content Health, independently of human editorial revise decisions; normal Open and exact-lineage revision workflows own repair. Incomplete unrelated dependency interpretation is a coverage warning, not proof of a target reference. Private consumer identities remain hidden from unauthorized Contributors, who receive redacted counts. Restore and corrected current revisions reevaluate health rather than blindly clearing it. Physical erasure, committed claims, holds and installed-runtime type restrictions remain separate boundaries.

Never-published work that is declined, withdrawn, expired, or superseded enters recoverable Trash. The Owner controls the minimum review age, inactivity window, Trash recovery window, and retention holds. When native retention eligibility is established, the worker removes Storage bytes before finalizing the database row. An uncertain Storage or finalization outcome retains its durable claim for reconciliation; time alone never reissues authority. Previously published revisions retain publication evidence and are never treated as disposable failed content. Their displayed recovery deadline does not authorize physical expiry. The currently live registry pointer is never automatically purged or displaced by later dislikes.

## Library, Storage, and Source Ownership

CardForge is local-first and provider-friendly. It does not operate durable first-party creator backup storage.

Working and durable creator locations include:

- browser workspace as fast local working/recovery copy;
- portable `.cardforge` Project/Set packages;
- browser-authorized local folders;
- Google Drive projects;
- future providers chosen deliberately.

Free is a durable creator studio, not a storage trial: a signed-in Free creator may use portable Set packages, browser-authorized local folders, and their personally connected Google Drive location. Paid plans may improve finished output and CardForge-operated services, but must never block the creator from keeping, reopening, copying, or moving their own work. Google Drive remains a narrow provider location rather than a CardForge realtime-collaboration service: one CardForge account connects one Google identity at a time, and Google remains authoritative for folder membership, sharing, permissions, storage, and revisions.

Source distinction: this revision's linked Drive working session coalesces edits into its provider document after a fixed idle delay; that differs from the desired manual-default, configurable saving contract above. The [revision guide](revision-guide.md#planning-differences-that-affect-the-foundation-milestone) records the inspected owner and settings gap. Its existing freshness checks apply newer saved provider revisions only when browser work is clean, preserve dirty conflicts, and do not grant read-only collaborators write access. This is shared-file freshness, not consent to incoming creative Updates, live presence, or a universal sync engine.

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
- Template handoff into Forge Review;
- explicit Template authority for new-card generation in multi-Template Sets, while existing-card data revisions preserve their current front/back Template relationships.

Browser-only/local-folder work is not remotely agent-readable while the device/browser is unavailable. The user must hand it into temporary AI workspace or a server-reachable provider.

General media/font Pipeline contribution can become more agent-native later, but it must use the same human Pipeline lineage, rights/classification, and publication rules.

## Profile and Personal Continuity

Profile centers the person, not an account record.

Clerk remains the native identity/security owner. Stripe remains the native checkout/billing owner. Provider connection lifecycle remains with the provider integration, with Profile showing a compact summary and Library owning detailed location management.

The Profile overview leads with current identity, access, workspace, authority, assisted-work allowance, and Contributor progress where applicable. Deeper utilities explain or manage those values without forcing users to navigate just to discover their current state.

Profile may hold durable personal defaults only when ownership is truly personal: presentation, default Specialty/Kit, accessibility choices, output preference, and Contributor configuration. Work-specific settings stay with the selected work container.

## Owner Operations

Owner operations reveal as protected tools at their native recurring object. Profile composes Overview, Growth & People, and Governance. Campaigns live in Library → Campaigns, Pipeline authority lives in Library → Pipeline, the public property provides an Owner-only **Edit page** mode directly on every public page, and Roadmap rules/status controls reveal on `/roadmap`, using the same canonical stores and mutations; anonymous visitors receive neither Owner client code nor unpublished control payloads.

Owner responsibilities include:

- action/readiness queues;
- people and Contributor scopes;
- shared Library → Pipeline review/publication/routing;
- owner overrides and permanent purge;
- contextual public-page editing and small site-wide settings controls;
- Library → Campaigns strategy/approval/distribution;
- contextual Roadmap rules/status controls;
- legal/governance/history;
- service/provider readiness;
- billing/usage/analytics reconciliation.

Owner may reuse the same object renderers, Library projections, and review surfaces, but authority remains explicit and auditable. On public pages, **the rendered page is the first editing surface**: the Owner enables Edit page, selects a real copy or media target, edits in place or uses a focused image drawer, and explicitly publishes that one owned value. If a field includes structured markup, preserve it and use a focused copy form instead of mutating its markup. Visible Owner copy and media have one primary selection path; a focused field editor exists only when real page markup cannot be edited safely. Visible primary-action, navigation and enabled-announcement labels are also selectable, but retain their native Owner site-configuration owner. A compact Site settings drawer hosts destinations, order/visibility, SEO, favicon, watermark and other non-selectable controls plus a derived list of Owner-owned copy/media not reachable in the currently rendered page. The drawer is not a second full-page copy or media catalog. Visible CTA and navigation labels are edited by selecting them on the page; settings keeps link destinations, visibility and order, plus fallback label controls for hidden or structurally suppressed navigation items. Design, page/component structure, route capability and permissions remain code-controlled; actual commercial prices and provider configuration remain provider-owned. Site configuration publishes through its existing canonical Owner command, not a parallel page-builder state. Whole-configuration settings edits and focused labels must compare the existing settings updatedAt revision before committing; selected labels update only the relevant column/JSON navigation label, leaving link destinations and unrelated settings intact. Always distinguish staging-only Preview publication from live production publication; Cancel and stale-version conflicts never overwrite already-published content.

## Campaign Contribution

Campaign package capability remains valid while Contributor stops being a separate zone. Contributor site-proposal capability is retired; historical proposal data and schema columns remain retained only for audit, are not projected into current profiles, and cannot be granted by Owner controls.

First integration rule:

- Campaign packages are Set-like specialized work in the interaction model, while `marketing-content` remains their record and lifecycle owner.
- Desk projects authorized campaign packages as individual campaign work objects in the same spatial scene, never as fake card Sets or a separate shelf. `marketing-content` retains the package record, variants, media, and campaign publication lifecycle.
- Library adds a Campaigns scope only for Owners and Contributors granted `campaigns.draft`; normal accounts do not receive campaign packages or reusable campaign media through Pipeline entitlement.
- Contributors draft, revise, attach approved media, and submit campaign packages in Library. Owner retains strategy, approval, destination credentials, scheduling, publication, and delivery history.
- Profile owns personal Contributor access, limits, and scopes. Owner operations compose inside Profile.
- Campaign tools reveal within their owning surface and return to the originating context; they do not create a replacement Contributor destination.

Do not create permanent geography merely because a permission exists. A future campaign/production environment earns a separate zone only if it develops a durable recurring object/queue users intentionally revisit outside normal editing.

<a id="next-delivery-sequence"></a>
## Future expansion

Specialty/Kit launchers, broader Artifact families, and fulfillment belong to the [Confluence blueprint](https://pyralisholdings.atlassian.net/wiki/spaces/PYPH/pages/590018), not a second delivery sequence here. Historical explorations remain in Git history. Configuration must select finite code-supported capabilities; it must not introduce arbitrary executable code, unvalidated CSS, database expressions, or unrestricted UI definitions.

## Ownership and Persistence

Preserve ownership separation:

| Owner | Responsibilities |
| --- | --- |
| Code | Allowed capabilities, renderer behavior, element/field types, validation, compatibility, access control, output engines, provider interfaces. |
| Supabase | Pipeline/review state, shared registry, owner decisions, public/platform control records; proposed published Specialty/Kit metadata is future direction, not an implemented inventory. |
| Browser/work owner | Working records/layouts/local assets/preferences/recovery, Set → Template references, and portable work-package contracts. |
| Connected provider/local folder | Durable user-owned project files, permissions, provider revisions, provider deletion. |
| Temporary AI workspace | Bounded private revisioned collaboration only; not durable creator backup. |
| External production provider | Dielines/product specs, availability, prices, orders, shipping, delivery. |

`cardforge_asset_registry` remains the canonical shared Studio catalog for Templates, styles, media, fonts, and similar reusable assets. Specialties/Kits orchestrate those assets; they are not forced into the asset registry.

### Published-resource expectations

These are intended resource/persistence constraints, including future Specialty/Kit configuration. They do not select the Set versioning/comparison engine or establish that creator Updates, named paths, or a portable Set history ledger are implemented; resolve those questions in [Studio and Sets](https://pyralisholdings.atlassian.net/wiki/spaces/PYPH/pages/622613).

- Published Specialty/Kit revisions are immutable snapshots.
- Reusable Templates have lineage plus exact revision identity; a fork creates a new lineage with provenance rather than transferring source ownership.
- New work containers receive current published configuration.
- Existing work containers store/pin sufficient configuration and exact referenced Template snapshots to remain usable.
- Publishing new configuration does not silently mutate existing work.
- Updating existing work is explicit and previewable.
- Published shared asset/revision updates do not silently mutate exact work dependencies.
- Supabase/provider outages never destroy creator-owned local work.

## Visual Direction

The visual system should reinforce object meaning rather than decorate every container.

Use:

- real work stacks and Artifact thumbnails;
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

The prior alpha concept images remain historical hierarchy references; this revision records the following visual hierarchy:

- Desk: spatial authored-work organization over the current Set/project object;
- Library: Personal / Published / Pipeline collection with object inspectors;
- Studio: focused Design/Generate/Validate/Output workbench over the selected object;
- Profile: person-centered configuration;
- Owner: protected operations composed inside Profile.

The old Developer-zone concept is superseded by Contributor enhancements across the three navigation surfaces and focused Studio tools.

## Product Constraints

Do not:

- create another permanent Contributor zone;
- create a second Studio/editor for Contributors;
- create a second renderer, asset registry, vote model, persistence owner, or Pipeline;
- expose unpublished Pipeline content to normal creators;
- make Contributors implicit live publishers;
- conflate Save with Pipeline submission or Publish;
- silently update pinned revisions;
- silently treat generated Artifact content as generation authority when the Template source is known or must be chosen;
- rebuild provider-native storage/auth/billing lifecycles;
- turn Desk into a generic content-agnostic infinite-canvas toy or Studio into another collection browser;
- retire a shipped capability before its new home proves parity;
- use radial/gesture-only interaction as a prerequisite for basic workflows.

Individual card changes belong in direct Template/card editing; the dedicated single-card generation form is retired, while bulk input remains the creation path. Individual image downloads, sharing, editable-card packages, print preparation, and provider-specific output profiles are distinct output concerns, not interchangeable evidence of acceptance.

<a id="remaining-product-questions"></a>
## Open product questions

Use [Confluence Delivery and Verification](https://pyralisholdings.atlassian.net/wiki/spaces/PYPH/pages/983041) and its linked topic decisions. Resolve only the selected work's material semantics before implementation; later Marketplace, physical-commerce, and reusable site-core questions do not all block foundation work. Do not maintain another open-question list here.