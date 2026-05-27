# MVP Publish Readiness Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring CardForge's docs, folder ownership, frontend architecture, backend data map, and release hygiene into a clear MVP-publish-ready shape without rewriting working product behavior.

**Architecture:** Treat cleanup as a series of small, verified ownership slices. Each slice should either make the docs more truthful, move code into the feature that owns it, extract a focused helper from a large coordinator, or remove stale/duplicated concepts. Shared code stays shared only when multiple feature areas actively use it.

**Tech Stack:** Next.js App Router, React, TypeScript strict mode, Tailwind/shadcn UI, Zustand, Clerk, Supabase, Stripe, Vitest, Playwright.

---

## Operating Rules

- Preserve user work and unrelated dirty changes. Do not run `git reset --hard`, `git checkout --`, or destructive cleanup commands.
- Use `rg`/`rg --files` for discovery.
- Use `apply_patch` for manual file edits.
- Make one coherent cleanup slice at a time, then verify.
- Do not move files just to reduce line count. Move files when ownership becomes clearer.
- Do not split a large file unless the extracted unit has a stable responsibility and can be verified.
- Keep user-facing vocabulary aligned with current product language:
  - `Source Assets`
  - `Element Recipes`
  - `Templates`
  - `Personal Library`
  - `Developer Pipeline`
  - `Current Defaults`
  - `Review Candidates`
  - `Recovery Archive`
- Avoid reintroducing `Card Parts` or `parts catalog` as active product language. `public/card-assets/parts/` is an implementation folder for image/overlay source assets.
- The planned creator pool remains future-facing planning copy only: 10% of eligible profit split evenly among eligible active developers after payout systems and terms are ready.

## Current Baseline

Already completed in the current cleanup train:

- `README.md` is now a short MVP entrypoint.
- `docs/README.md` exists as the docs index.
- `docs/development-guide.md` exists as the current front end/back end development map.
- Historical planning docs moved under `docs/archive/`.
- Generator-owned components moved under `src/features/card-generator/components/`.
- Studio header moved under `src/features/app-shell/components/`.
- Text element inspector moved under `src/features/template-editor/components/`.
- Generator export buttons moved under `src/features/card-generator/components/`.

Do not undo those moves. Future cleanup should build on them.

Latest full cleanup verification before this plan was written:

- `npm run lint`
- `npm run typecheck`
- `npm test -- --run`
- `npm run build`
- `git diff --check`

All passed. `git diff --check` may report expected CRLF warnings on Windows; whitespace errors are not acceptable.

## Verification Ladder

Use this ladder after each task. The task can stop at the smallest meaningful rung if it only changes docs, but code moves should reach at least lint, typecheck, and unit tests.

```bash
npm run lint
npm run typecheck
npm test -- --run
npm run build
git diff --check
```

For authenticated developer/owner behavior, run:

```bash
npx playwright test tests/smoke/auth-account.spec.ts --project=chromium
```

For full browser smoke:

```bash
npm run smoke
```

Expected passing markers:

- lint exits `0`
- typecheck exits `0`
- unit suite reports all files passed
- production build exits `0`
- `git diff --check` exits `0`; CRLF warnings are acceptable on Windows, whitespace errors are not

---

## Task 0: Cleanup Baseline And Scope Lock

**Purpose:** Make the next cleanup slice safe by confirming what is already dirty, which files belong to this cleanup train, and which checks are expected before more moves happen.

**Files:**
- Read: `git status --short`
- Read: `README.md`
- Read: `docs/README.md`
- Read: `docs/development-guide.md`
- Read: `docs/blueprint.md`
- Read: `docs/release-checklist.md`
- Read: `package.json`

- [x] **Step 1: Record current worktree shape**

Run:

```bash
git status --short
git diff --stat
```

Expected:

- Existing component moves are visible as delete/add pairs until Git recognizes renames.
- Existing archived docs are visible as delete/add pairs.
- No generated build folders are present.
- Any unrelated user changes are named in the handoff and left alone.

- [x] **Step 2: Confirm the plan is discoverable**

Run:

```bash
rg -n "MVP Cleanup Plan|mvp-cleanup-plan" README.md docs -g "*.md"
```

Expected: `docs/README.md` links to this plan.

- [x] **Step 3: Scan for stale active paths before more cleanup**

Run:

```bash
rg -n "src/components/card-forge/(Header|TextElementInspector|SaveAsPdfButton|ExportCardImageButton|BulkGenerator|SingleCardGenerator|PaperSizeSelector)|docs/superpowers|cardforge-aaa-upgrade-pathway" README.md docs src tests -g "*.md" -g "*.ts" -g "*.tsx"
```

Expected: stale references only appear inside `docs/archive/` or historical notes. Active source and active docs should use the new feature paths.

- [x] **Step 4: Choose the next checkpoint size**

Use this default unless Cameron redirects:

- One docs-only slice may stop after `git diff --check`.
- One code ownership move should run lint, typecheck, unit tests, and `git diff --check`.
- One editor/controller extraction should run lint, typecheck, targeted unit tests, full unit tests, and at least one browser smoke when the changed behavior is visible.

Do not begin a large split if the previous slice is failing for reasons introduced by the cleanup.

---

## Task 1: Lock The Current Docs Source Of Truth

**Purpose:** Make sure contributors and future agents enter through the current docs, not archived plans or stale path references.

**Files:**
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/development-guide.md`
- Modify: `docs/blueprint.md`
- Modify: `docs/release-checklist.md`
- Read only: `docs/archive/**`

- [x] **Step 1: Scan for stale active-doc references**

Run:

```bash
rg -n "docs/superpowers|cardforge-aaa-upgrade-pathway|Card Parts / Overlays|premium parts|parts catalog|src/components/card-forge/(Header|TextElementInspector|SaveAsPdfButton|ExportCardImageButton|BulkGenerator|SingleCardGenerator|PaperSizeSelector)" README.md docs -g "*.md"
```

Expected:

- Active docs should not point to old component paths.
- Active docs should not instruct contributors to use `docs/superpowers`.
- Mentions of retired wording should only appear as audit history, not current product instructions.

- [x] **Step 2: Update docs index if needed**

Ensure `docs/README.md` includes exactly these current lanes:

```markdown
## Source Of Truth

- [Development Guide](development-guide.md): practical front end, back end, data, and verification map.
- [Blueprint](blueprint.md): product architecture, storage model, route model, data contracts, and quality principles.
- [Release Checklist](release-checklist.md): MVP readiness, verification evidence, launch blockers, and residual risk.

## QA And Product Audits

- [Preset Quality Audit](preset-quality-audit.md): Layout Studio preset, recipe, and tool quality findings.
- [Site Tooling Walkthrough Audit](site-tooling-walkthrough-audit.md): route walkthrough and user-facing tooling findings.
- [Print Export Handoff](print-export-handoff.md): print, prepress, and Tabletop Simulator export expectations.
```

- [x] **Step 3: Keep archived docs clearly archived**

Confirm `docs/archive/` contains historical plans only. If a future implementation needs archived context, copy the current decision into `docs/blueprint.md` or `docs/release-checklist.md`; do not make active docs depend on archived plans.

Run:

```bash
rg --files docs/archive | Sort-Object
```

Expected: archived plan/spec files are listed; no active docs are hidden there.

- [x] **Step 4: Verify docs-only cleanup**

Run:

```bash
git diff --check
```

Expected: exit `0`, allowing CRLF warnings.

---

## Task 2: Finish Shared Component Ownership Cleanup

**Purpose:** Keep `src/components/card-forge/` for true shared card primitives and move feature-specific components to feature folders.

**Files:**
- Read: `src/components/card-forge/*`
- Modify imports in feature files that consume moved components.
- Modify: `docs/development-guide.md`
- Modify: `docs/blueprint.md`
- Modify: `docs/release-checklist.md`

Current desired ownership:

```text
src/components/card-forge/
  CardForgeRichTextEditor.tsx       shared rich text editing primitive
  CardPreview.tsx                   shared visual render source
  EditCardDialog.tsx                shared generated-card edit surface
  GeneratorFieldGroups.tsx          shared generator/edit field grouping
  GeneratorFieldInput.tsx           shared generator/edit field input
  PublicSiteHeader.tsx              shared public/account/developer/owner header
  TemplateThumbnail.tsx             shared template preview thumbnail
  VectorShapeElement.tsx            shared primitive SVG shape renderer
```

- [x] **Step 1: Find remaining single-use shared components**

Run:

```bash
Get-ChildItem src\components\card-forge -File | Select-Object -ExpandProperty Name | Sort-Object
rg -n "from '@/components/card-forge/" src tests -g "*.ts" -g "*.tsx"
```

Expected: imports for `CardPreview`, `CardTemplateMaker`, `EditCardDialog`, `GeneratorFieldGroups`, `GeneratorFieldInput`, `PublicSiteHeader`, `TemplateThumbnail`, and shared rich/vector renderers are acceptable. Feature-only imports should be moved.

- [x] **Step 2: Move a single-use component with history**

Use `apply_patch` with `*** Move to:`. Example pattern:

```diff
*** Begin Patch
*** Update File: src/components/card-forge/ExampleFeatureOnlyComponent.tsx
*** Move to: src/features/example/components/ExampleFeatureOnlyComponent.tsx
@@
-"use client";
+"use client";
*** End Patch
```

- [x] **Step 3: Update imports**

For every moved component, update imports from:

```ts
import { ExampleFeatureOnlyComponent } from '@/components/card-forge/ExampleFeatureOnlyComponent';
```

to:

```ts
import { ExampleFeatureOnlyComponent } from '@/features/example/components/ExampleFeatureOnlyComponent';
```

- [x] **Step 4: Remove stale references in docs**

Run:

```bash
rg -n "ExampleFeatureOnlyComponent|src/components/card-forge" docs/development-guide.md docs/blueprint.md docs/release-checklist.md
```

Update the docs only where the moved component is named as a primary file.

- [x] **Step 5: Verify ownership move**

Run:

```bash
npm run lint
npm run typecheck
npm test -- --run
git diff --check
```

Expected: all commands exit `0`.

---

## Task 3: Split `makerConstants.tsx` Into Clear Maker Modules

**Purpose:** Remove the current mixed bag of maker theme tokens, preset recipes, frame kits, primitive helpers, and template factory code from one file.

**Files:**
- Read: `src/features/template-editor/lib/elementKits.tsx`
- Read: `src/features/template-editor/lib/elementStylePresets.ts`
- Create: `src/features/template-editor/lib/makerTheme.ts`
- Create: `src/features/template-editor/lib/makerTemplateFactory.ts`
- Create: `src/features/template-editor/lib/elementPresetRecipes.ts`
- Create: `src/features/template-editor/lib/makerGeometry.ts`
- Modify: `src/features/template-editor/lib/elementKits.tsx`
- Modify: `src/features/template-editor/lib/elementStylePresets.ts`
- Modify import consumers under:
  - `src/features/template-editor/components/CardTemplateMaker.tsx`
  - `src/features/template-editor/components/*.tsx`
  - `src/features/template-editor/hooks/*.ts`

- [x] **Step 1: Inventory exports**

Run:

```bash
rg -n "^export (const|function|type|interface)|export \\{" src/features/template-editor/lib/elementKits.tsx src/features/template-editor/lib/elementStylePresets.ts
rg -n "makerConstants|elementKits|elementStylePresets" src -g "*.ts" -g "*.tsx"
```

Expected: list every exported helper and each consumer before moving anything.

- [x] **Step 2: Move pure theme tokens**

Move `makerTheme` and button/control CSS helpers into:

```text
src/features/template-editor/lib/makerTheme.ts
```

Update consumers to import:

```ts
import { makerTheme } from '@/features/template-editor/lib/makerTheme';
```

- [x] **Step 3: Move pure geometry helpers**

Move `clamp` and numeric geometry helpers into:

```text
src/features/template-editor/lib/makerGeometry.ts
```

Update consumers to import:

```ts
import { clamp } from '@/features/template-editor/lib/makerGeometry';
```

- [x] **Step 4: Move template factory**

Move `makeNewFreeformTemplate()` and direct default template construction helpers into:

```text
src/features/template-editor/lib/makerTemplateFactory.ts
```

Expected import:

```ts
import { makeNewFreeformTemplate } from '@/features/template-editor/lib/makerTemplateFactory';
```

- [ ] **Step 5: Move preset recipe seeds**

Move element recipe constants into focused modules. Current checkpoint:

- [x] Split insertable element kits into `elementKits.tsx`.
- [x] Split local Material & Effects style buttons into `elementStylePresets.ts`.
- [ ] Convert broad style presets into typed recipe data once the registry-backed recipe shape is ready.

Future typed recipe module:

```text
src/features/template-editor/lib/elementPresetRecipes.ts
```

This module should export typed recipe data only. React components should stay in `components/`.

- [x] **Step 6: Leave a temporary compatibility file only if needed**

If too many imports make the move risky, leave `makerConstants.tsx` as a short barrel during one checkpoint:

```ts
export { makerTheme } from '@/features/template-editor/lib/makerTheme';
export { clamp } from '@/features/template-editor/lib/makerGeometry';
export { makeNewFreeformTemplate } from '@/features/template-editor/lib/makerTemplateFactory';
```

Then remove the compatibility file after all imports are migrated. Do not keep the barrel permanently unless more than one feature imports it and the path itself is the intended stable API.

- [x] **Step 7: Add or update focused tests**

If template construction moved, update or add a unit test that imports the new factory path and verifies:

```ts
expect(makeNewFreeformTemplate().freeformCanvas?.elements).toEqual(expect.any(Array));
expect(makeNewFreeformTemplate().templateSource).toBe('user');
```

Use the existing template/model test style if a matching file exists; otherwise add:

```text
tests/unit/maker-template-factory.test.ts
```

- [x] **Step 8: Verify maker constants split**

Run:

```bash
npm run lint
npm run typecheck
npm test -- --run tests/unit/maker-template-factory.test.ts
npm test -- --run
```

Expected: all commands exit `0`.

---

## Task 4: Extract A First Safe Slice From `CardTemplateMaker.tsx`

**Purpose:** Reduce the main editor coordinator without changing visible editor behavior.

**Files:**
- Read: `src/features/template-editor/components/CardTemplateMaker.tsx`
- Read: `src/features/template-editor/hooks/useTemplateEditorController.ts`
- Read: `src/features/template-editor/hooks/useCanvasPointerInteractions.ts`
- Read: `src/features/template-editor/lib/canvasCommands.ts`
- Candidate creates:
  - `src/features/template-editor/hooks/useTemplateSelectionActions.ts`
  - `src/features/template-editor/hooks/useTemplateVariableActions.ts`
  - `src/features/template-editor/hooks/useTemplateAssetActions.ts`
- Tests:
  - existing unit tests under `tests/unit/`
  - existing smoke tests under `tests/smoke/`

Do not extract drag/resize internals in the first slice. They are interaction-sensitive.

Completed checkpoint:

- [x] Moved the coordinator to `src/features/template-editor/components/CardTemplateMaker.tsx`.
- [x] Extracted custom dimension parsing and canvas reconstruction into `src/features/template-editor/lib/makerDimensions.ts`.
- [x] Added focused unit coverage in `tests/unit/maker-dimensions.test.ts`.

- [x] **Step 1: Find cohesive action clusters**

Run:

```bash
rg -n "const handle|function handle|useCallback|selectedElement|fieldContract|asset|variable|template" src/features/template-editor/components/CardTemplateMaker.tsx
```

Group handlers into:

- selection and layer actions
- variable/field-contract actions
- asset/library actions
- save/load/delete template actions
- pointer drag/resize actions

- [x] **Step 2: Choose one low-risk cluster**

Start with variable/field-contract actions if they do not depend on DOM pointer state. The extraction should accept stable inputs and return callbacks, not own global app state.

Target hook shape:

```ts
export interface TemplateVariableActionsInput {
  currentTemplate: TCGCardTemplate;
  selectedElementId: string | null;
  updateTemplate: (nextTemplate: TCGCardTemplate, trackHistory?: boolean) => void;
}

export interface TemplateVariableActions {
  createEditorVariableFromSelection: (text: string) => string | undefined;
  renameSelectedElementVariable: (oldKey: string, nextKey: string) => void;
  removeSelectedElementVariableContract: (key: string) => void;
  upsertFieldContract: (key: string, updates: Partial<FieldContract>) => void;
}
```

Adjust names to match existing local function names exactly when importing back into `CardTemplateMaker`.

- [x] **Step 3: Add a focused unit test before moving behavior**

If the extracted hook delegates to pure helpers, test those helpers directly. Add or extend:

```text
tests/unit/template-variable-contracts.test.ts
```

Minimum assertions:

```ts
expect(rename result).toContain(new key);
expect(remove result.fieldContracts).not.toContainEqual(expect.objectContaining({ key }));
expect(upsert result.fieldContracts).toContainEqual(expect.objectContaining({ key, elementId }));
```

- [x] **Step 4: Move code and keep the public behavior unchanged**

Create the hook/helper under `src/features/template-editor/`. Replace local function definitions in `CardTemplateMaker.tsx` with the imported hook result. Do not rename UI props in the same slice unless TypeScript requires it.

Checkpoint: variable/field-contract pure behavior now lives in `src/features/template-editor/lib/templateVariableContracts.ts`; the coordinator keeps the React-specific focus/toast callbacks and delegates upsert, rename, remove, and key generation to that helper.

- [x] **Step 5: Verify editor extraction**

Run:

```bash
npm run lint
npm run typecheck
npm test -- --run tests/unit/template-variable-contracts.test.ts
npm test -- --run
```

If a route-level smoke exists for editor variable creation, run it. If not, run the full smoke suite after two editor extraction slices:

```bash
npm run smoke
```

---

## Task 5: Backend/API Comprehension Pass

**Purpose:** Make backend behavior easy to understand without reading every API route end to end.

**Files:**
- Create: `docs/backend-data-flow.md`
- Modify: `docs/README.md`
- Modify: `docs/development-guide.md`
- Read:
  - `src/app/api/**/route.ts`
  - `src/lib/accountEntitlement.ts`
  - `src/lib/ownerConsoleStore.ts`
  - `src/lib/roadmapStore.ts`
  - `src/lib/developerAssetStore.ts`
  - `src/lib/developerAssets.ts`
  - `src/lib/supabaseServer.ts`
  - `supabase/migrations/*.sql`

- [x] **Step 1: Generate an API inventory**

Run:

```bash
rg --files src/app/api | Sort-Object
```

Expected: list all API route files.

- [x] **Step 2: Write the backend data-flow doc**

Create `docs/backend-data-flow.md` with these exact sections:

```markdown
# Backend Data Flow

Last updated: May 25, 2026

## Server Boundary

## API Routes

## Supabase Tables

## Clerk Entitlement Inputs

## Developer Asset Pipeline Writes

## Local-First Boundaries

## Verification
```

Populate each section with current behavior only. Label future Stripe Connect/payout work as not implemented.

- [x] **Step 3: Add the doc to the docs index**

Add to `docs/README.md` under Source Of Truth:

```markdown
- [Backend Data Flow](backend-data-flow.md): API routes, Supabase tables, Clerk entitlement inputs, and write boundaries.
```

- [x] **Step 4: Verify backend doc references**

Run:

```bash
rg -n "Backend Data Flow|backend-data-flow" docs README.md
git diff --check
```

Expected: references exist in `docs/README.md`; whitespace check exits `0`.

---

## Task 6: Developer Pipeline Data Contract Cleanup

**Purpose:** Keep asset pipeline terminology, profile overrides, voting, and registry sync understandable across UI, docs, tests, and backend helpers.

**Files:**
- Read/modify: `src/lib/developerAssets.ts`
- Read/modify: `src/lib/developerAssetStore.ts`
- Read/modify: `src/lib/pipelineAssetTaxonomy.ts`
- Read/modify: `src/features/developer-assets/components/DeveloperAssetHubPanel.tsx`
- Read/modify: `src/features/developer-assets/components/OwnerDeveloperProgramPanel.tsx`
- Read/modify: `tests/unit/developer-assets.test.ts`
- Read/modify: `tests/unit/developer-asset-store.test.ts`
- Read/modify: `tests/unit/pipeline-asset-taxonomy.test.ts`
- Read/modify: `tests/smoke/auth-account.spec.ts`
- Modify docs:
  - `docs/development-guide.md`
  - `docs/blueprint.md`
  - `docs/release-checklist.md`
  - `docs/backend-data-flow.md`

- [x] **Step 1: Scan pipeline vocabulary**

Run:

```bash
rg -n "Card Parts|card parts|parts catalog|legacy official tier|profit-share|creator pool|creator-pool|eligible_for_profit_share|monthly_submission_limit_override|monthly_published_requirement_override" src tests docs -g "*.ts" -g "*.tsx" -g "*.md"
```

Expected:

- Current UI/docs use `image/overlay source assets`.
- Creator-pool copy is future-facing.
- Profile overrides are described as account-specific developer contracts.

- [x] **Step 2: Normalize labels through taxonomy helpers**

If any component hardcodes asset family labels that should come from taxonomy helpers, replace with:

```ts
getDeveloperAssetTypeLabel(type)
getDeveloperAssetStatusLabel(status)
getDeveloperAssetTierLabel(tier)
```

from:

```ts
import {
  getDeveloperAssetStatusLabel,
  getDeveloperAssetTierLabel,
  getDeveloperAssetTypeLabel,
} from '@/lib/pipelineAssetTaxonomy';
```

- [x] **Step 3: Ensure contribution summary remains explicit**

`DeveloperContributionSummary` should keep these fields because owner UI and developer UI need effective values:

```ts
effectiveSubmissionLimit: number;
effectivePublishedRequirement: number;
submissionLimitOverride: number | null;
publishedRequirementOverride: number | null;
profitShareEligible: boolean;
ownerNote: string | null;
```

Do not collapse these into a generic metadata object; the current explicit shape is easier to test and understand.

- [x] **Step 4: Verify pipeline behavior**

Run:

```bash
npm test -- --run tests/unit/developer-assets.test.ts tests/unit/developer-asset-store.test.ts tests/unit/pipeline-asset-taxonomy.test.ts
npx playwright test tests/smoke/auth-account.spec.ts --project=chromium
```

Expected: all tests pass. The authenticated smoke must still verify reusable developer/owner account voting rules, owner vote weight, archive recovery, and per-account profile override behavior.

---

## Task 7: Release Hygiene And Dependency Decision Pass

**Purpose:** Keep the MVP launch status honest and reduce avoidable release ambiguity.

**Files:**
- Modify: `docs/release-checklist.md`
- Modify: `README.md` only if setup commands change
- Read:
  - `package.json`
  - `package-lock.json`
  - `.env.example`
  - `playwright.config.ts`

- [x] **Step 1: Run current dependency audit**

Run:

```bash
npm audit --omit=dev
```

Expected: If audit still reports moderate findings through Next/PostCSS, keep release checklist as `NO-GO FOR PUBLIC LAUNCH` unless Cameron explicitly accepts that risk.

Update: Cameron accepted the known framework-bundled Next/PostCSS moderate advisory for MVP demo/public-beta launch on May 25, 2026. The release must not be described as audit-clean until `npm audit --omit=dev` exits successfully.

- [x] **Step 2: Record audit state**

Update `docs/release-checklist.md` with:

```markdown
Current production audit snapshot:

- high: 0
- moderate: <actual number>
- total: <actual number>
```

Use actual values from the command output.

- [x] **Step 3: Confirm test account setup docs**

Run:

```bash
rg -n "CARDFORGE_E2E_FREE_EMAIL|CARDFORGE_E2E_PAID_EMAIL|CARDFORGE_E2E_DEV_EMAIL|CARDFORGE_E2E_OWNER_EMAIL|CARDFORGE_E2E_ALLOW_DISPOSABLE_USERS" .env.example README.md docs tests
```

Expected:

- `.env.example` documents the reusable QA values.
- Tests skip reusable-account smoke if values are missing.
- Docs do not ask agents to create disposable users by default.

- [x] **Step 4: Verify release commands**

Run:

```bash
npm run lint
npm run typecheck
npm test -- --run
npm run build
git diff --check
```

Expected: all commands exit `0` except `npm audit --omit=dev` while the known framework advisory exception remains active.

Checkpoint: release hygiene was refreshed on May 25, 2026. `npm audit --omit=dev` still reports `0` high, `2` moderate, `2` total findings through `next -> postcss`; `npm audit fix --force` still proposes a breaking downgrade path and remains intentionally rejected. Cameron accepted this framework-bundled advisory for MVP demo/public-beta launch, with the rule that CardForge must not be described as audit-clean until the audit exits successfully. Reusable QA account documentation is present in `.env.example`, README, release docs, and the authenticated smoke tests. The verification ladder passed after this cleanup slice.

---

## Task 8: Browser QA Cleanup Checkpoint

**Purpose:** Prove cleanup did not only pass static checks but still leaves the local site usable.

**Files:**
- Read: `playwright.config.ts`
- Read/modify only if needed: `tests/smoke/card-forge.spec.ts`
- Read/modify only if needed: `tests/smoke/auth-account.spec.ts`

- [x] **Step 1: Confirm local server state**

Run:

```bash
Get-NetTCPConnection -LocalPort 9002 -ErrorAction SilentlyContinue | Select-Object -First 5
```

If no server is running, start:

```bash
npm run dev
```

Expected: local app is reachable at `http://localhost:9002`.

- [x] **Step 2: Run public smoke**

Run:

```bash
npm run smoke
```

Expected: public Studio/generator workflows pass.

- [x] **Step 3: Run authenticated smoke when QA env is configured**

Run:

```bash
npx playwright test tests/smoke/auth-account.spec.ts --project=chromium
```

Expected:

- account matrix passes
- Founder Beta claim/vote/profile smoke passes
- owner submit/publish pipeline passes
- developer/owner voting and per-account contract smoke passes

- [x] **Step 4: Update release checklist verification snapshot**

If smoke results changed, update `docs/release-checklist.md` with the exact command names and pass/fail status.

Checkpoint: browser QA cleanup passed on May 25, 2026. `Get-NetTCPConnection -LocalPort 9002` found no pre-existing listener, so Playwright started the local dev server from `npm run dev`. `npm run smoke` passed `18` browser tests, including public Studio/generator workflows and authenticated reusable-account smoke. The direct authenticated command `npx playwright test tests/smoke/auth-account.spec.ts --project=chromium` passed `4` reusable-account tests.

---

## Task 9: Stop Criteria And Handoff

**Purpose:** End cleanup phases at clean checkpoints instead of drifting into a broad rewrite.

**Files:**
- Modify: `docs/release-checklist.md`
- Modify: `docs/development-guide.md` if ownership changed
- Modify: `docs/mvp-cleanup-plan.md` task checkboxes as work completes

- [x] **Step 1: Run final verification ladder**

Run:

```bash
npm run lint
npm run typecheck
npm test -- --run
npm run build
git diff --check
```

- [x] **Step 2: Inspect final worktree shape**

Run:

```bash
git status --short
git diff --stat
```

Expected:

- moved files show as delete/add if git has not detected renames yet
- no generated build artifacts are staged or intentionally added
- docs and source changes match the cleanup slice

- [x] **Step 3: Handoff summary**

Summarize:

- ownership moves completed
- docs updated
- tests/build commands run
- known residual risks
- next recommended cleanup phase

Do not claim public launch readiness unless the release checklist blockers are resolved or explicitly accepted.

Checkpoint: final cleanup verification passed on May 25, 2026. `npm run lint`, `npm run typecheck`, `npm test -- --run`, `npm run build`, and `git diff --check` exited `0`. The final worktree remains intentionally broad from the cleanup train, with archived docs/file moves showing as delete/add pairs and new feature-owned files under `src/features/**`. The known production dependency audit finding is now an accepted framework advisory exception for MVP demo/public-beta launch; paid production launch remains blocked by unresolved production billing entitlement ownership and release hygiene.

---

## Recommended Execution Order

1. Task 0: Cleanup baseline and scope lock.
2. Task 1: Docs source of truth.
3. Task 2: Finish low-risk component ownership moves.
4. Task 3: Split `makerConstants.tsx`.
5. Task 4: Extract one safe `CardTemplateMaker.tsx` behavior cluster.
6. Task 5: Backend/API data-flow doc.
7. Task 6: Developer pipeline contract cleanup.
8. Task 7: Release hygiene and dependency decision pass.
9. Task 8: Browser QA checkpoint.
10. Task 9: Final handoff.

This order keeps the cleanup understandable: docs and ownership first, then large-file decomposition, then backend comprehension, then release proof.

## Definition Of Done

This cleanup plan is complete when:

- Active docs point to the current architecture and no longer depend on archived plans.
- `src/components/card-forge/` contains only true shared card primitives or explicitly temporary coordinators.
- `makerConstants.tsx` is removed from `src/components/card-forge/`; remaining legacy preset data lives under `src/features/template-editor/` until it is converted into pipeline-backed recipes.
- `CardTemplateMaker.tsx` has at least one low-risk behavior cluster extracted into feature-owned code with tests.
- Backend/API docs explain each shared data write boundary.
- Developer pipeline vocabulary is consistent across UI, tests, docs, and taxonomy helpers.
- The release checklist contains the latest verification and dependency-audit state.
- The verification ladder passes for the final cleanup checkpoint.

## Stop Conditions

Stop and hand back a focused checkpoint if:

- A user decision is needed about product language, launch risk, or feature behavior.
- A code move would require changing visible behavior just to compile.
- Authenticated smoke tests require missing reusable QA credentials.
- The dependency audit requires a package upgrade that changes Next.js, React, Supabase, Clerk, or Stripe behavior.
- The worktree gains unrelated changes during the cleanup and their ownership is unclear.
