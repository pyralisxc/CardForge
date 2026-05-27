# Site Tooling Walkthrough Audit

Date: 2026-05-25

## Scope

This pass walked the local site at `http://localhost:9002` across the public landing page, Studio, account, developer, roadmap, owner gate, profile gate, and legal/support pages. The audit focused on user-facing wording, whether controls explain what they affect, whether obvious buttons respond, and whether the Studio tool model feels useful instead of stitched together.

The first pass used an unauthenticated local browser state. A follow-up authenticated smoke pass now uses reusable free, paid, developer, and owner QA accounts from `.env.local` to verify role-specific account, developer, Studio, and owner surfaces without creating disposable Clerk users.

## Quick Fixes Applied

- Added missing accessible names to Studio toolbar controls, alignment controls, text alignment/direction controls, typography dropdowns, template selector, and toast close controls.
- Renamed the element rail helper copy from `Primitives only; styles live in inspector` to `Add building blocks; tune the selected element in the inspector`.
- Changed the primitive divider element from `Line / Divider` to `Divider / Rule` so it reads like a useful card-making element instead of an implementation category.
- Renamed `Export` and `Import` in the template panel to `Export Project` and `Import Project`.
- Replaced public developer wording around `frame parts` with clearer pipeline language: templates, overlays, icons, dividers, textures, and element recipes.

## Implementation Checkpoint: Inspector Tooling Pass

Date: 2026-05-25

The next tooling pass moved the audit from notes into the Studio UI:

- Inspector lanes now include short effect descriptions so users know whether they are changing source/content, recipe/style, material, edge, or layout.
- `Layout & Layer` is now `Align To Canvas & Layer` because those alignment buttons align the selected element to the card canvas, not to other elements.
- Pipeline recipe buttons now show compact, consistent provenance chips: status, contributor, and tier.
- Recipe tooltips now use readable labels such as `Published` and `Starter Library` instead of raw `published - free` strings.
- Source taxonomy now labels `part` assets as `Overlay Asset` / `Overlay Assets` in app-facing badge summaries.

Verification after this pass:

- Studio DOM check confirmed the new lane descriptions render for selected text and shape elements.
- Shape recipe interaction confirmed `Published`, contributor, and `Starter Library` chips render on reviewed recipes.
- Broad route audit still reports 0 unlabeled controls on every walked route.
- A standalone `/roadmap` console check showed only the expected Clerk development-key warning. The broad audit runner once captured a transient roadmap hydration warning while rapidly navigating routes; keep an eye on this, but it was not reproducible on direct load.

## Walkthrough Results

| Route | Result | Notes |
| --- | --- | --- |
| `/` | Pass | Landing page has clear H1, no overflow, no unlabeled controls. |
| `/studio` | Pass with product backlog | 185 visible controls, no unlabeled controls after fixes, no horizontal overflow or stuck loaders. Tool lanes and recipe provenance are clearer after the inspector tooling pass. |
| `/account` | Pass | `Open Studio` navigates correctly. Copy is clear for the signed-out/local account surface. |
| `/developer` | Pass for recruitment view | Visitor copy is clearer after wording updates. Logged-in developer hub still needs reusable-account testing. |
| `/roadmap` | Pass | Route loads and voting/sort controls are labeled. A future pass should assert visible selected-sort state, not just clickability. |
| `/owner` | Expected auth gate | Unauthenticated page returns a protected state with a 403 request. Needs signed-in owner testing. |
| `/profile` | Pass for signed-out gate | Sign-in profile page loads with no stuck state. |
| `/privacy`, `/terms`, `/refund`, `/contact`, `/developer-terms`, `/creator-pool` | Pass | Owner-editable trust pages load with clear H1s, business contact context, and no unlabeled controls. |
| `/about`, `/access` | Pass | Base public pages explain the product purpose, staged demo access, and future creator-pool caveat. |

Automated screenshot and summary output: `C:\Users\camer\AppData\Local\Temp\cardforge-site-audit`.

## Main Product Findings

### 1. Studio Tools Are Useful, But Need A Stronger Mental Model

The Studio is moving in the right direction: elements are now building blocks, selected elements expose real inspector controls, and image/icon/divider assets are increasingly pipeline-backed. The remaining weakness is that users still have to infer the difference between a source asset, a recipe, a material, a border treatment, and a layout control.

Target model:

| User question | UI lane |
| --- | --- |
| What am I adding? | Elements |
| What content/source does it use? | Source & Content |
| What reviewed style or recipe should it use? | Reviewed Recipes |
| What exact surface/material values do I want? | Material & Effects |
| What edge/frame/stroke should contain it? | Frame & Edge |
| Where does it sit on the card? | Layout & Layer |

### 2. Pipeline Language Needs One Vocabulary

Terms to keep:

- `Elements`: local building blocks placed on the card.
- `Source Assets`: uploaded or shipped files used by an element, such as images, overlays, icons, textures, and dividers.
- `Element Recipes`: reviewed style/behavior packages that change an element in a purposeful way.
- `Templates`: full card layouts.
- `Personal Library`: user-local uploads and exported projects.
- `Developer Pipeline`: submitted assets/recipes/templates that can be reviewed, voted on, published, archived, and recovered.

Terms to retire or hide from user-facing UI:

- `Card Parts`
- `frame parts`
- `Asset Catalog` as a left-rail tool
- broad `presets` when the thing is really a reviewed recipe or source asset

### 3. Provenance Badges Needed Consistent Treatment

The old repeated badge pattern could read like `owner contributor - published - official` on many recipe tiles. The data is useful, but the UI should compress it into three consistent chips:

- Status: candidate, published, archived, rejected.
- Contributor: display name or email fallback.
- Tier: starter, creator pass, review, hidden.

The first chip treatment is now in place for reviewed recipe buttons. The next improvement is to apply the same component to source asset pickers and developer queue cards so all pipeline surfaces speak the same visual language.

### 4. Owner And Developer Deep Testing Is Now Covered By Reusable QA Accounts

The app now safely skips reusable-account smoke tests when QA account env vars are absent. Locally, `.env.local` has reusable QA account values for free, paid, developer, and owner personas, and disposable Clerk users remain disabled by default.

Covered signed-in walkthroughs:

- Developer can upload from personal files or drag/drop.
- Developer can see their submitted assets in their own hub.
- Free account can claim Founder Beta when eligible, receives clean export entitlement, and can vote on roadmap items.
- Paid account resolves as Creator Pass with clean export active in the account and Studio surfaces.
- Developer account sees the private Developer Asset Hub while non-developer accounts see recruitment copy.
- Owner can publish and tier an asset without breaking the live `/api/assets` registry.
- Developer and owner accounts now verify contributor self-voting rules, weighted owner votes, and archive/recovery status changes through authenticated smoke.
- Owner Developer Program queue actions now show an explicit `Recover to Review` action for archived submissions, and smoke clicks the visible archive/recover controls in `/owner`.
- The account page `Manage Account` CTA and Clerk-powered profile panel have been visually checked; the embedded profile manager now uses readable CardForge dark-theme text colors.

Remaining signed-in depth to add:

- Owner UI edits for submission requirements, monthly submission caps, and asset caps.

## Bigger Refactor Backlog

### Tool Applicability Contract

Every inspector panel should declare which element types and roles it applies to, what visible surface it changes, and which controls are hidden when the element cannot respond. This should become testable metadata, not scattered component conditionals.

### Recipe And Asset Registry Unification

Everything offered as a creative default should resolve through one app-facing library contract. Local primitives are allowed, but the maker should consume the same normalized shape for starter library content, developer submissions, published recipes, archived recipes, and personal uploads.

### Guided Studio Mode

Add a first-run or default lightweight Studio path:

1. Choose a template.
2. Add/select an element.
3. Set source/content.
4. Apply a reviewed recipe or tune details.
5. Generate/export.

The full inspector can remain available, but new users need a primary path through the tool.

### Signed-In QA Suite

Add a reusable-account Playwright suite for:

- Demo seat claim.
- Account profile update, including first/last name display fallback.
- Developer upload and edit.
- Developer queue filtering, pagination, preview expand, and voting.
- Owner pipeline management.
- Template export/import and generator output.

## Current Grade

Overall development grade after this pass: **B**.

The site is no longer just a pile of working controls. It has a real tool spine now. The gap is professional product clarity: fewer overlapping labels, stronger pipeline-backed defaults, and signed-in end-to-end verification for developer/owner workflows.
