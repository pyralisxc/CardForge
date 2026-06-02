# Release Checklist

Last updated: May 27, 2026

## Release Status

Current recommendation: `GO FOR INTERNAL QA AND PUBLIC DEMO/BETA`, `NO-GO FOR PAID PRODUCTION LAUNCH`

The application is in a strong internal QA state for core authoring, generation, export, account, roadmap, and developer-pipeline workflows after the Phase 1-3 AAA stabilization work. The known Next/PostCSS production audit advisory is accepted for MVP demo/public-beta launch because it is a framework-bundled moderate advisory with no identified CardForge runtime path that parses user-submitted CSS through PostCSS and injects it into a page `<style>` tag. Paid production launch should still pause until billing-owned entitlement operations and release hygiene are complete.

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

Release can proceed only after the team resolves:
- the Stripe webhook or billing-owned entitlement store for production paid-account activation
- production `NEXT_PUBLIC_APP_URL` points at the deployed app/custom domain, not Supabase

Release should pause if:
- policy requires zero known audit findings
- a customer, marketplace, or deployment target blocks shipment with moderate framework advisories

## Current Verification State

These checks passed after the May 27, 2026 field-contract and active-doc hygiene pass:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm audit --omit=dev` does not pass
- whitespace check passed with `git diff --check`
- Field Contract v1 now keeps active generator contract types to `text`, `structuredRows`, and `image`; old public text subtypes were removed from active app/docs/tests.
- entitlement hardening now ignores public Clerk metadata and accepts paid/dev unlocks only from Clerk private metadata, server allowlists, local fallback mode, or a future billing-owned source
- API bootstrap/account/billing failures now use no-store JSON error envelopes with correlation ids
- tracked local-only user template JSON and the empty `.modified` marker were removed from the release tree
- `/` now renders the public CardForge landing page, `/studio` renders the maker/generator workspace, `/account` renders profile/export/dev-tool status, and `/profile` renders Clerk-backed profile management
- canonical app URL resolution now rejects Supabase project hosts and falls back to Vercel deployment URLs for metadata, robots/sitemap, and Stripe return URLs

Current production build snapshot:

- `/` route size: `5.6 kB`
- `/studio` route size: `28.1 kB`
- `/account` route size: `7.46 kB`
- `/developer` route size: `193 kB`
- `/owner` route size: `22.4 kB`
- `/profile` route size: `7.41 kB`
- first-load JS: `131 kB` on `/`, `209 kB` on `/studio`, `174 kB` on `/account`, `394 kB` on `/developer`, `169 kB` on `/owner`, `167 kB` on `/profile`
- unit tests: `54` files, `306` tests passed
- smoke tests: `18` browser tests passed with `npm run smoke` in the previous browser cleanup checkpoint; not rerun in the May 26 hygiene pass
- authenticated smoke: `4` reusable-account browser tests passed with `npx playwright test tests/smoke/auth-account.spec.ts --project=chromium`

Current production audit snapshot:

- last checked: `May 27, 2026` with `npm audit --omit=dev`
- high: `0`
- moderate: `2`
- total: `2`

Known audit chains:

- `next -> postcss` via nested `postcss <8.5.10`

Accepted dependency advisory exception:

- Decision: `ACCEPTED FOR MVP DEMO/PUBLIC BETA`
- Decision owner: `Cameron / CardForge`
- Date: `May 25, 2026`
- Rationale: stable Next releases still bundle the affected nested PostCSS version, the latest stable Next upgrade does not remove the advisory, and the patched PostCSS dependency currently appears only in canary Next builds. CardForge does not intentionally accept raw user CSS, process it through PostCSS at runtime, and inject it into page `<style>` tags.
- Operating rule: do not describe the release as audit-clean until `npm audit --omit=dev` exits successfully. Keep monitoring stable Next releases and remove this exception once Next ships a patched stable dependency chain.
- Visibility: internal release/developer docs only. Do not surface this advisory in user-facing marketing or onboarding copy unless a customer, marketplace, or security review asks for the current dependency-audit state.

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

Mobile Layout Studio contract:

- The active mobile surface is one of `Canvas`, `Templates`, or `Inspector`; inactive surfaces should not remain stacked in page flow.
- Canvas touch gestures are custom-owned by the editor: the canvas and resize handles use `touch-action: none` so pinch zoom, two-finger pan, drag, and resize stay inside the editor.
- Side panels keep native vertical scroll with `touch-action: pan-y`.
- Canvas recovery controls should stay available: zoom in/out, fit, 100%, and center.

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
  - `src/features/app-shell/components/StudioHeader.tsx`
  - `src/lib/constants.ts`
- Current grade: `9.2/10`
- Verified:
  - repeated tab switching stayed stable
  - no relevant console errors or framework overlays
  - page identity and visible structure matched expectations
  - phone Layout Studio now uses one active surface at a time (`Canvas`, `Templates`, `Inspector`) instead of stacking the full desktop workspace in page flow
- Remaining focus:
  - mobile sheet navigation pass outside the Layout Studio surface switcher
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
  - pipeline-backed default templates load
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
  - `src/features/template-editor/components/CardTemplateMaker.tsx`
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
  - registry asset loading is live
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
  - `src/features/card-generator/components/GeneratorFieldInput.tsx`
  - `src/features/card-generator/components/GeneratorFieldGroups.tsx`
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
  - `src/features/card-generator/components/SingleCardGenerator.tsx`
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
  - `src/features/card-generator/components/BulkGenerator.tsx`
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
  - `src/features/card-generator/components/EditCardDialog.tsx`
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
  - pipeline templates and styles load
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
    - new back faces seed from the pipeline-backed `Obsidian Neon Card Back` default template
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
  - `src/features/template-editor/components/CardTemplateMaker.tsx`
  - `src/features/template-editor/lib/elementKits.tsx`
  - `src/features/template-editor/lib/elementStylePresets.ts`
  - `src/store/appStore.ts`
  - generator submission guard logic
  - rich-text parity and variable lifecycle helpers
- Current grade: `9.3/10`
- Verified:
  - obvious dead dependencies and old docs were already removed
  - feature boundaries are much cleaner than before
  - generated test proofs, local dev logs, and temporary run outputs are excluded from release assets
  - generated-card gallery rendering now lives in a reusable feature component with TanStack Virtual-backed row rendering for large generated sets
  - bulk CSV example and preview logic now lives in pure generator helpers instead of only inside the React coordinator
  - visible default template naming no longer uses the old `2.0` label
  - internal tab state now uses `template-maker`, with a safe migration for older `template-maker-2` persisted browser state
  - maker custom asset storage now uses the current `cardforge-maker-*` keys only; older `cardforge-maker2-*` fallback reads are no longer part of the launch import path
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
- Confirm Clerk reusable free-account state, Founder Beta claim, roadmap voting, profile route, reusable owner/developer Asset Hub submission, owner publish, and `/api/assets` registry verification pass through authenticated smoke testing.

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
- Arcane Forge textures, full-frame kits, dividers, overlays, and style presets are shipped as reusable editor assets and consumed by upgraded default templates; image/overlay source assets are intentionally human-addable through normal asset pickers rather than a separate catalog.
- Default templates are intentionally shipped.
- Style presets are stored one-per-file in `data/styles/`.
- Asset discovery rules are explicit and limited to approved extensions.
- Generated proof exports and local run logs are ignored; they should be recreated as QA evidence, not shipped as repo assets.

Status: `PASS FOR INTERNAL QA`

### 5. Dependency Hygiene

- Unused dependency `@types/jszip` was removed.
- Obvious dead runtime dependency surface was trimmed.
- Declared Next versions are aligned with the resolved install state.

Status: `PASS WITH ACCEPTED FRAMEWORK ADVISORY EXCEPTION`

Note:
- `npm audit --omit=dev` currently reports `2` moderate findings through `next -> postcss` via nested `postcss <8.5.10`.
- `npm audit fix --force` suggests unsafe breaking downgrade paths and must not be used.
- This exception is accepted for MVP demo/public-beta launch, but the release must not be described as audit-clean.

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
- `npm audit --omit=dev` reports `2` production findings: `0` high and `2` moderate
- `npm audit fix --force` suggests an unsafe breaking downgrade path and must not be used

Recommended handling:
- monitor Next releases for a patched bundled `postcss`
- do not claim audit-clean status until `npm audit --omit=dev` exits successfully
- do not upgrade to canary Next solely to clear the audit unless a separate stability decision accepts that framework risk

Risk rating: `Moderate / Known / Accepted for MVP demo/public beta / Launch Blocking only if policy requires audit-clean dependencies`

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
- Owner Launch Readiness can now move CardForge-authored roadmap checkpoints through Plan, Start, Test, and Complete; Complete sets the shipped date used by the public roadmap.
- Owner Access & Promos can now show Founder Beta wave capacity, public cap capacity, next-wave availability, and active claim records.
- Asset lifecycle status is now separate from user-facing access tier: owner rules can place voted assets into Forge Review, Starter Library, Creator Pass, or Hidden visibility. The active asset tier model is `developer`, `free`, `paid`, or `hidden`; published-to-site is not a separate tier.
- The default access ladder is 5 votes before tier assignment, 60% positive for Starter Library, and 80% positive for Creator Pass, with owner overrides available from `/owner`.
- Publish Total is derived from Starter plus Creator Pass caps so owners cannot create conflicting per-type library limits.
- Founder Beta should be treated as the single CardForge-owned launch access promo for this MVP. Stripe should later own real coupons, promotion codes, subscription discounts, invoices, and billing lifecycle webhooks.
- `/api/assets` now exposes one asset registry payload from `cardforge_asset_registry`; it does not silently rebuild the catalog from repo starter files.
- Starter textures, dividers, templates, and element presets are synced into the pipeline as published starter-library assets so they remain visible in the app and stay voteable.
- `202605230003_asset_registry_all_creation_assets.sql` expands the registry to all reusable creation asset classes: textures, dividers, parts, icons, images, templates, and element presets.
- `202605230004_developer_asset_upload_bridge.sql` adds the public `cardforge-developer-assets` storage bucket and source-file metadata columns that let approved developer submissions publish into the same live registry.
- `202605240001_official_asset_review_submissions.sql` backfills CardForge-owned registry assets into `cardforge_developer_asset_submissions` and links them back to the registry, making default assets part of the continuous developer voting surface.
- `202605240002_official_layout_registry_content.sql` backfills CardForge-owned templates and element presets into `cardforge_asset_registry` with embedded JSON payloads, then links those records into developer submissions so Layout Studio defaults are also database-backed and voteable.
- `202605240003_unify_owner_default_voting.sql` clears owner-forced default overrides from seeded defaults so owner-contributed defaults are governed by the same vote/cap pipeline as every other asset.
- `202605270001_remove_official_asset_tier.sql` normalizes historical asset-tier rows into Starter Library and constrains active asset tiers to Hidden, Starter Library, Creator Pass, or Forge Review.
- `202605240004_developer_profile_names.sql` adds first/last name fields to developer profiles so queues and ledgers can show a contributor name first, falling back to email when no name is available.
- `202605240005_developer_self_voting_rule.sql` adds owner-configurable contributor self-voting. It defaults on for solo/demo review and can be disabled for strict peer-only voting.
- `202605240006_owner_vote_weight.sql` adds owner-configurable vote weight. It defaults to 1x so the owner votes like any other developer, with 2x/3x available from `/owner` for stronger owner signal in close grading decisions.
- The developer Asset Hub review queue is split into Live Library, Review Candidates, and Recovery Archive, with filtering, paging, expanded previews, archive voting, and uploader edits for unpublished/non-rejected submissions.
- The developer submit flow accepts candidate sources from three places: Personal Library saved templates/styles/local art, file-directory browse, or drag/drop. Personal Library items stay browser-local until the developer explicitly sends them to Forge Review, and project export remains the portability backup for moving that local library between devices.
- Authenticated smoke now exercises the visible developer Asset Hub path: a reusable owner/dev QA account opens `/developer`, uploads a tiny SVG through the submission form, sends it to Forge Review, confirms it appears in My Pipeline and review lanes, then continues owner publish and `/api/assets` registry verification.
- Authenticated smoke prefers reusable Clerk QA accounts from `.env.local`:
  - `CARDFORGE_E2E_FREE_EMAIL` should point at a reusable free QA account for Founder Beta, roadmap voting, and profile-route checks.
  - `CARDFORGE_E2E_PAID_EMAIL` should point at a reusable paid QA account so the account matrix can verify Creator Pass export state.
  - `CARDFORGE_E2E_DEV_EMAIL` should point at a reusable developer QA account so the account matrix can verify developer hub access without owner access.
  - `CARDFORGE_E2E_OWNER_EMAIL` should point at a reusable owner/dev QA account for Developer Asset Hub upload, My Pipeline, review lanes, owner publish, and `/api/assets` verification.
  - `CARDFORGE_E2E_ALLOW_DISPOSABLE_USERS=true` is an explicit fallback only; leave it false/blank when avoiding stray Clerk accounts.
- Authenticated smoke now verifies developer voting rules across reusable developer and owner accounts: contributor self-voting can be disabled/enabled, owner vote weight changes vote totals, and owner archive/recovery can move a submission back into voting.
- Owner Developer Program queue actions now expose explicit archive/recovery labels, and authenticated smoke clicks the visible `/owner` archive and recover controls for a real submitted asset.
- `202605240006_owner_vote_weight.sql` has been applied to the connected Supabase QA project; without it, owner vote-weight controls degrade to 1x and weighted-vote smoke cannot pass.
- The `/account` management CTA now reads `Manage Account`, and authenticated profile smoke checks the embedded Clerk profile panel uses readable CardForge text colors.
- Account entitlement refreshes after Clerk identity changes, so reusable QA account switching and real sign-in transitions do not leave stale free/paid/dev tier copy on `/account`.
- Developer Asset Hub badges should read as status, contributor, and current tier. Starter rows are normal contributor-owned pipeline rows; self-voting and whether own rows appear in review lanes is controlled by the contributor self-voting owner rule.
- Developer account deletion must not delete contribution history. Submissions, votes, published registry rows, source references, and contributor credit are durable platform records; removal from the program should use profile status/access changes and asset archive/reject/hidden states.
- Structured template submissions now render a real card preview in the expanded asset view when the embedded/default template payload is available; broken image previews fall back to an explicit unavailable state instead of a silent blank.
- Layout Studio template library rows use scaled real `CardPreview` renders instead of symbolic thumbnail placeholders.
- Owner Developer Program now exposes cap pressure by asset type and a developer monthly ledger. Owners set base monthly submission allowance and required published count, then can override those rules per developer account, pause/resume future creator-pool eligibility, and leave owner notes; the app calculates each contributor's effective submissions left and missing published work.
- The developer hub now explains the future creator-pool plan directly: the current placeholder policy is 10% of eligible profit split evenly among eligible active developers after CardForge's payout systems and terms are ready. This is planning copy only, not a live payout flow.
- Cap changes rebalance one shared asset pipeline: lowering a cap keeps the highest-signal assets published, moves over-cap passing assets back to publish-candidate review, and moves failing assets to archive.
- Saving a modified default template keeps the default template id/source and syncs the registry-backed default payload instead of creating an indistinguishable user-template copy.
- Owner Developer Program now includes voting presets for solo owner testing, current roster review, launch roster review, and full council review.
- Owner Developer Program now includes an owner vote weight control. Vote weight changes owner vote impact only; starter assets still use the same submission, voting, archive, and registry paths as every other asset.
- Owner Developer Program now includes a storage forecast based on publish caps, one month of possible voting submissions, and visible archive capacity.
- Owner Launch Readiness now includes database footprint metrics after the asset-registry migration function is applied.
- The framework tracks contribution eligibility for a future financial launch, but it intentionally does not move money or create Stripe Connect accounts.
- Signed-in paid/free user uploads remain `localOnly` and are not promoted to site defaults without a future explicit submission flow.
- Current starter templates, styles, textures, dividers, icons, and image assets are synced into the registry/developer pipeline for app-facing use. Repo/static files remain import material and historical source references, while developer-submitted image/source assets use the upload bridge.

Recommended handling:
- run `supabase/migrations/202605230001_developer_asset_pipeline.sql` before testing the developer Asset Hub
- run `supabase/migrations/202605230002_asset_registry.sql` before treating the database registry and owner footprint metrics as the online source of truth
- run `supabase/migrations/202605230003_asset_registry_all_creation_assets.sql` before submitting icons, images, templates, or element presets into the registry
- run `supabase/migrations/202605230004_developer_asset_upload_bridge.sql` before testing developer file uploads or owner publish-to-library actions
- run `supabase/migrations/202605240001_official_asset_review_submissions.sql` before expecting approved developers to vote on CardForge default assets
- run `supabase/migrations/202605240002_official_layout_registry_content.sql` before expecting CardForge-authored templates and element presets to load from the registry-backed asset pipeline
- run `supabase/migrations/202605270001_remove_official_asset_tier.sql` before expecting the database to reject obsolete asset-tier values
- run `supabase/migrations/202605240003_unify_owner_default_voting.sql` before expecting owner-contributed defaults to rebalance like regular pipeline assets
- run `supabase/migrations/202605240004_developer_profile_names.sql` before expecting contributor first/last names in developer queues and owner ledgers
- run `supabase/migrations/202605240005_developer_self_voting_rule.sql` before expecting the owner self-voting rule to persist
- run `supabase/migrations/202605240006_owner_vote_weight.sql` before expecting owner vote weight to persist and affect developer asset grading
- run `supabase/migrations/202605250001_roadmap_level_up_copy.sql` before expecting existing Supabase projects to show the polished level-up roadmap checkpoint names and descriptions
- run `supabase/migrations/202605250002_roadmap_annual_coverage_targets.sql` before expecting existing Supabase projects to store checkpoint targets as 12x the cumulative running monthly cost; the filename reflects the original wording, but the stored value is the monthly unlock target
- rerun `supabase/migrations/202605220003_owner_console.sql` or apply its `cardforge_owner_settings` `alter table ... add column if not exists` block before testing Site Mechanics
- confirm owner settings in `/owner` before inviting developers
- verify the owner account sees Library Command, the developer account sees Forge Review, paid accounts see Creator Pass Library, and free users see Starter Library messaging
- verify `/api/assets` includes the expected registry counts after the pipeline sync has imported starter material; missing database content should surface as an unavailable/empty catalog rather than silently repopulating from repo folders
- verify the developer review queue includes active/published CardForge default assets, separates candidate uploads from current defaults and archive, and keeps defaults/archive assets voteable until rejected or owner-hidden
- verify toggling contributor self-voting changes whether own/CardForge-default assets appear in review lanes and whether the vote route accepts those votes
- verify changing owner vote weight between 1x, 2x, and 3x changes owner vote impact without changing which assets the owner can manage
- verify Owner Developer Program shows cap pressure, CardForge default counts, per-developer submissions left, and required published progress
- verify developer and owner asset rows show status, contributor name/email, current tier, preview state, and expanded template/image previews without broken thumbnails
- verify generator template selectors label Default vs User templates, especially when a modified default and user template share similar names
- verify the owner can complete a CardForge-authored roadmap checkpoint from `/owner` and see the public roadmap reflect the shipped state
- verify Founder Beta active users are visible in `/owner` after a signed-in account claims a slot
- verify a developer can choose a Personal Library template/style/local art item, browse for an SVG/PNG/JPG/WEBP/JSON source file, or drag/drop that file, submit it to voting, see it in My Pipeline/review lanes, and have an owner-published submission appear through `/api/assets`
- treat payout reports as planning data until Stripe Connect, tax/legal terms, refund handling, and billing webhooks are implemented

Risk rating: `Medium / Known / Launch Blocking for developer-program rollout, not for core local authoring`

### 4. Large Internal Editor Coordinator

File:
- `src/features/template-editor/components/CardTemplateMaker.tsx`

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
3. Revisit `src/features/template-editor/lib/elementKits.tsx` and `src/features/template-editor/lib/elementStylePresets.ts` if another maintainability pass is scheduled.
4. Continue with optional UX polish and bundle micro-optimizations only if they do not destabilize the app.
5. Restart any already-running local `next dev` server after `npm run build`; production builds rewrite `.next`, and a stale dev server can throw missing chunk errors until restarted.
6. Before demos, confirm `localhost:9002` is served by `npm run dev`, not `npm run start` / `next start`; a stale production server on the dev port can serve old chunks and unstyled pages.
7. Playwright smoke tests reuse `localhost:9002` through `playwright.config.ts`; do not run a second `next dev` against the same checkout on another port because concurrent dev servers can rewrite `.next` and leave the visible Studio with missing route chunks.
