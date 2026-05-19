# Release Checklist

Last updated: May 19, 2026

## Release Status

Current recommendation: `CONDITIONAL GO`

The application is in a strong release state for functionality, structure, and performance. The only known unresolved issue is an upstream dependency audit finding tied to Next.js bundling `postcss@8.4.31`.

## Go / No-Go Summary

### Go Criteria Met

- Template editor and generator workflows are functional.
- Single-card generation works.
- Bulk CSV generation works.
- PNG, ZIP, and PDF export flows are present.
- The repo has completed the cleanup and consolidation pass.
- Route-level bundle size was materially reduced.
- Local verification is green.

### Remaining Go Decision

Release can proceed if the team accepts:
- `2` moderate `npm audit` findings tied to `next -> postcss`
- those findings are currently upstream/framework-pinned and not safely fixable in-repo

Release should pause if:
- policy requires zero known audit findings
- a customer, marketplace, or deployment target blocks shipment with moderate framework advisories

## Current Verification State

These checks currently pass:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run smoke`

Current production build snapshot:

- `/` route size: `33.2 kB`
- first-load JS: `155 kB`

## Future Architecture Note

The current release still enters directly into the main CardForge workspace. A later product phase is expected to shift the primary entry toward a landing page plus authenticated user profiles, with the heavy editor loading only when the user intentionally enters that workspace.

This future architecture is intentionally out of scope for the current release checklist.

Do not treat it as a blocker before shipping unless release scope changes. It should be revisited after:

- the current release checklist is complete
- core functionality and QA are fully stabilized
- any major refactor toward stronger commercial-safe open source libraries is complete enough that the entry architecture does not need to be reworked twice

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
- Confirm user templates save and delete through `/api/templates`.
- Confirm appearance styles save and delete through `/api/styles`.
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

Status: `PASS`

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
- No obvious dead client-facing surfaces remain in active runtime code.

Status: `PASS`

### 3. Performance

- First-load JS is no longer dominated by eagerly loaded editor/generator workspaces.
- Root page acts as an orchestration shell.
- Large feature areas are lazy-loaded.

Status: `PASS`

### 4. Asset and Data Hygiene

- Dev-only bulk sample CSV outputs were removed from committed release assets.
- Stray local user template artifacts were removed.
- Public card assets are referenced, small, and discoverable through `/api/assets`.
- Default templates are intentionally shipped.
- Style presets are stored one-per-file in `data/styles/`.
- Asset discovery rules are explicit and limited to approved extensions.
- Generated proof exports and local run logs are ignored; they should be recreated as QA evidence, not shipped as repo assets.

Status: `PASS`

### 5. Dependency Hygiene

- Unused dependency `@types/jszip` was removed.
- Obvious dead runtime dependency surface was trimmed.
- Declared Next versions are aligned with the resolved install state.

Status: `PASS WITH NOTE`

Note:
- `npm audit --omit=dev` still reports `2` moderate findings due to nested `postcss@8.4.31` inside `next@15.5.18`

### 6. Documentation

- README reflects current commands and code shape.
- Blueprint reflects current architecture.
- Discovery rules for templates, styles, textures, and dividers are documented.
- The repo keeps a small core doc set without overlapping transitional notes.

Status: `PASS`

## Known Residual Risks

### 1. Framework-Pinned Audit Findings

Current finding:
- `next -> postcss@8.4.31`
- advisory: PostCSS XSS via unescaped `</style>` stringify output

What we verified:
- upgrading from the earlier Next version to `15.5.18` did not remove the nested dependency
- current `next@16.2.6` still declares `postcss: 8.4.31`
- `npm audit fix --force` suggests an unsafe breaking downgrade path and must not be used
- a local override attempt did not safely replace the nested dependency

Recommended handling:
- document this as an upstream dependency exception
- monitor Next releases for a patched bundled `postcss`

Risk rating: `Moderate / Known / Upstream`

### 2. Large Internal Editor Coordinator

File:
- `src/components/card-forge/CardTemplateMaker.tsx`

Why it is acceptable right now:
- most inspector and tool surfaces were already extracted
- the remaining size is mostly orchestration and canvas logic, not unchecked duplication

Risk rating: `Low`

## Release Owner Sign-Off

Before publishing, confirm:

1. The team accepts the `2` moderate upstream audit findings.
2. The deployment target does not block release on those findings.
3. Final default templates and styles are the intended shipped set.
4. No local-only user templates are committed before release.
5. Asset directories only contain intended shipped files because new textures/dividers are auto-discovered.

## Immediate Post-Release Follow-Up

After release, track these items:

1. Watch Next releases for a version that removes the nested vulnerable `postcss`.
2. Re-run `npm audit --omit=dev` on every framework upgrade.
3. Revisit `makerConstants.tsx` if another maintainability pass is scheduled.
4. Continue with optional UX polish and bundle micro-optimizations only if they do not destabilize the app.
