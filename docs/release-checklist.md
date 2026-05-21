# Release Checklist

Last updated: May 19, 2026

## Release Status

Current recommendation: `NO-GO UNTIL WORKER EXPORT CERTIFICATION`

The application is in a strong release state for core authoring, generation, structure, and browser fallback export. Production launch should still block on certifying the new worker-backed export path against the 1000-card / 2000-face requirement.

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

Release can proceed after:
- worker ZIP export passes the 1000-card / 2000-face acceptance run
- worker PDF export passes page-size/page-count checks for physical duplex and same-sheet modes
- preview-vs-worker output comparison is accepted for the current visual baseline
- the team accepts remaining moderate audit findings if they are still framework-pinned

Release should pause if:
- worker export does not materially improve stability over the browser fallback
- worker output drifts from current `CardPreview` expectations in a user-visible way
- policy requires zero known audit findings
- a customer, marketplace, or deployment target blocks shipment with moderate framework advisories

## Current Verification State

These checks currently pass:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run smoke`
- focused worker foundation: `npm run test -- tests/unit/export-worker.test.ts`

Current production build snapshot:

- `/` route size: `33.2 kB`
- first-load JS: `155 kB`

Worker export foundation snapshot:

- `POST /api/export-jobs` queues local file-backed jobs under ignored `storage/export-jobs/`.
- `GET /api/export-jobs/:id`, `GET /download`, and `POST /cancel` expose status, artifact download, and cancellation.
- `npm run export:worker` processes queued jobs outside the browser UI.
- Unit coverage verifies preflight estimates, job state transitions, Sharp PNG dimensions, and a physical ZIP with exact front/back entries.
- Production-scale certification is still pending and remains the launch blocker.

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
- Current grade: `9.5/10`
- Verified:
  - repeated tab switching stayed stable
  - no relevant console errors or framework overlays
  - page identity and visible structure matched expectations
  - mobile sheet navigation now has browser smoke coverage for repeated open/close stress and switching between Maker and Generator
- Remaining focus:
  - continue watching small-screen layout density during visual/default polish

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
- Current grade: `9.1/10`
- Verified:
  - file-backed default templates load
  - template selection works in Maker and Generator
  - delete flow is protected by confirmation
  - Maker template action buttons expose visible `New`, `Clone`, and `Delete` labels plus accessible names/titles
- Findings:
  - template actions are now discoverable enough for launch; future polish can still improve explanatory empty states around default vs user-owned templates
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
- Current grade: `9.5/10`
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
  - selected-element resize controls now render in a topmost canvas overlay, so an active lower layer can still be resized when a larger glaze/border/decorative layer sits above it
  - browser smoke now verifies edge-resizing an overlapped lower element and then depth-cycling back through the stacked layers
  - rotated selected elements now project pointer movement into the element's local axes during resize, so diagonal/rotated edge drags feel aligned to the object instead of the page grid
  - tiny selected elements now use explicit edge hit-zone geometry so small runes, icons, pips, and divider handles remain targetable inside dense stacks
  - browser smoke now verifies resizing a `10 x 10` rotated selected element underneath multiple higher layers
  - browser smoke now verifies undo/redo after a mixed keyboard move plus edge resize
- Findings:
  - keyboard movement previously felt too focus-sensitive; the canvas now re-focuses on selection, but this should stay under active regression watch in future passes
  - grouped-parent visibility and re-selection in the layer tree improved with a clearer group badge, but the grouped parent still deserves continued discoverability review under denser real templates
- Remaining focus:
  - extended real-template abuse pass for very large canvases and mixed rotation angles
  - multi-select/grouping edge cases
  - longer undo/redo bursts after several mixed canvas operations

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
- Current grade: `9.3/10`
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
- Current grade: `9.4/10`
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
  - browser smoke now covers rich-text parity from seeded generated card -> edit dialog -> single generation -> bulk import -> populated gallery PNG export
  - browser smoke now covers direct Maker-authored selected text -> scoped inline variable -> toolbar bold/highlight/color -> save -> Single Generator -> generated preview parity
  - Maker rich-text toolbar now restores the active variable or last non-empty editor selection before applying formatting, preventing focus jumps into the inspector from silently dropping the intended selection
  - browser smoke now covers direct Maker-authored bullet list toolbar formatting -> save -> Single Generator -> generated preview as real list items
  - browser smoke now covers direct Maker-authored ordered list toolbar formatting -> save -> Single Generator -> generated preview as real ordered list items
  - Maker list serialization now converts hard-broken selected lines into separate saved list markers, matching the way users expect multi-line selected text to become a list
  - text fields now expose conservative capacity feedback based on source text box width, height, font size, line height, and minimum shrink-to-fit size
  - structured rows now expose row-pressure feedback so one row can show as comfortable while abuse cases such as `30` rows warn that they will likely overflow the text block
  - generated card previews now measure rendered text block fit from real DOM geometry and show a `Text clipping` badge when content actually overflows after layout
  - unit coverage defines text capacity estimates for base font size vs shrink-to-fit minimum, including character pressure and structured-row pressure
  - template contract typography is applied as render-layer CSS instead of nesting extra marker syntax, so bold/italic/color/highlight/list content stays parseable in generated previews and export capture
  - structured row fields now support template-owned row formatting and between-row rich text, with visual inspector controls for column font, size, weight, color, style, decoration, column divider text, and between-row text
  - edit-dialog save now preserves non-template card metadata such as `cardName`, keeping exported filenames meaningful after edits
- Findings:
  - variable rename still feels commit-based rather than truly live while typing, which is acceptable but not the most luxurious editing feel yet
- Still not fully closed:
  - rushed-editing and mixed-format edge cases in longer rules-style content
  - export preflight does not yet block or summarize measured clipping before long PDF/ZIP jobs
- Remaining focus:
  - longer multiline rules-text abuse pass
  - export/download parity for capacity warnings so users know before long PDF/ZIP jobs when text is likely to clip

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
  - edit/save round trips preserve extra card metadata instead of narrowing data down to template-only fields
  - Single Generator now supports optional per-card style overrides for non-image fields so users can tune font, size, weight, and color on one generated card without changing the template or bulk defaults
  - structured row fields now let Single Generator users add, remove, and reorder repeatable row/column content such as exits or options, while Maker controls define the row layout and sub-variable styling without raw token authoring
- Remaining focus:
  - rush-edit a partially completed card and confirm generated output still reflects the submitted field state
  - add bulk-specific structured row helpers, such as indexed columns or JSON examples

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
  - bulk smoke now includes rich-text markers, multiline rules blocks, and generated-gallery verification
  - bulk structured rows now support the documented indexed CSV pattern, such as `Exits[1].Position` and `Exits[1].Description`
  - example CSV and contract JSON now expose structured-row patterns instead of requiring users to reverse-engineer serialized row JSON
  - browser smoke now verifies indexed structured-row CSV input through bulk generation into the generated-card preview
  - live 1000-card bulk import generated a complex structured-row set from CSV with varied row counts of `0`, `1`, `2`, `3`, `5`, `8`, `13`, `21`, and `30` rows
  - the saved 1000-card set preserved all generated cards and structured row distributions; artifact size was about `2.1 MB`
  - Preview & Validation now reports the true total parsed CSV rows while clearly stating that only the first preview rows are rendered, which keeps large imports understandable without painting every row
  - bulk contract/help content is visible
  - strict-mode and advanced mapping behavior were already covered by smoke tests
  - malformed CSV rows now surface explicit blocking issues instead of staying actionable deep into the flow
  - duplicate CSV headers are now treated as blocking issues
  - generation stays disabled until structurally invalid CSV is corrected, even with strict mode off
  - valid CSV re-enables generation once structural issues are removed
- Remaining focus:
  - verify quick-fix and preview states more aggressively
  - run multiline and rich-text heavy bulk samples
  - extend bulk structured-row examples into downloadable sample fixtures if launch onboarding needs more hand-holding

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
  - browser smoke now downloads and inspects a real `pdf-lib` physical PDF:
    - filename uses the `print-duplex-sheets` mode slug
    - duplex template produces `2` pages
    - page geometry remains true US Letter at approximately `612 x 792 pt`
  - browser smoke now downloads and inspects a real zip.js physical ZIP:
    - archive filename is `cardforge-physical-print-card-faces.zip`
    - archive contains distinct `front` and `back` PNG entries
  - `SaveAsPdfButton.tsx` is now a thin UI wrapper over reusable `pdfExport` and pure `pdfExportLayout` modules
  - generated-card ZIP export is now behind reusable `zipExport` and pure `zipExportLayout` modules instead of being owned by `src/app/page.tsx`
  - browser file-download plumbing is centralized in `src/lib/browserDownload.ts`
  - live 1000-card / 2000-face physical ZIP export completed at `300 DPI` from a complex structured-row set:
    - output: `cardforge-physical-print-card-faces.zip`
    - entries: `2000` PNG files, front and back for each card
    - size: about `579 MB`
    - duration: about `22m 53s` in browser export
    - progress UI remained visible and counted faces throughout the job
  - export polish now preflights large jobs with estimated artifact size, duration class, dimensions, face counts, and missing-back warnings
  - worker-backed export foundation is implemented:
    - local job storage under `storage/export-jobs/`
    - create/status/download/cancel APIs
    - `npm run export:worker`
    - Sharp-backed server PNG rendering
    - zip.js physical ZIP assembly with front/back entries
    - pdf-lib PDF assembly using existing paper, spacing, cut-line, and duplex layout seams
  - focused unit coverage verifies worker preflight, job lifecycle, server PNG dimensions, and exact ZIP front/back manifest entries
- Remaining focus:
  - run the full worker-backed 1000-card / 2000-face certification and compare timing/file counts/dimensions against the old browser path before calling export launch-complete
  - compare worker-rendered output against `CardPreview`; the worker renderer is deterministic and server-safe, but still needs rich-text/appearance parity review before it can replace the browser fallback
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
- Confirm worker ZIP export processes queued jobs and produces downloadable artifacts.
- Confirm worker PDF export processes queued jobs and preserves selected paper/duplex settings.
- Confirm 1000-card / 2000-face worker export meets production-scale acceptance before public launch.

Status: `PASS FOR CORE APP, BLOCKED FOR PRODUCTION EXPORT CERTIFICATION`

Functional verification snapshot:

- Template editor keyboard flows: `PASS`
- Layer lock/visibility toggles: `PASS`
- Mobile navigation stress: `PASS`
- Mixed canvas transform undo/redo: `PASS`
- Freeform template creation flow: `PASS`
- Single-card generation: `PASS`
- Bulk generator strict-mode and advanced mapping flow: `PASS`
- Bulk structured-row indexed CSV flow: `PASS`
- Direct Maker-authored list parity: `PASS`
- Text/structured-row capacity pressure feedback: `PASS`
- `/api/styles` one-file-per-style read path: `PASS`
- `/api/assets` recursive texture/divider discovery: `PASS`
- Export surfaces present and wired: `PASS`
- Browser-level PDF/ZIP downloads inspectable as real files: `PASS`
- Deep launch checkpoint: `PASS` on `lint`, `typecheck`, full unit tests, production build, smoke, and a fresh isolated localhost mount across Maker, Generator, Bulk Import, and Export & Sets with no console/page errors.

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
