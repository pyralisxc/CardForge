# **App Name**: CardForge

## Core Features:

- Template Editor: Provide a user-friendly drag-and-drop interface to create card templates using various elements (text boxes, images, shapes).
- Template Management: Ability to save, load, and manage created templates.
- Bulk Card Generation: Input text to automatically generate multiple unique cards based on a selected template using the content as the variables in your card layout.
- Print/Export: Option to download or print cards directly from the application.
- AI Design Assistance: Offer AI-powered design suggestions for card layouts based on the input content.
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
- **Framework**: Next.js 14+ (App Router), TypeScript strict
- **UI**: TailwindCSS + shadcn/ui (`src/components/ui/`)
- **State**: Zustand with `persist` middleware (localStorage, key `card-forge-app-storage-v2`, schema version 4)
- **Canvas**: Freeform pointer-based drag/resize in `CardTemplateMaker2.tsx`

---

### Template Data Model

All templates are `TCGCardTemplate`. The data model is **freeform-only** — there is no `rows`, `columns`, or `layoutMode` field. Those were legacy and have been fully removed.

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
  defaultSectionBorderColor?: string;
  appearance?: FreeformAppearance;
  freeformCanvas?: FreeformCanvas;  // The only layout system
}
```

`FreeformCanvas` holds an array of `FreeformCardElement` items (type: `text | image | shape | icon`), each with absolute x/y/width/height/zIndex coordinates on a 630×880 default canvas.

---

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
| `src/store/appStore.ts` | Zustand store — all state, actions, persist config, migrations |
| `src/app/page.tsx` | Root page — orchestrates template/style load/save/delete |
| `src/app/api/templates/route.ts` | REST API for `data/templates/` directory |
| `src/app/api/styles/route.ts` | REST API for `data/styles/` directory |
| `src/components/card-forge/CardTemplateMaker2.tsx` | Freeform canvas template editor (~131KB) |
| `src/components/card-forge/CardPreview.tsx` | Renders a `TCGCardTemplate` + `CardData` to a visual card |
| `src/components/card-forge/makerConstants.tsx` | Presets, kits, RichText components, `makeNewFreeformTemplate()` |
| `src/lib/constants.ts` | Shared option arrays (`FONT_WEIGHTS`, `PAPER_SIZES`, etc.) |
| `src/lib/appearance.ts` | Appearance system — material, border, texture |
| `src/types/index.ts` | All TypeScript types |
| `data/templates/` | Default template JSON files (ship with the app) |
| `data/styles/` | Default appearance style library JSON |

---

### Persist Schema Version History

| Version | Change |
|---------|--------|
| 1 | Initial schema |
| 2 | Added `storedCards` |
| 3 | Normalised `frontTemplateId` → `templateId` in stored cards |
| 4 | Removed `hasSeededDefaultTemplates` — seeding replaced by `data/templates/` API load |

---

### Dead Code — Do Not Re-introduce

These patterns were removed and must not come back:
- `CardSection` / `CardRow` interfaces — replaced by `FreeformCardElement`
- `layoutMode` field on templates — all templates are freeform
- `rows: CardRow[]` field on templates
- `DEFAULT_TEMPLATES_DATA` hardcoded in-memory array — use `data/templates/*.json` instead
- `getDefaultTemplates()` / `hasSeededDefaultTemplates` — seeding is now done via the API fetch on mount
- `createDefaultSection()` / `createDefaultRow()` — removed from `constants.ts`
- `SectionStylingForm.tsx` / `ColumnEditor.tsx` / `TemplateEditor.tsx` — deleted; replaced by `CardTemplateMaker2.tsx`
