# Frame Kit Parts Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a human-expandable premium parts catalog while keeping full-card backgrounds as template support.

**Architecture:** Extend the existing file-backed asset discovery route from textures/dividers to include premium parts. Represent parts with the same asset option model plus role and default sizing metadata, then surface them in Layout Studio as insertable image elements.

**Tech Stack:** Next.js App Router, TypeScript, Zod validation, Vitest, Playwright smoke tests, Sharp for local asset preparation.

---

### Task 1: Asset Model And Discovery

**Files:**
- Modify: `src/lib/cardAssets.ts`
- Modify: `src/lib/apiValidation.ts`
- Modify: `src/app/api/assets/route.ts`
- Modify: `src/lib/clientBootstrapData.ts`
- Test: `tests/unit/api-validation.test.ts`

- [ ] Add `part` to the asset kind model.
- [ ] Add optional `partRole`, `defaultWidth`, and `defaultHeight` metadata.
- [ ] Discover `public/card-assets/parts/**/*.{svg,png,jpg,jpeg,webp}` with matching sidecars under `data/assets/parts/`.
- [ ] Return `{ textures, dividers, parts }` from `/api/assets`.
- [ ] Add tests that validate premium part sidecars.

### Task 2: Parts Folder Scaffold

**Files:**
- Create: `public/card-assets/parts/.gitkeep`
- Create: `data/assets/parts/.gitkeep`
- Test: `tests/unit/frame-kits.test.ts`

- [ ] Keep the parts folders available in git without shipping generated placeholder art.
- [ ] Test catalog helper behavior with synthetic assets rather than generated shipped files.

### Task 3: Layout Studio Parts Insertion

**Files:**
- Modify: `src/features/template-editor/hooks/useTemplateAssetLibrary.ts`
- Modify: `src/features/template-editor/components/ElementLibraryPanel.tsx`
- Modify: `src/components/card-forge/CardTemplateMaker.tsx`
- Test: `tests/unit/frame-kits.test.ts`

- [ ] Load discovered parts through the existing bootstrap asset hook.
- [ ] Add a `Premium Parts` section to the element library.
- [ ] Insert parts as image elements with `object-fit: contain`, transparent background, and metadata-driven default size.
- [ ] Preserve drag-to-canvas support by serializing dynamic presets through drag data.

### Task 4: Docs And Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/blueprint.md`
- Modify: `docs/release-checklist.md`

- [ ] Document the human-addable folder convention.
- [ ] Document that full backgrounds remain supported as template/background options.
- [ ] Run `npm run test`, `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run smoke`.
