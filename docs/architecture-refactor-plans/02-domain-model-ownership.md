# Domain Model Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Delete the catch-all `src/types/index.ts`, move its contracts into owned Cards, Templates, and Rendering domain modules, and update every consumer without a compatibility re-export.

**Architecture:** Template document and appearance contracts live under `domain/templates`; stored-card and card-set contracts live under `domain/cards`; hydrated display cards and print/layout contracts live under `domain/rendering`. The dependency direction is Cards → Templates → Rendering: templates may reference card data, and rendering may compose cards with templates, without a domain cycle. Consumers import the smallest owning domain entry point. The existing architecture baseline must shrink exactly after the move.

**Tech Stack:** TypeScript 5, Vitest 4, repository architecture checker, Next.js 15.

## Global Constraints

- Preserve all runtime behavior and serialized field names.
- Do not change public routes, persistence payloads, provider state, or UI.
- Do not leave `src/types`, `@/types`, a deprecated re-export, or a temporary compatibility alias.
- Domain modules remain type-only and cannot import React, Next.js, provider SDKs, features, infrastructure, or generic UI.
- Update the architecture baseline only after the checker reports stale resolved entries.

---

### Task 1: Define domain ownership as a failing repository contract

**Files:**
- Create: `tests/unit/domain-model-ownership.test.ts`
- Modify later: `tests/unit/repository-maintenance.test.ts`

**Interfaces:**
- Consumes: repository paths and source text.
- Produces: permanent assertions that the retired root cannot return and all three domain entry points exist.

- [x] **Step 1: Write the failing ownership test**

The test must assert:

```ts
await expect(pathExists('src', 'types')).resolves.toBe(false);
await expect(pathExists('src', 'domain', 'cards', 'index.ts')).resolves.toBe(true);
await expect(pathExists('src', 'domain', 'templates', 'index.ts')).resolves.toBe(true);
await expect(pathExists('src', 'domain', 'rendering', 'index.ts')).resolves.toBe(true);
```

Recursively inspect `.ts` and `.tsx` files under `src` and `tests` and assert that none contains `@/types`.
It also permanently asserts the one-way domain dependency direction: Cards imports no domain, Templates may import Cards, and Rendering may import Cards and Templates.

- [x] **Step 2: Run the focused test and verify RED**

```bash
npm test -- tests/unit/domain-model-ownership.test.ts
```

Expected: FAIL because `src/types` exists and the domain entry points do not.

- [x] **Step 3: Commit the failing ownership contract**

```bash
git add tests/unit/domain-model-ownership.test.ts
git commit -m "test: define domain model ownership"
```

### Task 2: Move the contracts into focused domain modules

**Files:**
- Create: `src/domain/templates/types.ts`
- Create: `src/domain/templates/index.ts`
- Create: `src/domain/cards/types.ts`
- Create: `src/domain/cards/index.ts`
- Create: `src/domain/rendering/types.ts`
- Create: `src/domain/rendering/index.ts`
- Delete: `src/types/index.ts`
- Modify: every source and unit-test file importing `@/types`

**Interfaces:**
- Produces: `@/domain/templates`, `@/domain/cards`, and `@/domain/rendering` type interfaces.

- [x] **Step 1: Create the Templates domain model**

Move these contracts without renaming fields or union values:

```text
FreeformElementType
FreeformShapeKind
FreeformShapeRole
GeneratorFieldKind
TemplateFieldContractType
TemplateFieldAllowedFormatting
TemplateSource
TemplateUsage
AppearanceTarget
AppearanceStyleKind
AppearanceGradientType
AppearanceTextureKind
AppearanceBorderKind
AppearanceTileMode
AppearanceGradientStop
AppearanceGradient
AppearanceTexture
AppearanceBorder
AppearanceEffects
FreeformAppearance
AppearanceStylePreset
AppearanceStyleLibrary
FreeformCardElement
FreeformCanvas
TemplateFieldContract
TCGCardTemplate
```

Use a type-only import for `CardData` from `@/domain/cards`. Export the contracts from `src/domain/templates/index.ts`.

- [x] **Step 2: Create the Cards domain model**

Move these contracts without changing their shapes:

```text
CardData
CardFace
StoredDisplayCard
CardSet
```

This leaf domain must not import another domain. Export the contracts from `src/domain/cards/index.ts`.

- [x] **Step 3: Create the Rendering domain model**

Move `DisplayCard`, `PdfDuplexLayout`, and `PaperSize` unchanged and export them from `src/domain/rendering/index.ts`. Use type-only imports from Cards and Templates so hydrated display models sit at the top of the domain dependency direction.

- [x] **Step 4: Rewrite every `@/types` import by ownership**

Partition each existing type-only import:

```ts
import type { CardData, CardSet, StoredDisplayCard, CardFace } from '@/domain/cards';
import type { TCGCardTemplate, FreeformCardElement, FreeformAppearance } from '@/domain/templates';
import type { DisplayCard, PaperSize, PdfDuplexLayout } from '@/domain/rendering';
```

Use a deterministic TypeScript-aware mechanical rewrite for the 105 existing import declarations, then inspect the resulting diff. Do not retain a root domain barrel that recombines all three owners.

- [x] **Step 5: Delete the retired type root**

Delete `src/types/index.ts` only after every consumer imports its new owner. Do not create `src/types.ts`, `src/domain/index.ts`, or a deprecated alias.

- [x] **Step 6: Run the focused ownership and type checks**

```bash
npm test -- tests/unit/domain-model-ownership.test.ts
npm run typecheck
```

Expected: ownership test and TypeScript pass.

- [x] **Step 7: Commit the domain move**

```bash
git add src/domain src tests/unit/domain-model-ownership.test.ts
git commit -m "refactor: assign card studio domain models"
```

### Task 3: Shrink the enforced architecture baseline

**Files:**
- Modify: `config/architecture-baseline.json`
- Modify: `.github/CODEOWNERS`
- Modify: `tests/unit/repository-maintenance.test.ts`

**Interfaces:**
- Consumes: the domain model paths from Task 2.
- Produces: exact architecture enforcement and explicit ownership for `src/domain`.

- [x] **Step 1: Verify that the old baseline is stale**

```bash
npm run architecture:check
```

Expected: FAIL only with stale `legacy-source-root` and `legacy-import-target` entries associated with `src/types` and `@/types`. Any new violation indicates a wrong import direction and must be fixed instead of baselined.

- [x] **Step 2: Regenerate the shrinking baseline**

```bash
node scripts/check-architecture.mjs --write-baseline
npm run architecture:check
```

Expected: the new count is lower than 587 and the exact baseline passes.

- [x] **Step 3: Make domain ownership explicit**

Add to CODEOWNERS:

```text
/src/domain/ @pyralisxc
```

Extend repository maintenance policy to assert `src/types` is retired and `src/domain` has CODEOWNERS coverage.

- [x] **Step 4: Run focused policy tests**

```bash
npm test -- tests/unit/domain-model-ownership.test.ts tests/unit/repository-maintenance.test.ts tests/unit/architecture-boundaries.test.ts
npm run architecture:check
```

Expected: all focused tests and architecture enforcement pass.

- [x] **Step 5: Commit the baseline reduction**

```bash
git add config/architecture-baseline.json .github/CODEOWNERS tests/unit/repository-maintenance.test.ts
git commit -m "ci: enforce domain model ownership"
```

### Task 4: Verify and integrate the milestone

**Files:**
- Modify only when verification identifies a defect in this milestone.

- [x] **Step 1: Run the complete local matrix**

```bash
npm run lint
npm run typecheck
npm run architecture:check
npm run test
npm run build
git diff --check
npm audit --omit=dev
```

Expected: all code-quality commands pass; audit retains only the documented three moderate package paths from the same PostCSS advisory and no high or critical finding.

- [x] **Step 2: Review serialization stability**

Inspect the source diff and confirm that every moved interface retains the exact property names, optional markers, and union values from deleted `src/types/index.ts`.

- [x] **Step 3: Publish and merge**

Use `superpowers:finishing-a-development-branch`, open the next incremental PR against the exact current `main`, require CI and Public smoke, merge only when green, and verify the exact production deployment, five health routes, and absence of new runtime errors.

Completed in PR #30. Hosted CI and Public smoke passed; production deployment `dpl_2JnAXZsaCVjGZ5YGvMHEjKRgRDu6` reached READY on commit `bfcbea0a54fdd3a29add1cb38a0cd1e59f0e776e`; all five health routes returned successfully; the deployment recorded five `200` responses and no error or fatal runtime logs during verification.
