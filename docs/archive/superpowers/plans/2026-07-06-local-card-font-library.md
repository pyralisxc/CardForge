# Local Card Font Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace runtime Google Font fetching with a local CardForge font registry and expand available card fonts in the editor, preview, generator, and variable typography controls.

**Architecture:** Font choices are owned by one registry in `src/lib/cardFonts.ts`. App shell font variables and card font classes are declared locally in `src/app/globals.css`, Tailwind maps the same class names, and render helpers resolve font ids through the registry instead of hard-coded `if` chains.

**Tech Stack:** Next.js App Router, Tailwind CSS, TypeScript, local static font files under `public/fonts`, Vitest.

## Global Constraints

- Do not fetch fonts from Google at app runtime or build time.
- Keep existing font ids working: `font-sans`, `font-serif`, `font-mono`, `font-cinzel`, `font-lato`, `font-trajan`, `font-book`, `font-humanist`, `font-condensed`, `font-engraved`.
- Add locally hosted card-focused families with license notes.
- Keep `AVAILABLE_FONTS` as the public selector interface used by current editor components.
- Verify with unit tests, typecheck, lint, and a browser load when possible.

---

### Task 1: Add Local Font Assets And Registry

**Files:**
- Create: `public/fonts/README.md`
- Create: `src/lib/cardFonts.ts`
- Modify: `src/lib/constants.ts`

**Interfaces:**
- Produces: `CARD_FONT_OPTIONS`, `CARD_FONT_STACKS`, `cardFontFamilyToCss(fontFamily?: string)`, and `AVAILABLE_FONTS`.

- [ ] **Step 1: Download local OFL font files**

Download a curated set into `public/fonts/<family>/`. Use only families with open font licenses and include a README naming source and license.

- [ ] **Step 2: Create registry**

`src/lib/cardFonts.ts` exports:

```ts
export type CardFontOption = {
  name: string;
  value: string;
  category: 'System' | 'Fantasy' | 'Classic' | 'Sci-Fi' | 'Utility';
  cssFamily: string;
};
```

- [ ] **Step 3: Re-export selector options**

Move `AVAILABLE_FONTS` in `src/lib/constants.ts` to:

```ts
export { AVAILABLE_FONTS } from '@/lib/cardFonts';
```

### Task 2: Remove Next Google Font Fetching

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`
- Modify: `tailwind.config.ts`

**Interfaces:**
- Consumes: local font files and registry ids.
- Produces: Tailwind classes such as `font-cinzel`, `font-lato`, `font-cormorant`, `font-uncial`, `font-rajdhani`, and `font-orbitron`.

- [ ] **Step 1: Remove `next/font/google` imports**

Delete `Geist`, `Geist_Mono`, `Cinzel`, and `Lato` imports and remove generated font variables from `<body>`.

- [ ] **Step 2: Add `@font-face` declarations**

Declare local app shell and card fonts in `globals.css` with stable family names like `CardForge UI`, `CardForge Cinzel`, and `CardForge Orbitron`.

- [ ] **Step 3: Update Tailwind font families**

Map each `font-*` class to the local family and fallbacks.

### Task 3: Wire Renderer And Tests

**Files:**
- Modify: `src/lib/cardTextRender.tsx`
- Modify: `tests/unit/field-style-overrides.test.ts`
- Create: `tests/unit/card-fonts.test.ts`

**Interfaces:**
- Consumes: `cardFontFamilyToCss`.
- Produces: variable typography and card rendering use the same registry.

- [ ] **Step 1: Replace hard-coded renderer mapping**

Use `cardFontFamilyToCss(fontFamily)` inside `buildContractSegmentStyle`.

- [ ] **Step 2: Add registry tests**

Assert existing ids still resolve and new ids are present in `AVAILABLE_FONTS`.

- [ ] **Step 3: Run verification**

Run:

```powershell
node .\node_modules\vitest\vitest.mjs run
.\node_modules\.bin\next.CMD typegen
.\node_modules\.bin\tsc.CMD --noEmit
.\node_modules\.bin\eslint.CMD .
git diff --check
```
