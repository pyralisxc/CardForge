# Card Rendering Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish Card Rendering as the single browser presentation owner, move pure rendering calculations into Domain, remove the root card component locations, and eliminate the Template Editor ↔ Card Generator dependency cycle without changing card appearance, watermark policy, or clean exports.

**Architecture:** Pure card faces, geometry, bindings, row values, field/image overrides, text contracts, font mapping, shape definitions, paper sizes, and aspect-ratio rules live under `domain/rendering`. Element capability policy lives under `domain/templates`. React preview, rich-text, watermark, thumbnail, shape, appearance-style, and rich-text-document code lives under `features/card-rendering` and is exposed only through `client.ts`. Clean PNG/canvas export remains owned by Card Generator. Card Rendering does not import Card Generator, Template Editor, Project, or the root store.

**Tech Stack:** Next.js 15, React 18, TypeScript 5, Zustand, Vitest 4, Playwright, html-to-image.

## Global Constraints

- Preserve generated card pixels, text/rich-text semantics, font mapping, image overrides, structured rows, front/back behavior, watermark opacity/placement, and clean-export separation.
- Preserve serialized template/card/project field names and values.
- Do not leave deprecated re-exports or compatibility aliases at old component, feature, or `src/lib` paths.
- Other features may consume Card Rendering only through `@/features/card-rendering/client`.
- Card Rendering must not read Zustand or import another product feature.
- Pure Domain rendering modules must not import React, Next.js, provider SDKs, features, infrastructure, or legacy roots.
- Update the architecture baseline only after stale resolved entries are the checker’s only failure.

---

### Task 1: Define ownership and independence as a failing contract

**Files:**
- Create: `tests/unit/card-rendering-ownership.test.ts`
- Modify later: `tests/unit/repository-maintenance.test.ts`

- [x] **Step 1: Write the failing ownership test**

Assert that:

- `src/features/card-rendering/client.ts` and its owned component/model paths exist;
- retired `src/components/card-forge` card files and their old rendering helpers do not exist;
- Card Rendering never imports Card Generator, Template Editor, Project, or `src/store`;
- `CardPreview` does not import `useAppStore` and accepts highlight color as data;
- cross-feature Card Rendering imports use `@/features/card-rendering/client` rather than internals;
- pure Domain rendering files do not import React, Next.js, product features, infrastructure, or legacy roots.

- [x] **Step 2: Run the focused test and verify RED**

```bash
npm test -- tests/unit/card-rendering-ownership.test.ts
```

Expected: FAIL because the public feature and target modules do not exist and old locations remain.

- [x] **Step 3: Commit the failing contract**

```bash
git add tests/unit/card-rendering-ownership.test.ts
git commit -m "test: define card rendering ownership"
```

### Task 2: Move pure rendering rules into Domain

**Files:**
- Add focused modules under `src/domain/rendering/`
- Add: `src/domain/templates/elementCapabilities.ts`
- Modify: domain entry points and all consumers
- Delete the corresponding old feature/root helper files

- [x] **Step 1: Move pure rendering modules**

Move without changing behavior:

```text
card faces/backing
preview and export geometry
paper sizes and TCG aspect ratio
text bindings
structured rows
field style overrides
image field overrides
text element contracts
card font catalogs and mapping
vector shape definitions
```

- [x] **Step 2: Move template element capability policy**

Move element capability/divider/shape primitive policy to `domain/templates` and export it through that domain entry point.

- [x] **Step 3: Update consumers by owning public domain entry point**

Use `@/domain/rendering` and `@/domain/templates`; do not create a root domain barrel or old-path alias.

- [x] **Step 4: Run focused model tests and typecheck**

```bash
npm test -- tests/unit/text-bindings.test.ts tests/unit/image-field-overrides.test.ts tests/unit/card-fonts.test.ts tests/unit/card-preview-export.test.ts
npm run typecheck
```

### Task 3: Establish the Card Rendering feature

**Files:**
- Create: `src/features/card-rendering/client.ts`
- Create owned `components/` and `model/` modules
- Move/delete root card components and rendering presentation helpers
- Modify all feature consumers

- [x] **Step 1: Move presentation components**

Move Card Preview, Card Text Content, rich-text presentation/editor, watermark overlay, Template Thumbnail, and Vector Shape Element into Card Rendering.

- [x] **Step 2: Move browser rendering models**

Move appearance-to-style, element CSS/image resolution, rich-text-document conversion, and visible watermark policy into Card Rendering models.

- [x] **Step 3: Decouple preview from workspace state**

Replace the hidden `useAppStore` read with an explicit `highlightColor` prop and pass the current workspace value through Studio composition. Keep the existing default for non-Studio previews and preserve the current value for clean exports.

- [x] **Step 4: Publish the browser-safe interface**

Export only supported Card Rendering components and browser models from `client.ts`. Update Template Editor, Card Generator, Developer Assets, App Shell, and tests to use this interface.

- [x] **Step 5: Keep clean export in Card Generator**

Move the offscreen PNG/canvas renderer to Card Generator. It consumes Card Rendering but Card Rendering never imports export workflow code or entitlement policy.

- [x] **Step 6: Run rendering and watermark tests**

```bash
npm test -- tests/unit/card-rendering-ownership.test.ts tests/unit/text-tools.test.ts tests/unit/rich-text-document.test.ts tests/unit/card-watermark-policy.test.ts tests/unit/social-share-export.test.ts tests/unit/card-preview-export.test.ts
npm run typecheck
```

### Task 4: Shrink enforcement and verify

**Files:**
- Modify: `config/architecture-baseline.json`
- Modify: `.github/CODEOWNERS`
- Modify: `tests/unit/repository-maintenance.test.ts`

- [x] **Step 1: Confirm only stale baseline entries remain**

```bash
npm run architecture:check
```

- [x] **Step 2: Regenerate the smaller baseline and add ownership**

Add `/src/features/card-rendering/ @pyralisxc`, permanently retire old paths, regenerate the baseline, and rerun the focused architecture policy tests.

- [x] **Step 3: Run the complete local release matrix**

```bash
npm run lint
npm run typecheck
npm run architecture:check
npm run test
npm run build
git diff --check
npm audit --omit=dev
```

Expected: all code-quality commands pass; audit retains only the documented PostCSS advisory package paths and no high or critical finding.

- [x] **Step 4: Review presentation parity and dependency direction**

Inspect the full move diff, compare every moved pure export, verify Card Rendering has no product-feature/store import, and verify clean export does not import watermark policy or overlay.

- [x] **Step 5: Publish, merge, and verify production**

Open the incremental PR against exact `main`, require CI and Public smoke, merge only when green, then verify the exact production commit/deployment, five health routes, and absence of new error/fatal runtime logs.

Completed in [PR #31](https://github.com/pyralisxc/CardForge/pull/31). CI run 57 and Public smoke run 41 passed. Squash commit `0aaa5917094e1c6b37e7a8a5ffe9bc0b06fd839c` deployed as `dpl_2xJwU4ko1NUP6s4d68RHswnjkuP5`; production was READY on `cardforges.com`, all five health routes passed, and the exact deployment had no error or fatal logs.
