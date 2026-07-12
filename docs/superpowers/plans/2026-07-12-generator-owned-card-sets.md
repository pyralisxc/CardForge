# Generator-Owned Card Sets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move card backs out of front templates and make the generator own the active card set, including front template and backing choices.

**Architecture:** Layout Studio edits reusable template parts: standard fronts and back-preset templates. Generate owns an active card set, and every generated card snapshots the selected front template, optional backing template, and set id/name at creation time. Preview, export, print validation, and persistence resolve backs only from generated-card backing data.

**Tech Stack:** Next.js App Router, React, Zustand, TypeScript, Vitest, Playwright.

## Global Constraints

- Clean cut: remove template-owned `backCanvas` and `backingTemplateId` behavior.
- No legacy fallback: exports and previews must not infer backs from front templates.
- TDD: write failing tests before production edits for behavior changes.
- Layout Studio: remove front/back face editing controls and template-level backing selection.
- Generator: expose deck/set setup with front template and backing template selection.

---

### Task 1: Pin the New Backing Ownership Boundary

**Files:**
- Modify: `tests/unit/store.test.ts`
- Modify: `tests/unit/zip-export.test.ts`
- Modify: `tests/unit/template-model.test.ts` if needed, otherwise keep model tests in `store.test.ts`

**Interfaces:**
- Produces: tests proving generated cards resolve `backingTemplateId` from `StoredDisplayCard`, not `TCGCardTemplate`.
- Produces: tests proving templates drop `backCanvas` and `backingTemplateId`.
- Produces: tests proving ZIP export only adds back faces when `DisplayCard.backingTemplate` exists.

- [ ] Write failing tests:

```ts
expect(reconstructMinimalTemplateObject({
  id: 'front',
  name: 'Front',
  backingTemplateId: 'old-back',
  backCanvas: { width: 630, height: 880, elements: [] },
})).not.toHaveProperty('backCanvas');

expect(cards[0].backingTemplate?.id).toBe('obsidian-back');
expect(createCardZipExportItems([frontTemplateWithBackCanvasOnly]).map((item) => item.face)).toEqual(['front']);
```

- [ ] Run: `npm test -- tests/unit/store.test.ts tests/unit/zip-export.test.ts`
- [ ] Expected: FAIL because production code still uses template-owned backing.

### Task 2: Add Active Card Set State and Stored Backing Snapshots

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/store/appStore.ts`
- Modify: `src/store/selectors.ts`
- Modify: `src/lib/cardBacking.ts`

**Interfaces:**
- `CardSet`: `{ id: string; name: string; frontTemplateId: string | null; backingTemplateId: string | null }`
- `StoredDisplayCard`: adds `setId`, `setName`, and `backingTemplateId`.
- `DisplayCard`: adds `setId`, `setName`, and `backingTemplateId`, with optional resolved `backingTemplate`.
- Store actions: `setActiveCardSetName`, `setActiveCardSetFrontTemplateId`, `setActiveCardSetBackingTemplateId`.

- [ ] Implement types and store defaults.
- [ ] Update `addGeneratedCards`, `updateGeneratedCard`, import/merge paths, delete-template cleanup, rehydrate fallback, and selectors.
- [ ] Update `cardBacking.ts` so backs come only from `card.backingTemplate`.
- [ ] Run the focused tests from Task 1 until PASS.

### Task 3: Remove Template-Owned Backing From Template Model and Editor

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/templateModel.ts`
- Modify: `src/lib/fieldContracts.ts`
- Modify: `src/lib/printValidation.ts`
- Modify: `src/features/template-editor/lib/templateEditorState.ts`
- Modify: `src/features/template-editor/hooks/useTemplateEditorController.ts`
- Modify: `src/features/template-editor/lib/templateVariableContracts.ts`
- Modify: `src/features/template-editor/lib/makerDimensions.ts`
- Modify: `src/features/template-editor/components/TemplateEditorTopBar.tsx`
- Modify: `src/features/template-editor/components/TemplateSettingsPanel.tsx`
- Modify: `src/features/template-editor/components/TemplateCanvasStage.tsx`
- Modify: `src/features/template-editor/components/CardTemplateMaker.tsx`
- Modify: related unit tests.

**Interfaces:**
- Templates have only `freeformCanvas`.
- Template editor state tracks one canvas and no active face.
- Back-preset templates remain normal editable templates identified by `templateUsage: 'back-preset'`.

- [ ] Remove `backCanvas`, `backingTemplateId`, and active face code from production files.
- [ ] Remove Layout Studio backing dropdown and front/back face toolbar controls.
- [ ] Update unit tests to assert single-canvas editor behavior.
- [ ] Run: `npm test -- tests/unit/template-editor-state.test.ts tests/unit/maker-dimensions.test.ts tests/unit/template-variable-contracts.test.ts tests/unit/store.test.ts`.

### Task 4: Move Set Setup Into Generate

**Files:**
- Modify: `src/features/app-shell/hooks/useCardForgeWorkspaceState.ts`
- Modify: `src/features/app-shell/components/CardForgeStudioShell.tsx`
- Modify: `src/features/card-generator/components/GenerationWorkspace.tsx`
- Modify: `src/features/card-generator/components/SingleCardGenerator.tsx`
- Modify: `src/features/card-generator/components/BulkGenerator.tsx`
- Modify: `src/lib/bulkGeneration.ts`

**Interfaces:**
- `GenerationWorkspace` receives front templates, back-preset templates, active card set, and set actions.
- `SingleCardGenerator` and `BulkGenerator` use active set template/backing instead of carrying their own template ownership.
- Generated `DisplayCard`s include `setId`, `setName`, and `backingTemplateId`.

- [ ] Render a Generate "Deck Setup" surface with deck name, front template select, card back select, and front/back previews.
- [ ] Remove duplicated template selection controls from single/bulk generator where they conflict with Deck Setup.
- [ ] Run generator unit tests and typecheck.

### Task 5: Data and Docs Hygiene

**Files:**
- Modify: `data/default-templates/default-playing-card-theme.json`
- Modify: active docs that mention template-owned backs, if any are found with `rg`.

**Interfaces:**
- Default front templates contain no `backCanvas` or `backingTemplateId`.
- Back presets remain separate `templateUsage: "back-preset"` templates.

- [ ] Remove template-owned backing fields from default data.
- [ ] Run: `rg -n "backCanvas|backingTemplateId|Back Face|Card Backing" src tests data docs`
- [ ] Resolve all matches except intentional current plan references.

### Task 6: Full Verification

**Files:**
- No source edits unless verification finds regressions.

**Commands:**
- `npm test`
- `npm run typecheck`
- `npm run build`
- Browser verification through Generate and Layout Studio.

- [ ] Verify Layout Studio edits front templates and back-preset templates separately.
- [ ] Verify Generate can select a front template and a separate back preset.
- [ ] Verify a generated card exports front/back only when the active set has a backing.
- [ ] Verify unpaid export prompt and generated-card removal still behave correctly.
