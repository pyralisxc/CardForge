# **App Name**: CardForge

## Core Features:

- Template Editor: Provide a user-friendly drag-and-drop interface to create card templates using various elements (text boxes, images, shapes).
- Template Management: Ability to save, load, and manage created templates.
- Bulk Card Generation: Input text to automatically generate multiple unique cards based on a selected template using the content as the variables in your card layout.
- Print/Export: Option to download or print cards directly from the application.
- Paper Size Selection: Support a wide range of standard paper sizes for printing (e.g., A4, US Letter, business card size).

## Style Guidelines:

- Primary color: Warm orange (#FF7043), reminiscent of creativity and craftsmanship.
- Background color: Light peach (#F9E7E1) to create a soft and inviting feel.
- Accent color: Muted teal (#4DB6AC) to complement the primary orange with a modern touch.
- Clean and readable font for the main text elements.
- Consistent and intuitive icon set for various functions (editing, saving, printing).
- Grid-based layout with clear visual hierarchy for easy navigation and template design.

---

## Current Architecture (Source of Truth)

> Last updated: May 2026. Keep this section current whenever the data model or storage strategy changes.

### Tech Stack
- **Framework**: Next.js 15+ (App Router), TypeScript strict
- **UI**: TailwindCSS + shadcn/ui (`src/components/ui/`)
- **State**: Zustand with `persist` middleware (localStorage, key `card-forge-app-storage-v3`, launch schema version 1)
- **Canvas**: Freeform pointer-based drag/resize in `CardTemplateMaker.tsx`
- **Library policy**: Prefer commercial-friendly, industry-standard libraries for generic editor infrastructure and keep custom code focused on CardForge-specific template, generation, and export behavior.
- **Template library direction**: Keep shipped defaults separate from user templates, with live previews generated from file-backed templates.

---

### Template Data Model

All templates are `TCGCardTemplate`. The data model is **freeform-only**: there is no `rows`, `columns`, or `layoutMode` field in the launch framework.

```ts
interface TCGCardTemplate {
  id: string | null;
  name: string;
  aspectRatio: string;          // e.g. "63:88"
  frameStyle: string;
  cardBorderWidth?: string;
  cardBorderStyle?: string;
  cardBorderRadius?: string;
  cardBorderColor?: string;
  cardBorderImageSource?: string;
  baseBackgroundColor?: string;
  baseTextColor?: string;
  cardBackgroundImageUrl?: string;
  defaultElementBorderColor?: string;
  appearance?: FreeformAppearance;
  freeformCanvas?: FreeformCanvas;  // Front face canvas
  backCanvas?: FreeformCanvas;      // Optional back face canvas
}
```

`FreeformCanvas` holds an array of `FreeformCardElement` items (type: `text | image | shape | icon`), each with absolute x/y/width/height/zIndex coordinates on a 630×880 default canvas.

---

### Inline Segment Variables

Text elements can now mix static copy with element-scoped inline variables.

- Inline variables belong to the text element they were authored inside unless intentionally reused elsewhere.
- The text element remains the parent structure for preview and export.
- Child variables are stored in `fieldContracts` with an `elementId` so generator, preview, and export preserve the parent/child relationship.
- Variable identity should come from the variable key. Selected fallback text remains sample/default content, not the field name.
- The visual rich text editor is the creator-facing source of truth for text authoring today. Static text and inline variable spans live in one editable flow, with formatting controls directly above the field.
- Field cards are generator settings, not a second styling surface. They expose identity, required state, and auto-fit for the parent/base field and child variables scoped to the selected text element.
- Tiptap powers the editor surface. The stored template string remains the serialization format for now, but users should not need to edit raw `{{Variable:"fallback"}}` syntax during normal authoring.
- Single-card entry and edit-card dialog both use the same grouped generator field UI. Parent/base text and child variables should not be rebuilt separately per surface.

### Preview and Export Truth

`CardPreview` is the visual source of truth for generated cards. The generated-card gallery, PNG export, ZIP export, and PDF export must all render through the same preview component rather than rebuilding the card in separate export-only code paths. Single-card entry intentionally does not keep a competing live preview; users create a generated card, then review/edit/export from the generated reference gallery. Rich text element rendering is centralized in `src/lib/cardTextRender.tsx` so the Maker canvas and preview/export path use the same segment, contract, and auto-fit behavior.

- Export rendering is centralized in `src/lib/cardPreviewExport.tsx`.
- Aspect and physical-size math is centralized in `src/lib/cardExportGeometry.ts`.
- The generator workspace is organized as task tabs: `Single`, `Bulk Import`, and `Export & Sets`. The generated reference gallery stays visible beside those tools so the output remains the constant review surface.
- Large generated sets use paged responsive browsing instead of unlimited grid expansion. Users choose cards per page, the grid adapts columns to available width, and the app renders only the active page.
- Duplex card support now starts from the same source-of-truth model:
  - `freeformCanvas` is the front face
  - `backCanvas` is the optional back face
  - maker editing keeps the front face primary and only creates `backCanvas` when the user explicitly adds a back face
  - new back faces should seed from the file-backed `default-obsidian-neon-card-back` template so teams start from an intentional reverse-side design instead of a blank canvas
  - maker editing can then switch between front and back
  - per-card export and ZIP export emit both faces when a back exists
  - physical PDF export supports two front/back layouts:
    - separate front/back sheets for duplex printing
    - front + back on the same sheet for review, hand cutting, or manual assembly
  - digital PDF export keeps faces in reading order for review/share workflows
- Physical print exports target at least 300 DPI. Physical ZIP export produces individual front/back card-face PNG files, while PDF export uses the selected paper size, margins, spacing, cut-line settings, and selected front/back layout.
- Browser exports are RGB. If a vendor requires CMYK, spot colors, bleed boxes, or PDF/X, the exported PNG/PDF should be converted in a prepress tool before production.
- Virtual/display exports target screen readability and warn when DPI is below 96. Digital ZIP export is intended as individual card images, not a cut-sheet workflow.
- Export flows should wait for React render, fonts, and images before capture so text variables, nested rich text, and uploaded assets survive the path from template to output.

### Template Storage Architecture

Templates have **two storage layers** that work together:

#### 1. `data/default-templates/*.json` — Default template library
- One JSON file per template, named by template ID (e.g. `default-arcane-spell-freeform.json`)
- Files here are the **seeded defaults** that ship with the app. New users get these on first load.
- Defaults are normal editable `TCGCardTemplate` files with `templateSource: "default"` while the launch library is still being authored.
- Defaults can include `templateOrder` for curated gallery ordering and `templatePreviewData` for non-destructive sample values used by previews and first-run generator data.
- Served by the Next.js API route at `src/app/api/templates/route.ts`.
- Do NOT put `layoutMode`, `rows`, or any other removed fields in these files.

#### 2. `data/user-templates/*.json` — User template library
- One JSON file per user-created, cloned, or saved template.
- User templates carry `templateSource: "user"`.
- This is the expected home for saved customer/user work.

Zustand keeps `defaultTemplates` and `userTemplates` separate, then exposes a derived combined list for Maker, Generator, previews, and exports. Persisted localStorage stores user-owned template work plus cards, styles, PDF options, and UI state.

#### Load flow on app start
1. Zustand rehydrates from localStorage (user's saved templates + cards)
2. `_rehydrateCallback` fires → fixes `singleCardGeneratorSelectedTemplateId` if its template was deleted
3. `page.tsx` `useEffect` fires → `GET /api/templates` → `setDefaultTemplatesFromFiles()` and `setUserTemplatesFromFiles()`

#### Save flow when user saves a template
1. `handleSaveTemplate` in `page.tsx` → default templates are saved as user-owned copies so shipped defaults stay clean
2. User templates continue through `addOrUpdateTemplate()` in the source-specific store collection
3. Immediately fires `POST /api/templates` to write the JSON file to the matching source folder

#### Delete flow
1. `handleConfirmDeleteTemplate` → `deleteTemplate()` in store
2. Immediately fires `DELETE /api/templates` to remove the file

---

### Key Source Files

| File | Purpose |
|------|---------|
| `src/store/appStore.ts` | Zustand store implementation — persisted state and actions |
| `src/store/selectors.ts` | Shared derived selectors for templates, generated cards, and edit state |
| `src/app/page.tsx` | Root page shell — orchestrates template/style load/save/delete and composes feature workspaces |
| `src/app/api/templates/route.ts` | REST API for `data/default-templates/` and `data/user-templates/` |
| `src/app/api/styles/route.ts` | REST API for one-style-per-file presets in `data/styles/` |
| `src/app/api/assets/route.ts` | Recursive asset discovery for textures and dividers plus optional metadata sidecars |
| `src/components/card-forge/CardTemplateMaker.tsx` | Freeform canvas template editor coordinator |
| `src/features/template-editor/components/` | Feature-local template editor panels and inspector tools |
| `src/features/card-generator/components/` | Generation workspace plus reusable bulk-generation surfaces |
| `src/components/card-forge/TemplateThumbnail.tsx` | Shared sidebar/gallery thumbnail renderer for file-backed templates |
| `src/components/card-forge/CardForgeRichTextEditor.tsx` | Shared Tiptap rich text editor and inline variable authoring surface |
| `src/components/card-forge/GeneratorFieldInput.tsx` | Shared generator/edit/bulk field input renderer |
| `src/components/card-forge/GeneratorFieldGroups.tsx` | Shared grouped parent/child field UI for single-card entry and edit dialog |
| `src/components/card-forge/CardPreview.tsx` | Renders a `TCGCardTemplate` + `CardData` to a visual card |
| `src/lib/cardTextRender.tsx` | Shared rich text element renderer for Maker canvas, generated previews, and export |
| `src/lib/freeformElementRender.ts` | Shared freeform element geometry, clipping, and image-source resolution helpers |
| `src/lib/cardPreviewExport.tsx` | Shared offscreen `CardPreview` renderer for PNG, ZIP, and PDF export |
| `src/lib/cardExportGeometry.ts` | Shared card aspect, pixel-height, and physical-size calculations |
| `src/lib/cardDataDefaults.ts` | Shared card-data initialization and fallback completion for generator/edit flows |
| `src/lib/textElementContracts.ts` | Shared text element contract, content-model, and auto-fit decisions for Maker and preview |
| `src/components/card-forge/makerConstants.tsx` | Presets, kits, theme tokens, maker helper UI, `makeNewFreeformTemplate()` |
| `src/lib/templateModel.ts` | Shared template reconstruction and freeform canvas defaults |
| `src/lib/constants.ts` | Shared option arrays (`FONT_WEIGHTS`, `PAPER_SIZES`, etc.) |
| `src/lib/appearance.ts` | Appearance system — material, border, texture |
| `src/types/index.ts` | All TypeScript types |
| `data/default-templates/` | Default template JSON files (ship with the app) |
| `data/user-templates/` | User-created or cloned template JSON files |
| `data/styles/` | One JSON file per appearance style preset |
| `data/assets/textures/` | Optional metadata sidecars for discovered textures |
| `data/assets/dividers/` | Optional metadata sidecars for discovered dividers |
| `public/card-assets/textures/` | Browser-served texture assets discovered recursively |
| `public/card-assets/dividers/` | Browser-served divider assets discovered recursively |

---

### Maintainability Snapshot

The repo is intentionally organized around a small number of feature boundaries:

- `src/features/template-editor/components`
  Deep reusable editor tools used by the Card Template Maker
- `src/features/card-generator/components`
  Generator workspace and bulk-generation tool surfaces
- `src/lib/`
  Shared model, rendering, export, and data-shaping helpers
- `src/store/`
  Persisted state plus derived selectors

These files are still intentionally large:

- `src/components/card-forge/CardTemplateMaker.tsx`
  Editor orchestration, canvas state, pointer/depth-selection logic, history, and feature-panel composition. Do not split just for line count; the next good seam is an editor-state/action controller or a future canvas library adapter.
- `src/components/card-forge/makerConstants.tsx`
  Presets, kits, and remaining maker helper UI
- `src/components/card-forge/CardPreview.tsx`
  Shared visual renderer for generated cards and export capture. Keep preview behavior centralized here unless a future renderer abstraction replaces it.
- `src/store/appStore.ts`
  Persisted app state and actions

Future library swaps should happen at clear seams rather than through broad rewrites:

- template editor canvas internals: `CardTemplateMaker.tsx`, `src/lib/freeformEditor.ts`, `src/lib/templateModel.ts`
- rich text authoring and rendering internals: `CardForgeRichTextEditor.tsx`, `src/lib/cardTextRender.tsx`, `src/lib/richTextDocument.ts`
- bulk generation workflow internals: `BulkGenerator.tsx`, `src/lib/bulkGeneration.ts`, `src/features/card-generator/components/`
- export pipeline internals: `CardPreview.tsx`, `src/lib/cardPreviewExport.tsx`, `src/lib/cardExportGeometry.ts`, `SaveAsPdfButton.tsx`

---

### Style and Asset Discovery

#### Styles

- Styles are stored as individual JSON files in `data/styles/`.
- `src/app/api/styles/route.ts` reads every valid `*.json` file in that directory and returns them as the style library payload.
- The launch build does not carry the removed `appearance-library.json` prototype path; new presets should be added as individual files.

#### Textures and Dividers

- `src/app/api/assets/route.ts` recursively scans:
  - `public/card-assets/textures/**/*.{svg,png,jpg,jpeg,webp}`
  - `public/card-assets/dividers/**/*.{svg,png,jpg,jpeg,webp}`
- New files placed in those directories are available to the app automatically without a code change.
- Optional metadata overrides are read from matching JSON sidecars in:
  - `data/assets/textures/**/*.json`
  - `data/assets/dividers/**/*.json`
- Sidecars can override auto-derived values such as `id`, `name`, `tileMode`, `seamless`, `allowedTargets`, `defaultBlendMode`, `defaultOpacity`, and `defaultScale`.

#### Storage Boundary

- Keep `data/` and `public/` physically separate.
- `data/` is the content and metadata layer consumed by server routes.
- `public/` is the static asset layer exposed to the browser.

#### Shipped Inventory

The launch inventory should stay small and intentional:

- `data/default-templates/`: six shipped templates, including one optional back preset (`default-obsidian-neon-card-back.json`)
- `data/styles/`: six one-file style presets
- `data/assets/`: two metadata sidecars today (`textures/parchment-grain.json`, `dividers/gem-center.json`)
- `data/user-templates/`: `.gitkeep` only before release; user-created JSON files should not be committed accidentally
- `public/card-assets/textures/`: eight shipped SVG textures
- `public/card-assets/dividers/`: six shipped SVG dividers

Generated QA artifacts, smoke outputs, local logs, and `tests/examples/` are intentionally ignored. Recreate them during QA; do not ship them as repo assets.

---

### Launch Persist Schema

CardForge ships against the current freeform schema only. The launch build should not carry migration adapters for removed prototype fields; when the model changes before launch, update the stored schema, default JSON, tests, and docs together.

Persisted keys:
- `userTemplates`
- `appearanceStyles`
- `storedCards`
- `selectedPaperSize`
- `activeTab`
- `richTextHighlightColor`
- `singleCardGeneratorSelectedTemplateId`
- `pdfMarginMm`
- `pdfCardSpacingMm`
- `pdfIncludeCutLines`
- `exportMode`
- `exportDpi`

---

### Unsupported Patterns

These patterns are outside the launch framework and must not be reintroduced:
- Section/row template composition. Use `FreeformCardElement` on `FreeformCanvas`.
- Template `layoutMode` or `rows` fields. All templates are freeform.
- Hardcoded default-template arrays. Use `data/default-templates/*.json` through the template API.
- Hardcoded texture or divider registries as the only discovery source. Use the asset discovery route and optional sidecar metadata.
- Separate section or column editors. The template-editor feature owns the freeform maker workflow.

---

## Product Expectations (Locked)

CardForge is expected to be a universal Canva-like template creator for cards with easy single and bulk generation and reliable print/export output.

The expected user experience:
- Deep visual customization without technical friction.
- Text and image variables that are easy to define and reuse.
- Specialized text zones (abilities, flavor text, subtitles) that support controlled formatting.
- Native-feel editing interactions (toolbar + keyboard + right-click context actions).
- Clear bulk documentation and guided CSV workflows.

---

## Core Design Truths

These are non-negotiable principles for roadmap and implementation decisions.

1. Template is structure, data is payload.
- Templates define zones, styling, and variable bindings.
- Single and bulk generators provide values only.

2. Variables are first-class contracts.
- Every variable should have explicit metadata: type, required, default, validation, formatting allowances, and examples.
- The same contract must drive Maker, Single, Bulk, and export behavior.

3. One formatting language everywhere.
- Rich text behavior must be consistent across Maker preview, single entry, bulk preview, and final export.
- If entry is markup-driven, users still need a live formatted surface nearby.

4. Bulk is a production pipeline.
- Bulk flow must be deterministic, inspectable, and self-documenting.
- Mapping, validation, and recovery are core product functionality.

5. Print trust is a product promise.
- Users should see quality and preflight issues before final export.

6. Power should feel easy.
- Advanced controls should be available without overloading first-run users.
- Progressive disclosure is required.

### Editing and Contract Direction

- Inline rich text variables belong to the text element where they were authored unless intentionally reused elsewhere.
- Variable identity comes from the variable key; fallback text is sample content, not the field name.
- Parent text context should stay visible when editing child variables.
- Generator field cards are settings and contract controls, not a second styling surface.
- Rich text behavior should stay aligned across Maker, Single, Bulk, preview, and export.
- Overlapping canvas elements should support intentional deep selection without forcing constant layer-tree detours.
- Grouped parent/child behavior must follow professional editor expectations:
  - moving a parent moves its children
  - resizing a transform parent scales/repositions children proportionally
  - selection between parent and child remains understandable in both canvas and layer tree

---

## Growth Areas (Quality-Complete Focus)

### Publish Cleanup Baseline

Completed cleanup work in the current consolidation phase:

- Reduced the repo to a smaller core doc set: `README.md`, `docs/blueprint.md`, and `docs/release-checklist.md`.
- Split appearance styles into one-file-per-style storage under `data/styles/`.
- Added recursive texture and divider discovery through `/api/assets`.
- Added optional asset metadata sidecars under `data/assets/textures/` and `data/assets/dividers/`.
- Reorganized major UI surfaces into clearer feature boundaries for the template editor and generator flows.
- Verified core app stability with lint, typecheck, unit tests, smoke tests, and browser workflow abuse testing.

Quality gates to keep watching:

- Continue validating accidental double-submit protection in single-card generation. Repeated `Create Generated Card` clicks should add only one card per action.
- Tighten bulk CSV gating so obviously malformed data cannot proceed as far into generation.
- Reduce ambiguous repeated control names where that improves clarity and lowers automation/test fragility.
- Re-run export-focused browser QA after the next generator/input polish pass.

Rich text and variable editing still need a dedicated deep verification pass. Current browser QA covered general workflow stability, selection/deselection, generator entry, and bulk generation pressure, but it did **not** fully validate:

- creating inline variables from selected text
- deleting or renaming inline variables
- editing rich text formatting across mixed static and variable content
- confirming seamless preview updates in Maker, Single, Bulk, and generated card output
- confirming generator fields preserve authored template rich text while remaining easy to edit intentionally

That deep pass should be treated as a first-class QA milestone before calling text authoring fully polished.

### 1. Field Contract System (Highest Priority)
- Move from inferred placeholders to explicit field contracts.
- Add `FieldContract v1` metadata for each variable:
  - key
  - type (`text | richText | image | number`)
  - required
  - default
  - multiline
  - maxLength
  - allowedFormatting
  - description
  - example

Why this matters:
- Eliminates ambiguity.
- Aligns single and bulk behavior.
- Improves validation and error clarity.

### 2. Rich Text Maturity
- Keep the current marker system, but formalize support by field type.
- Add a shared command layer for formatting operations.
- Support native-feel text interactions including right-click context actions.
- Short-term display target:
  - markup entry surface,
  - live formatted preview,
  - parent composed preview for segmented text elements.
- Long-term target:
  - tokenized inline editor in visual mode so users see chips/segments rather than raw placeholder syntax.

Why this matters:
- Reduces learning friction.
- Improves confidence in advanced text workflows.

### 3. Bulk Contract and Documentation UX
- Add a first-class Bulk Contract panel showing:
  - required fields
  - supported formats
  - multiline quoting examples
  - rich text examples
- Allow download of example CSV and machine-readable contract JSON.

Why this matters:
- Faster onboarding for bulk users.
- Fewer CSV/mapping failures.

### 4. Template Maker Maintainability
- Break up `CardTemplateMaker.tsx` into focused modules:
  - canvas interaction
  - inspector state
  - layer tree operations
  - text editing commands
  - presets and assets

Additional trust-critical editor work:
- overlap selection depth behavior is now implemented through repeated-click depth cycling on overlapping canvas targets
- parent/child transform semantics now treat grouped parents as transform groups:
  - dragging a grouped parent carries its children with it
  - resizing a grouped parent scales and repositions children proportionally
- grouped-layer visibility and reselection clarity should continue improving, but grouped parents now present more clearly in the layer tree

Why this matters:
- Lowers feature risk.
- Speeds future iteration.

### 5. Quality and Accessibility Gates
- Add parity tests for rich text rendering across surfaces.
- Add keyboard and accessibility smoke tests for core workflows.
- Add regression tests for mapping and strict-mode behavior.

Why this matters:
- Prevents cross-surface drift.
- Protects product trust as features expand.

---

## Definition of Quality Complete

CardForge reaches quality-complete for this phase when all criteria below are met:

1. Contract clarity
- 100% of generated input fields are backed by explicit variable contracts (not inference-only).

2. Rich text consistency
- The same formatted input renders identically in Maker preview, single generator, bulk preview, and export output.

3. Native editing confidence
- Core text actions are available via toolbar, keyboard shortcut, and context menu.

3a. Editor interaction trust
- Overlapping elements can be intentionally selected at different depth levels.
- Group transforms behave consistently and match visible editor affordances.
- Parent and child layers remain understandable during selection, movement, and resizing.
- Selecting an element should return keyboard focus to the canvas so arrow-key transforms remain reliable after layer-tree and inspector interactions.

4. Bulk success rate
- A first-time user can complete a valid bulk generation workflow in under 5 minutes using in-app guidance.

5. Failure recoverability
- Blocking validation errors always provide actionable next steps.

6. Accessibility baseline
- Core workflows are keyboard-completable and meet WCAG 2.1 AA targets for the primary UI surfaces.

---

## Delivery Sequence (Recommended)

1. Field Contract v1 and validation hardening.
2. Shared rich text command layer and right-click support.
3. Bulk contract docs panel and downloadable schema assets.
4. Maker modular refactor for maintainability.
5. Ongoing parity, accessibility, and performance hardening.

### Next QA Pass

The highest-value next manual/browser QA pass should focus on rich text and variable authoring end to end:

1. Create a new text element and author mixed static text plus inline variables.
2. Apply bold, italic, underline, highlight, list, and text-color changes.
3. Rename, delete, and recreate variables to verify contract stability.
4. Confirm live changes in Maker preview with no stale inspector or generator state.
5. Open the same template in Single Card Entry and verify grouped fields preserve the authored rich text structure.
6. Run a bulk example that exercises rich text, multiline values, and rules blocks.
7. Confirm generated card previews and export-facing renderers match the authored formatting.

### Library Selection Guidance

When adopting new libraries, prefer options that are:

- actively maintained
- commercially safe and permissively licensed where possible
- deep enough to replace a whole category of custom infrastructure
- stable in Next.js, React, TypeScript, and browser export workflows

Use libraries for generic infrastructure such as rich text editing, drag/resize/ordering, CSV parsing, runtime validation, and export packaging. Keep CardForge-owned code focused on template semantics, field contracts, preview truth, and print/export behavior.

### Future Entry Architecture

The current app still opens directly into the main CardForge workspace, which means local development cold-start cost is shaped heavily by the editor and generator compile graph.

Planned later-phase architecture:

- move the primary app entry toward a landing page and authenticated user flow
- introduce user profiles and user-owned workspace context
- defer the heavy editor workspace until the user intentionally enters it

This is not part of the current release gate.

Do this only after:

- the current release checklist is complete
- current functionality is fully stabilized
- any chosen refactor toward stronger commercial-safe open source libraries is complete enough to avoid redoing the entry architecture twice

Until then, treat the current cold dev-load cost primarily as a developer-experience concern, not a blocker for the present product release.

---

## Short-Term Pivot Decision

Do not pivot away from the current architecture.

Do pivot execution focus toward:
- contract-first variable design,
- native-feel editing interactions,
- bulk documentation and recovery UX,
- cross-surface consistency and quality gates.

This preserves the product's strongest foundation while directly addressing the highest-impact experience gaps.
