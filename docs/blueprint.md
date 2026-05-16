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
- **State**: Zustand with `persist` middleware (localStorage, key `card-forge-app-storage-v2`, launch schema version 1)
- **Canvas**: Freeform pointer-based drag/resize in `CardTemplateMaker2.tsx`

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
  freeformCanvas?: FreeformCanvas;  // The only layout system
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

`CardPreview` is the visual source of truth for generated cards. On-screen preview, PNG export, ZIP export, and PDF export must all render through the same preview component rather than rebuilding the card in separate export-only code paths.

- Export rendering is centralized in `src/lib/cardPreviewExport.tsx`.
- Aspect and physical-size math is centralized in `src/lib/cardExportGeometry.ts`.
- Physical print exports target at least 300 DPI and keep browser output as RGB PNG/PDF canvas data. If a vendor requires CMYK or PDF/X, the exported asset should be converted in a prepress tool.
- Virtual/display exports target screen readability and warn when DPI is below 96.
- Export flows should wait for React render, fonts, and images before capture so text variables, nested rich text, and uploaded assets survive the path from template to output.

### Template Storage Architecture

Templates have **two storage layers** that work together:

#### 1. `data/templates/*.json` — Disk library (authoritative source for defaults)
- One JSON file per template, named by template ID (e.g. `default-arcane-spell-freeform.json`)
- Served read/write by the Next.js API route at `src/app/api/templates/route.ts`
  - `GET /api/templates` — returns all templates in the directory
  - `POST /api/templates` — writes or overwrites a single template file
  - `DELETE /api/templates` — removes a template file
- Files here are the **seeded defaults** that ship with the app. New users get these on first load.
- Do NOT put `layoutMode`, `rows`, or any other removed fields in these files.

#### 2. Zustand persist (localStorage) — User's working set
- Persisted via `partialize` in `useAppStore` — stores: `templates`, `appearanceStyles`, `storedCards`, PDF options, UI state
- Templates from disk are merged into this store on every app mount (see flow below)
- Takes precedence for user-created or user-modified templates (store wins on ID collision with merge)

#### Load flow on app start
1. Zustand rehydrates from localStorage (user's saved templates + cards)
2. `_rehydrateCallback` fires → fixes `singleCardGeneratorSelectedTemplateId` if its template was deleted
3. `page.tsx` `useEffect` fires → `GET /api/templates` → `mergeTemplatesFromFiles()` upserts file-backed templates into the store (file version wins on ID collision to keep defaults fresh)

#### Save flow when user saves a template
1. `handleSaveTemplate` in `page.tsx` → `addOrUpdateTemplate()` in store (localStorage)
2. Immediately fires `POST /api/templates` to write the JSON file to disk
3. Both layers are always in sync after a save

#### Delete flow
1. `handleConfirmDeleteTemplate` → `deleteTemplate()` in store
2. Immediately fires `DELETE /api/templates` to remove the file

---

### Key Source Files

| File | Purpose |
|------|---------|
| `src/store/appStore.ts` | Zustand store — all state, actions, and persist config |
| `src/app/page.tsx` | Root page — orchestrates template/style load/save/delete |
| `src/app/api/templates/route.ts` | REST API for `data/templates/` directory |
| `src/app/api/styles/route.ts` | REST API for `data/styles/` directory |
| `src/components/card-forge/CardTemplateMaker2.tsx` | Freeform canvas template editor (~131KB) |
| `src/components/card-forge/CardForgeRichTextEditor.tsx` | Shared Tiptap rich text editor and inline variable authoring surface |
| `src/components/card-forge/GeneratorFieldInput.tsx` | Shared generator/edit/bulk field input renderer |
| `src/components/card-forge/GeneratorFieldGroups.tsx` | Shared grouped parent/child field UI for single-card entry and edit dialog |
| `src/components/card-forge/CardPreview.tsx` | Renders a `TCGCardTemplate` + `CardData` to a visual card |
| `src/lib/cardPreviewExport.tsx` | Shared offscreen `CardPreview` renderer for PNG, ZIP, and PDF export |
| `src/lib/cardExportGeometry.ts` | Shared card aspect, pixel-height, and physical-size calculations |
| `src/lib/cardDataDefaults.ts` | Shared card-data initialization and fallback completion for generator/edit flows |
| `src/lib/textElementContracts.ts` | Shared text element contract, content-model, and auto-fit decisions for Maker and preview |
| `src/components/card-forge/makerConstants.tsx` | Presets, kits, RichText components, `makeNewFreeformTemplate()` |
| `src/lib/constants.ts` | Shared option arrays (`FONT_WEIGHTS`, `PAPER_SIZES`, etc.) |
| `src/lib/appearance.ts` | Appearance system — material, border, texture |
| `src/types/index.ts` | All TypeScript types |
| `data/templates/` | Default template JSON files (ship with the app) |
| `data/styles/` | Default appearance style library JSON |

---

### Launch Persist Schema

CardForge ships against the current freeform schema only. The launch build should not carry migration adapters for removed prototype fields; when the model changes before launch, update the stored schema, default JSON, tests, and docs together.

Persisted keys:
- `templates`
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
- Hardcoded default-template arrays. Use `data/templates/*.json` through the template API.
- Separate section or column editors. `CardTemplateMaker2.tsx` owns the freeform maker workflow.

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

---

## Growth Areas (Quality-Complete Focus)

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
- Break up `CardTemplateMaker2.tsx` into focused modules:
  - canvas interaction
  - inspector state
  - layer tree operations
  - text editing commands
  - presets and assets

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

---

## Short-Term Pivot Decision

Do not pivot away from the current architecture.

Do pivot execution focus toward:
- contract-first variable design,
- native-feel editing interactions,
- bulk documentation and recovery UX,
- cross-surface consistency and quality gates.

This preserves the product's strongest foundation while directly addressing the highest-impact experience gaps.
