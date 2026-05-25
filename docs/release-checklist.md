# Release Checklist

Last updated: May 23, 2026

## Release Status

Current recommendation: `NO-GO FOR PUBLIC LAUNCH`, `GO FOR INTERNAL QA`

The application is in a strong internal QA state for core authoring, generation, and export workflows after the Phase 1-3 AAA stabilization work. Public launch should pause until production dependency audit findings and worktree/release hygiene are resolved or formally accepted.

## Go / No-Go Summary

### Go Criteria Met

- Template editor and generator workflows are functional.
- Single-card generation works.
- Bulk CSV generation works.
- PNG, ZIP, and PDF export flows are present.
- The repo has completed the cleanup and consolidation pass.
- Route-level bundle size was materially reduced.
- Local verification is green after the launch-readiness consolidation pass.

### Remaining Launch Decisions

Release can proceed only after the team resolves or formally accepts:
- `2` moderate production `npm audit --omit=dev` findings through `next -> postcss`
- the currently large dirty worktree, including untracked feature directories, asset scaffolds, docs, and tests
- the Stripe webhook or billing-owned entitlement store for production paid-account activation
- production `NEXT_PUBLIC_APP_URL` points at the deployed app/custom domain, not Supabase

Release should pause if:
- policy requires zero known audit findings
- a customer, marketplace, or deployment target blocks shipment with moderate framework advisories

## Current Verification State

These checks passed after the launch-readiness consolidation pass:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run smoke`
- `npm audit --omit=dev` does not pass
- entitlement hardening now ignores public Clerk metadata and accepts paid/dev unlocks only from Clerk private metadata, server allowlists, local fallback mode, or a future billing-owned source
- API bootstrap/account/billing failures now use no-store JSON error envelopes with correlation ids
- tracked local-only user template JSON and the empty `.modified` marker were removed from the release tree
- `/` now renders the public CardForge landing page, `/studio` renders the maker/generator workspace, `/account` renders profile/export/dev-tool status, and `/profile` renders Clerk-backed profile management
- canonical app URL resolution now rejects Supabase project hosts and falls back to Vercel deployment URLs for metadata, robots/sitemap, and Stripe return URLs

Current production build snapshot:

- `/` route size: `5.36 kB`
- `/studio` route size: `34.8 kB`
- `/account` route size: `11.4 kB`
- `/profile` route size: `6.53 kB`
- first-load JS: `111 kB` on `/`, `205 kB` on `/studio`, `177 kB` on `/account`, `166 kB` on `/profile`
- unit tests: `34` files, `205` tests passed
- smoke tests: `14` browser tests passed

Current production audit snapshot:

- high: `0`
- moderate: `2`
- total: `2`

Known audit chains:

- `next -> postcss`

Do not describe the release as audit-clean until `npm audit --omit=dev` exits successfully or this document records a named acceptance decision.

## Entry Architecture

The current release now has the intended public entry architecture:

- `/` is the CardForge landing page.
- `/studio` is the heavy maker/generator workspace.
- `/account` is the compact My Forge overview for entitlement, local asset status, and role links.
- `/roadmap` is the public Forge Chronicle and feature-voting surface.
- `/developer` is the developer application and Forge Review asset hub.
- `/owner` is the owner-only tabbed Library Command console.
- `/profile` is the signed-in profile-management surface powered by Clerk's user profile component.

The app remains soft-gated: visitors can open the studio without signing in, and the first hard account/paywall appears when clean export or development-only tooling is needed.

## Experience Standard

This verification pass is not limited to bug-finding. The bar is to strengthen the current product until it feels trustworthy, discoverable, and enjoyable for professional and hobbyist use alike.

Every surface should be judged against these standards:

- Usability feels effortless.
  - tools behave predictably, discoverably, and consistently
- Controls explain themselves.
  - tooltips, labels, and descriptions guide the user toward correct outcomes
- Workflows stay organized.
  - no buried actions, duplicated controls, or confusing state transitions
- The UI feels native and professional.
  - smooth interactions, stable layout, and no visual drift
- Tools are deep without becoming chaotic.
  - enough power, modulation, and fine control without overwhelming the user
- Feedback is immediate and confidence-building.
  - users can change parameters and understand the result right away
- Responsiveness stays clean.
  - no flicker, layout jumps, broken drag states, or inspector/canvas desync

When grading a surface, treat “works correctly” as the baseline, not the finish line.

## Sequential Verification Gradebook

This gradebook is meant to support a true strengthening pass of current functionality rather than feature expansion. It is organized in the same rough order a user encounters the product on screen and should be updated after each deeper QA cycle.

### 1. App Shell and Navigation

- User expectation:
  - app loads cleanly
  - current tab is obvious
  - switching between Maker and Generator is fast and stable
  - no visible blank states, overlays, or console noise
- Primary code:
  - `src/app/page.tsx`
  - `src/components/card-forge/Header.tsx`
  - `src/lib/constants.ts`
- Current grade: `9.2/10`
- Verified:
  - repeated tab switching stayed stable
  - no relevant console errors or framework overlays
  - page identity and visible structure matched expectations
- Remaining focus:
  - mobile sheet navigation pass
  - repeated open/close stress on the mobile menu

### 2. Template Library and Template Ownership Flow

- User expectation:
  - default and user templates are easy to understand
  - selecting a template is obvious
  - save, clone, and delete behavior feels safe
- Primary code:
  - `src/features/template-editor/components/TemplateLibraryPanel.tsx`
  - `src/components/card-forge/TemplateThumbnail.tsx`
  - `src/app/api/templates/route.ts`
  - `src/store/appStore.ts`
- Current grade: `8.9/10`
- Verified:
  - file-backed default templates load
  - template selection works in Maker and Generator
  - delete flow is protected by confirmation
- Findings:
  - the template action row in Maker still relies too heavily on unlabeled icon buttons, which weakens discoverability and makes the workflow feel less self-explanatory than it should
- Remaining focus:
  - stress test rapid template switching
  - verify clone/save/delete expectations against both default and user templates
  - confirm no stale selected-template state after deletes or clones

### 3. Template Canvas and Selection Model

- User expectation:
  - selecting, deselecting, and switching elements feels predictable
  - `Esc` deselect works
  - canvas remains stable under rushed clicks and keyboard use
  - overlapping elements can be reached intentionally without forcing the user into the layer tree for every deep selection
  - parent-child transforms behave like a professional editor, not a loose visual grouping hack
- Primary code:
  - `src/components/card-forge/CardTemplateMaker.tsx`
  - `src/lib/freeformElementRender.ts`
  - `src/features/template-editor/components/LayerTreePanel.tsx`
- Current grade: `9.3/10`
- Verified:
  - `Esc` deselection clears selected state and resize handle
  - rapid add/select/hide/lock flow stayed stable
  - keyboard movement and layer toggles were already smoke-tested
- Additional verification:
  - duplicate/delete actions worked on selected layers
  - multi-select enabled grouping
  - group/ungroup flow completed without console errors
  - live drag movement on a grouped parent moved both grouped children with it
  - live parent resize scaled and repositioned grouped children proportionally
  - repeated clicks on an overlapped grouped area cycled from the top child to the group and then to the deeper underlying layer
- Findings:
  - keyboard movement previously felt too focus-sensitive; the canvas now re-focuses on selection, but this should stay under active regression watch in future passes
  - grouped-parent visibility and re-selection in the layer tree improved with a clearer group badge, but the grouped parent still deserves continued discoverability review under denser real templates
- Remaining focus:
  - drag/resize abuse pass
  - multi-select/grouping edge cases
  - undo/redo abuse pass after mixed canvas operations

Required completion criteria for this area:

- Repeated clicks on overlapping canvas targets should let the user intentionally reach deeper layers under the pointer, or an equivalent equally discoverable depth-selection affordance must exist.
- Moving a parent/group must move its children with it in live behavior, not just by intended implementation.
- Resizing a parent/group must have clearly defined semantics and match user expectation:
  - if groups are transform groups, children should scale/reposition proportionally
  - if groups are organizational only, the UI must communicate that clearly and avoid implying transform inheritance
- Selecting a grouped parent versus a child must feel deliberate and easy to understand from both canvas and layer tree.

### 4. Inspector Tools and Appearance Editing

- User expectation:
  - inspector always reflects the current selection
  - deep controls change preview output predictably
  - textures, dividers, borders, and typography feel cohesive
- Primary code:
  - `src/features/template-editor/components/TemplateEditorInspectorPanel.tsx`
  - `src/features/template-editor/components/AppearanceStudioPanel.tsx`
  - `src/features/template-editor/components/TypographyInspectorPanel.tsx`
  - `src/features/template-editor/components/ImageInspectorPanel.tsx`
  - `src/features/template-editor/components/BorderInspectorPanel.tsx`
  - `src/features/template-editor/components/IconInspectorPanel.tsx`
  - `src/features/template-editor/components/ShapeInspectorPanel.tsx`
  - `src/features/template-editor/components/DividerStudioPanel.tsx`
- Current grade: `9/10`
- Verified:
  - inspector survives rapid selection changes
  - asset discovery is live and file-backed
  - no browser errors during appearance-panel use in the current pass
- Findings:
  - current quick-style controls appear to contain duplicate entries in at least one visible inspector state, which suggests a cleanup issue in style presentation rather than a user-facing capability gap
- Remaining focus:
  - sequential per-panel QA
  - verify style save/delete behavior visually
  - verify discovered textures/dividers behave correctly when applied and removed

### 5. Rich Text and Variable Authoring

- User expectation:
  - rich text edits feel native enough
  - inline variables are easy to create, change, and remove
  - previews update seamlessly everywhere
  - generator fields preserve authored structure without becoming confusing
- Primary code:
  - `src/components/card-forge/CardForgeRichTextEditor.tsx`
  - `src/lib/cardTextRender.tsx`
  - `src/lib/textTools.ts`
  - `src/lib/templateFields.ts`
  - `src/lib/textElementContracts.ts`
  - `src/components/card-forge/GeneratorFieldInput.tsx`
  - `src/components/card-forge/GeneratorFieldGroups.tsx`
- Current grade: `8.7/10`
- Verified:
  - shared rich-text surfaces are present
  - grouped field model is wired into generator flows
  - creating an inline variable from selected text in the Maker works and immediately creates the expected scoped field cards
  - removing a variable while keeping its text works and returns the element to a zero-variable state cleanly
  - recreating a removed variable works and restores the expected grouped field structure
  - renaming a variable updates the serialized rich-text token after commit/blur
  - generator surfaces preserve the authored grouped structure:
    - base/static text stays separate from the inline variable field
    - the live preview updates when the generator-side variable value changes
  - rich-text formatting commands are active in generator editors; keyboard bold formatting applied correctly in the browser pass
  - variable field cards now expose an always-visible `Remove Variable` action
  - variable rename now commits on `Enter`, not only on blur
  - nested variable creation is now guarded so selecting text that already belongs to a variable does not create another variable inside it
  - unit coverage now proves mixed variable formatting and list-style formatting survive through the shared card text renderer path used by preview/export
- Findings:
  - variable rename still feels commit-based rather than truly live while typing, which is acceptable but not the most luxurious editing feel yet
- Still not fully closed:
  - full browser parity for highlight/list/color formatting across Maker, Single, Bulk, generated card gallery, and export interactions
  - rushed-editing and mixed-format edge cases in longer rules-style content
- Remaining focus:
  - full browser parity pass for formatted export output
  - longer multiline rules-text abuse pass

### 6. Single Card Entry

- User expectation:
  - required fields are clear
  - generated cards are the visual reference surface
  - editing fields is easy without losing formatting intent
  - accidental misuse is handled gracefully
- Primary code:
  - `src/components/card-forge/SingleCardGenerator.tsx`
  - `src/features/card-generator/components/GenerationWorkspace.tsx`
  - `src/lib/cardDataDefaults.ts`
- Current grade: `9/10`
- Verified:
  - invalid submission shows feedback
  - valid submission updates generated cards
  - single-card entry no longer carries a competing live preview; visual review happens in the generated reference gallery
  - generator tools are separated into `Single`, `Bulk Import`, and `Export & Sets` task tabs instead of one long mixed-purpose column
  - rich-text backed fields stayed editable through a full create -> generated-card flow
  - double-clicking `Create Generated Card` now adds only one card instead of stamping duplicates into the set
- Remaining focus:
  - rush-edit a partially completed card and confirm generated output still reflects the submitted field state

### 7. Bulk Card Generation

- User expectation:
  - CSV contract is understandable
  - invalid data is blocked early enough
  - mapping/preview/validation make mistakes recoverable
  - generation results match the template contract
- Primary code:
  - `src/components/card-forge/BulkGenerator.tsx`
  - `src/features/card-generator/components/BulkTemplateSetupPanel.tsx`
  - `src/features/card-generator/components/BulkCsvInputPanel.tsx`
  - `src/features/card-generator/components/BulkMappingReviewPanel.tsx`
  - `src/features/card-generator/components/BulkPreviewValidationPanel.tsx`
  - `src/features/card-generator/components/BulkGenerateActionBar.tsx`
- Current grade: `9/10`
- Verified:
  - valid CSV row generated correctly
  - mocked large-batch generation now explicitly covers the `1000` card prerelease floor
  - generated-card selectors now explicitly retain `1000` generated cards without dropping first/last row data
  - browser smoke coverage now seeds `1000` generated cards and verifies the gallery renders in bounded preview batches instead of painting every card at once
  - bulk contract/help content is visible
  - strict-mode and advanced mapping behavior were already covered by smoke tests
  - malformed CSV rows now surface explicit blocking issues instead of staying actionable deep into the flow
  - duplicate CSV headers are now treated as blocking issues
  - generation stays disabled until structurally invalid CSV is corrected, even with strict mode off
  - valid CSV re-enables generation once structural issues are removed
- Remaining focus:
  - verify quick-fix and preview states more aggressively
  - run multiline and rich-text heavy bulk samples

### 8. Generated Card Gallery and Edit Flow

- User expectation:
  - generated cards are easy to review, search, sort, edit, duplicate, and clear
  - gallery state feels consistent after generation bursts
- Primary code:
  - `src/features/card-generator/components/GenerationWorkspace.tsx`
  - `src/components/card-forge/EditCardDialog.tsx`
  - `src/store/selectors.ts`
- Current grade: `9/10`
- Verified:
  - generated-card count updates
  - gallery remained stable after repeated generation actions
  - clicking a generated gallery card opens the real edit dialog instead of drifting into a detached preview state
  - the edit dialog preserves the same grouped rich-text field structure used during single-card entry
  - editing a generated card and saving changes updates the gallery card content cleanly
  - rich-text emphasis survived the generated-card edit loop
  - `Duplicate & Close` now increments generated-card and ZIP-export counts and closes the dialog as labeled
  - gallery search can collapse the generated-card list to zero visible matches without corrupting the underlying generated-card count
  - clear-all still routes through an explicit confirmation dialog and canceling it leaves the gallery intact
- Findings:
  - page-level text extraction for generated cards is noisier than the actual visual output because absolutely positioned card layers flatten into repeated body text during DOM-level inspection; the visual gallery output still looked stable in screenshot review, but this is worth remembering when writing future browser assertions
- Remaining focus:
  - clear-all confirmation pass after mixed edit/duplicate bursts
  - export-image button sanity pass from inside the populated gallery
  - sort-order regression pass once the gallery contains more clearly differentiated cards

### 9. Save / Load / Persistence Expectations

- User expectation:
  - template, style, and card-set persistence feels dependable
  - load flows handle bad files safely
  - current selection survives refreshes sensibly
- Primary code:
  - `src/store/appStore.ts`
  - `src/app/api/templates/route.ts`
  - `src/app/api/styles/route.ts`
  - `src/app/page.tsx`
- Current grade: `9/10`
- Verified:
  - file-backed templates and styles load
  - card set save/load paths exist
  - delete confirmation flows are in place
  - `Save Set` downloads a valid `tcg-card-set.json`
  - clearing generated cards and loading that saved file restores the expected card count
  - invalid JSON card-set input fails with a visible `Load Error` instead of silently mutating state
- Remaining focus:
  - corrupted/partial file import pass
  - refresh persistence sanity pass

### 10. Export Surfaces

- User expectation:
  - PNG, ZIP, and PDF exports should reflect the same visual truth as preview
  - paper-size and export-profile settings should be understandable
- Primary code:
  - `src/lib/cardPreviewExport.tsx`
  - `src/lib/cardExportGeometry.ts`
  - `src/lib/printValidation.ts`
  - `src/features/card-generator/components/GenerationWorkspace.tsx`
- Current grade: `8.8/10`
- Verified:
  - export surfaces are present and wired
  - ZIP/PDF/PNG paths passed earlier release-prep verification
  - physical ZIP exports now derive raster dimensions from each template's physical size instead of forcing every template through the same base width
  - generated proof artifacts are intentionally git-ignored and should be recreated during release QA instead of committed
  - generated QA artifact passes confirmed distinct exported raster sizes across the shipped templates:
    - `63:88` -> `2232 × 3117`
    - `85:110` -> `3012 × 3897`
    - `35:20` -> `1239 × 708`
    - `3:4` -> `2340 × 3117`
  - a single-card physical PDF exported on `Standard TCG Card` paper size produced a `63 × 88 mm` page, which matches the expected physical card size
  - duplex baseline is now wired through the live product path:
    - front remains the primary editing face
    - the back face is optional and should be explicitly added by the user
    - new back faces seed from the file-backed `Obsidian Neon Card Back` default template
    - Maker can then switch between `Front Face` and `Back Face`
    - a generated duplex card exported as ZIP produced both `001_card-1_front.png` and `001_card-1_back.png`
    - both exported faces rendered at `2232 x 3117`
    - local proof artifacts are generated during duplex smoke verification and are not release assets
  - physical and digital ZIP exports now use distinct file/folder naming:
    - physical: `cardforge-physical-print-card-faces.zip` with `physical-print-card-faces/`
    - digital: `cardforge-digital-card-images.zip` with `digital-card-images/`
  - ZIP export progress now counts exported faces/images rather than only generated cards
  - physical PDF export now supports two front/back layouts:
    - separate front/back sheets using matching card placements for duplex printing
    - front + back on the same sheet for review, hand cutting, or manual assembly
  - PDF filenames now distinguish `print-duplex-sheets`, `print-same-sheet`, and `digital-sheet`
  - export validation now checks font warnings across both front and back canvases
  - five-straggler artifact pass produced and inspected fresh local outputs:
    - physical ZIP exported `front` and `back` PNG files at `2232 x 3117`
    - digital ZIP exported `front` and `back` PNG files at `744 x 1040`
    - physical duplex PDF produced `2` pages: one front sheet and one matching back sheet
    - digital PDF produced `1` review/share sheet
  - same-sheet duplex artifact pass produced a `print-same-sheet` PDF with `1` page containing the front/back sheet flow
- Remaining focus:
  - compare preview vs exported output after rich-text deep pass
  - printer-specific duplex flip/imposition rules if production partners require mirrored back placement
  - CMYK/PDF-X conversion remains a documented prepress step outside native browser export

### 11. Cleanup and Straggling Artifact Audit

- Goal:
  - find code that exists mainly as leftover development scaffolding, hidden duplication, or stale assumptions
- Current suspicious/important touch points:
  - `src/components/card-forge/CardTemplateMaker.tsx`
  - `src/components/card-forge/makerConstants.tsx`
  - `src/store/appStore.ts`
  - generator submission guard logic
  - rich-text parity and variable lifecycle helpers
- Current grade: `9.3/10`
- Verified:
  - obvious dead dependencies and old docs were already removed
  - feature boundaries are much cleaner than before
  - generated test proofs, local dev logs, and temporary run outputs are excluded from release assets
  - generated-card gallery rendering now lives in a reusable feature component with paged rendering for `1000` card sets
  - bulk CSV example and preview logic now lives in pure generator helpers instead of only inside the React coordinator
  - visible default template naming no longer uses the old `2.0` label
  - internal tab state now uses `template-maker`, with a safe migration for older `template-maker-2` persisted browser state
  - maker custom asset storage now uses `cardforge-maker-*` keys, with fallback reads for older `cardforge-maker2-*` uploads
  - launch style presets are one-file-per-style; the removed `appearance-library.json` prototype migration path is no longer active runtime code
  - blueprint now records feature ownership, intentionally large files, future library seams, and the shipped asset/template inventory
- Remaining focus:
  - keep final visual/default decisions intentionally small and shippable
  - remove or simplify code only when it does not reduce user-visible capability

## Deep-Pass Target Order

To avoid losing track, the recommended no-stone-unturned order is:

1. App shell and tab navigation
2. Template library and ownership actions
3. Canvas selection, drag, resize, grouping, undo/redo
4. Inspector panels one by one
5. Rich text and variable authoring end to end
6. Single-card generation misuse and polish
7. Bulk generation misuse and recovery
8. Generated card gallery and edit dialog
9. Save/load/persistence flows
10. Export parity and final visual trust pass

## Pre-Release Checklist

### 1. Functional Verification

- Confirm Card Template Maker opens, edits, and saves templates correctly.
- Confirm default templates load from `data/default-templates`.
- Confirm user templates save and delete locally in browser state.
- Confirm `/api/templates` save/delete behavior under `CARDFORGE_ALLOW_LIBRARY_WRITES=true` plus dev access, and confirm protected `403` behavior when library writes are disabled.
- Confirm `/api/styles` save/delete behavior under the same library-write gate, and confirm protected `403` behavior when disabled.
- Confirm the style library is loaded from individual files in `data/styles`.
- Confirm textures and dividers are returned by `/api/assets`.
- Confirm single-card generation produces preview cards.
- Confirm bulk generation accepts CSV input, maps fields, previews warnings, and generates cards.
- Confirm bulk generation has a mocked release-floor regression for at least `1000` generated cards.
- Confirm the generated-card gallery can load a `1000` card set in browser smoke with paged browsing instead of rendering all previews at once.
- Confirm edit-card dialog saves and duplicates correctly.
- Confirm PNG export works on generated cards.
- Confirm ZIP export works for generated card sets.
- Confirm PDF export works for current paper-size options.
- Confirm duplex templates export both front and back assets when a back face exists.
- Confirm Clerk sign-up, free profile state, Founder Beta claim, profile route, and disposable profile deletion pass through authenticated smoke testing.

Status: `PASS FOR INTERNAL QA`

Functional verification snapshot:

- Template editor keyboard flows: `PASS`
- Layer lock/visibility toggles: `PASS`
- Freeform template creation flow: `PASS`
- Single-card generation: `PASS`
- Bulk generator strict-mode and advanced mapping flow: `PASS`
- `/api/styles` one-file-per-style read path: `PASS`
- `/api/assets` recursive texture/divider discovery: `PASS`
- Export surfaces present and wired: `PASS`

### 2. Code Health

- Lint passes.
- Typecheck passes.
- Unit tests pass.
- Smoke tests pass.
- Authenticated Clerk/Supabase lifecycle smoke passes when Clerk dev keys and Supabase service credentials are available.
- No obvious dead client-facing surfaces remain in active runtime code.

Status: `PASS`

### 3. Performance

- First-load JS is no longer dominated by eagerly loaded editor/generator workspaces.
- Root page acts as an orchestration shell.
- Large feature areas are lazy-loaded.

Status: `PASS`

### 4. Asset and Data Hygiene

- Dev-only bulk sample CSV outputs were removed from committed release assets.
- `data/user-templates/` contains only `.gitkeep`; tracked local user-template artifacts were removed from the release tree.
- Public card assets are referenced, small, and discoverable through `/api/assets`.
- Arcane Forge premium textures, full-frame kits, dividers, ornaments, and style presets are shipped as reusable editor assets and consumed by upgraded default templates; premium parts are intentionally human-addable through the parts catalog rather than generated placeholder art.
- Default templates are intentionally shipped.
- Style presets are stored one-per-file in `data/styles/`.
- Asset discovery rules are explicit and limited to approved extensions.
- Generated proof exports and local run logs are ignored; they should be recreated as QA evidence, not shipped as repo assets.

Status: `PASS FOR INTERNAL QA`

### 5. Dependency Hygiene

- Unused dependency `@types/jszip` was removed.
- Obvious dead runtime dependency surface was trimmed.
- Declared Next versions are aligned with the resolved install state.

Status: `BLOCKED FOR PUBLIC RELEASE`

Note:
- `npm audit --omit=dev` currently reports `2` moderate findings through `next -> postcss`.
- `npm audit fix --force` suggests unsafe breaking downgrade paths and must not be used without a deliberate dependency decision.

### 6. Documentation

- README reflects current commands and code shape.
- Blueprint reflects current architecture.
- Discovery rules for templates, styles, textures, and dividers are documented.
- The repo keeps a small core doc set without overlapping transitional notes.

Status: `PASS`

## Known Residual Risks

### 1. Production Dependency Audit Findings

Current finding:
- `next -> postcss`

What we verified:
- `npm audit --omit=dev --audit-level=moderate` reports `2` production findings: `0` high and `2` moderate
- `npm audit fix --force` suggests an unsafe breaking downgrade path and must not be used

Recommended handling:
- monitor Next releases for a patched bundled `postcss`
- do not mark dependency hygiene as passing until `npm audit --omit=dev` exits successfully or this file records a named acceptance decision

Risk rating: `Moderate / Known / Launch Blocking if policy requires audit-clean dependencies`

### 2. Production Billing Entitlement Activation

Current finding:
- Stripe Checkout exists, but there is no production webhook or billing-owned entitlement store in this slice.
- Paid/dev unlocks are intentionally server-trusted: Clerk private metadata, server-only allowlists, local fallback mode, or a future billing source.
- Public Clerk metadata is ignored and must not be used as a paid/dev authority.

What we verified:
- focused unit tests prove public Clerk metadata no longer grants paid/dev export entitlement
- API errors now have shared no-store JSON envelopes with correlation ids

Recommended handling:
- add a Stripe webhook before public paid launch, or record a named decision to operate manually through private Clerk metadata/server allowlists
- keep public metadata display-only

Risk rating: `High / Known / Launch Blocking for paid self-serve`

### 3. Developer Asset Program Operational Readiness

Current finding:
- The developer asset pipeline now has owner-configurable rules, a Supabase schema, developer submissions, peer voting, and owner publish/archive/reject controls.
- Owner Site Mechanics now control public feature-board caps and negative-signal archive thresholds separately from developer asset voting rules.
- Owner Launch Readiness can now move official roadmap checkpoints through Plan, Start, Test, and Complete; Complete sets the shipped date used by the public roadmap.
- Owner Access & Promos can now show Founder Beta wave capacity, public cap capacity, next-wave availability, and active claim records.
- Asset lifecycle status is now separate from user-facing access tier: owner rules can place voted assets into Forge Review, Starter Library, Creator Pass, Official Default, or Hidden visibility.
- The default access ladder is 5 votes before tier assignment, 60% positive for Starter Library, and 80% positive for Creator Pass, with owner overrides available from `/owner`.
- Publish Total is derived from Starter plus Creator Pass caps so owners cannot create conflicting per-type library limits.
- Founder Beta should be treated as the single CardForge-owned launch access promo for this MVP. Stripe should later own real coupons, promotion codes, subscription discounts, invoices, and billing lifecycle webhooks.
- `/api/assets` now exposes one asset registry payload. Before the online registry migration is applied it falls back to shipped files; after `202605230002_asset_registry.sql` is applied it reads `cardforge_asset_registry`.
- Official shipped textures, dividers, templates, and element presets are seeded as `published` and `official`, so they remain visible in the app. After the official-review/content seed migrations, they also have developer review records so approved developers can keep voting on defaults.
- `202605230003_asset_registry_all_creation_assets.sql` expands the registry to all reusable creation asset classes: textures, dividers, parts, icons, images, templates, and element presets.
- `202605230004_developer_asset_upload_bridge.sql` adds the public `cardforge-developer-assets` storage bucket and source-file metadata columns that let approved developer submissions publish into the same live registry.
- `202605240001_official_asset_review_submissions.sql` backfills official registry assets into `cardforge_developer_asset_submissions` and links them back to the registry, making default assets part of the continuous developer voting surface.
- `202605240002_official_layout_registry_content.sql` backfills official templates and element presets into `cardforge_asset_registry` with embedded JSON payloads, then links those records into developer submissions so Layout Studio defaults are also database-backed and voteable.
- `202605240003_unify_owner_default_voting.sql` clears the old owner-forced Official overrides from seeded defaults so owner-contributed defaults are governed by the same vote/cap pipeline as every other asset.
- `202605240004_developer_profile_names.sql` adds first/last name fields to developer profiles so queues and ledgers can show a contributor name first, falling back to email when no name is available.
- `202605240005_developer_self_voting_rule.sql` adds owner-configurable contributor self-voting. It defaults on for solo/demo review and can be disabled for strict peer-only voting.
- The developer Asset Hub review queue is split into Site Defaults, Candidate Uploads, and Archive, with filtering, paging, expanded previews, archive voting, and uploader edits for unpublished/non-rejected submissions.
- Developer Asset Hub badges should read as status, contributor, and current tier. Owner default rows are included in the owner's contributor aliases so My Pipeline is not empty for the owner account; self-voting and whether those rows appear in the owner's review lanes is controlled by the contributor self-voting owner rule.
- Structured template submissions now render a real card preview in the expanded asset view when the embedded/default template payload is available; broken image previews fall back to an explicit unavailable state instead of a silent blank.
- Layout Studio template library rows use scaled real `CardPreview` renders instead of symbolic thumbnail placeholders.
- Owner Developer Program now exposes cap pressure by asset type and a developer monthly ledger. Owners set the per-developer submission allowance and required published count; the app calculates submissions left and missing published work per contributor.
- Cap changes rebalance one shared asset pipeline: lowering a cap keeps the highest-signal assets published, moves over-cap passing assets back to publish-candidate review, and moves failing assets to archive.
- Saving a modified default template keeps the default template id/source and syncs the registry-backed default payload instead of creating an indistinguishable user-template copy.
- Owner Developer Program now includes voting presets for solo owner testing, current roster review, launch roster review, and full council review.
- Owner Developer Program now includes a storage forecast based on publish caps, one month of possible voting submissions, and visible archive capacity.
- Owner Launch Readiness now includes database footprint metrics after the asset-registry migration function is applied.
- The framework tracks contribution eligibility for a future financial launch, but it intentionally does not move money or create Stripe Connect accounts.
- Signed-in paid/free user uploads remain local and are not promoted to site defaults without a future explicit submission flow.
- Current shipped templates, styles, textures, dividers, icons, and image assets keep their source files in the repo/static asset layer while the registry becomes the app-facing catalog. Developer-submitted image/source assets now use the upload bridge; repo-backed official defaults should only be moved into database/storage records once versioning and owner rollback rules are finalized.

Recommended handling:
- run `supabase/migrations/202605230001_developer_asset_pipeline.sql` before testing the developer Asset Hub
- run `supabase/migrations/202605230002_asset_registry.sql` before treating the database registry and owner footprint metrics as the online source of truth
- run `supabase/migrations/202605230003_asset_registry_all_creation_assets.sql` before submitting icons, images, templates, or element presets into the registry
- run `supabase/migrations/202605230004_developer_asset_upload_bridge.sql` before testing developer file uploads or owner publish-to-library actions
- run `supabase/migrations/202605240001_official_asset_review_submissions.sql` before expecting approved developers to vote on official default assets
- run `supabase/migrations/202605240002_official_layout_registry_content.sql` before expecting official templates and element presets to load from the registry-backed asset pipeline
- run `supabase/migrations/202605240003_unify_owner_default_voting.sql` before expecting owner-contributed defaults to rebalance like regular pipeline assets
- run `supabase/migrations/202605240004_developer_profile_names.sql` before expecting contributor first/last names in developer queues and owner ledgers
- run `supabase/migrations/202605240005_developer_self_voting_rule.sql` before expecting the owner self-voting rule to persist
- rerun `supabase/migrations/202605220003_owner_console.sql` or apply its `cardforge_owner_settings` `alter table ... add column if not exists` block before testing Site Mechanics
- confirm owner settings in `/owner` before inviting developers
- verify the owner account sees Library Command, the developer account sees Forge Review, paid accounts see Creator Pass Library, and free users see Starter Library messaging
- verify `/api/assets` includes the expected official registry counts plus shipped-file fallbacks after all official seed migrations are applied; database rows should override matching shipped assets without hiding unrelated repo assets
- verify the developer review queue includes active/published official default assets, separates candidate uploads from current defaults and archive, and keeps defaults/archive assets voteable until rejected or owner-hidden
- verify toggling contributor self-voting changes whether own/owner-default assets appear in review lanes and whether the vote route accepts those votes
- verify Owner Developer Program shows cap pressure, owner default counts, per-developer submissions left, and required published progress
- verify developer and owner asset rows show status, contributor name/email, current tier, preview state, and expanded template/image previews without broken thumbnails
- verify generator template selectors label Default vs User templates, especially when a modified default and user template share similar names
- verify the owner can complete an official roadmap checkpoint from `/owner` and see the public roadmap reflect the shipped state
- verify Founder Beta active users are visible in `/owner` after a signed-in account claims a slot
- verify a developer can upload an SVG/PNG/JPG/WEBP/JSON source file, submit it to voting, and have an owner-published submission appear through `/api/assets`
- treat payout reports as planning data until Stripe Connect, tax/legal terms, refund handling, and billing webhooks are implemented

Risk rating: `Medium / Known / Launch Blocking for developer-program rollout, not for core local authoring`

### 4. Large Internal Editor Coordinator

File:
- `src/components/card-forge/CardTemplateMaker.tsx`

Why it is acceptable right now:
- most inspector and tool surfaces were already extracted
- the remaining size is mostly orchestration and canvas logic, not unchecked duplication

Risk rating: `Low`

## Release Owner Sign-Off

Before publishing, confirm:

1. The team resolves or formally accepts the `2` moderate Next/PostCSS findings.
2. The deployment target does not block release on those findings.
3. Final default templates and styles are the intended shipped set.
4. No local-only user templates are committed before release.
5. Asset directories only contain intended shipped files because new textures/dividers are auto-discovered.

## Immediate Post-Release Follow-Up

After release, track these items:

1. Watch Next releases for a version that removes the nested vulnerable `postcss`.
2. Re-run `npm audit --omit=dev` on every framework/auth upgrade.
3. Revisit `makerConstants.tsx` if another maintainability pass is scheduled.
4. Continue with optional UX polish and bundle micro-optimizations only if they do not destabilize the app.
5. Restart any already-running local `next dev` server after `npm run build`; production builds rewrite `.next`, and a stale dev server can throw missing chunk errors until restarted.
6. Before demos, confirm `localhost:9002` is served by `npm run dev`, not `npm run start` / `next start`; a stale production server on the dev port can serve old chunks and unstyled pages.
