# Free-Visible Card Watermarks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Watermark every card surface visible to a free account while keeping entitled Studio views, persisted data, and clean export renderers unchanged.

**Architecture:** Generalize the existing watermark decision from generated previews to all visible card surfaces, but keep it as an explicit presentation prop. The app shell passes the entitlement-derived decision into the template editor; the editor reuses the existing pointer-inert overlay on the editable canvas, Preview mode, and template thumbnails. Shared `CardPreview` and export renderers remain watermark-free.

**Tech Stack:** Next.js 15, React 18, TypeScript, Tailwind CSS, Vitest, Playwright

## Global Constraints

- Use `canExportClean` as the single entitlement source.
- Use `/brand/cardforge-studio/watermark.svg` at 20% opacity and approximately 68% card width for free Studio surfaces.
- Keep Share Card output at its existing 24% opacity for every tier.
- Never persist the watermark in templates, cards, project files, editor history, or generated data.
- Never import watermark presentation into `CardPreview` or `cardPreviewExport`.
- Keep all canvas pointer, keyboard, drag, resize, zoom, and pan interactions operational.
- Keep Founder Beta, paid, developer, and owner Studio surfaces clean.

---

### Task 1: Generalize the viewing-layer watermark policy

**Files:**
- Modify: `src/features/card-generator/lib/cardWatermarkPolicy.ts`
- Modify: `src/features/card-generator/components/GenerationWorkspace.tsx`
- Modify: `tests/unit/card-watermark-policy.test.ts`

**Interfaces:**
- Produces: `shouldShowVisibleCardWatermark(canExportClean: boolean): boolean`.
- Preserves: all existing asset and opacity constants.

- [ ] **Step 1: Write the failing policy and source-boundary assertions**

Replace the generated-only import and assertions with:

```ts
import {
  CARD_WATERMARK_URL,
  GENERATED_PREVIEW_WATERMARK_OPACITY,
  GENERATED_PREVIEW_WATERMARK_WIDTH_PERCENT,
  SOCIAL_SHARE_WATERMARK_OPACITY,
  shouldShowVisibleCardWatermark,
} from '@/features/card-generator/lib/cardWatermarkPolicy';

it('brands every visible card surface without clean-export entitlement', () => {
  expect(shouldShowVisibleCardWatermark(false)).toBe(true);
  expect(shouldShowVisibleCardWatermark(true)).toBe(false);
});
```

Update the workspace source assertion to require:

```ts
expect(workspaceSource).toContain('shouldShowVisibleCardWatermark(canExportClean)');
```

- [ ] **Step 2: Run the focused unit test and verify RED**

Run: `npm run test -- tests/unit/card-watermark-policy.test.ts`

Expected: FAIL because `shouldShowVisibleCardWatermark` is not exported.

- [ ] **Step 3: Implement the generalized policy**

Replace the generated-only policy function with:

```ts
export const shouldShowVisibleCardWatermark = (canExportClean: boolean): boolean =>
  !canExportClean;
```

Update `GenerationWorkspace` to import and call `shouldShowVisibleCardWatermark(canExportClean)` while retaining its existing local `showGeneratedPreviewWatermark` variable and rendered behavior.

- [ ] **Step 4: Run the focused unit test and verify GREEN**

Run: `npm run test -- tests/unit/card-watermark-policy.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the policy change**

```bash
git add src/features/card-generator/lib/cardWatermarkPolicy.ts src/features/card-generator/components/GenerationWorkspace.tsx tests/unit/card-watermark-policy.test.ts
git commit -m "Generalize visible card watermark policy"
```

---

### Task 2: Brand free Layout Studio surfaces

**Files:**
- Modify: `src/features/app-shell/components/CardForgeStudioShell.tsx`
- Modify: `src/features/template-editor/components/CardTemplateMaker.tsx`
- Modify: `src/features/template-editor/components/TemplateCanvasStage.tsx`
- Modify: `src/features/template-editor/components/TemplateLibraryPanel.tsx`
- Modify: `tests/unit/card-watermark-policy.test.ts`
- Modify: `tests/smoke/card-forge.spec.ts`

**Interfaces:**
- Consumes: `shouldShowVisibleCardWatermark(canExportClean)` and `CardWatermarkOverlay`.
- Produces: `CardTemplateMakerProps.showCardWatermark`, `TemplateCanvasStageProps.showCardWatermark`, and `TemplateLibraryPanelProps.showCardWatermark`.

- [ ] **Step 1: Write failing source-contract assertions**

Extend `tests/unit/card-watermark-policy.test.ts` to read the shell, maker, stage, and library sources and require:

```ts
expect(shellSource).toContain('shouldShowVisibleCardWatermark(projectCapabilities.canExportClean)');
expect(shellSource).toContain('showCardWatermark={showVisibleCardWatermark}');
expect(makerSource).toContain('showCardWatermark={showCardWatermark}');
expect(stageSource).toContain('showCardWatermark ? <CardWatermarkOverlay testId="template-editor-watermark" /> : null');
expect(librarySource).toContain('showCardWatermark ? <CardWatermarkOverlay testId="template-library-watermark" /> : null');
```

Keep the clean renderer assertions:

```ts
expect(cardPreviewSource).not.toContain('CardWatermarkOverlay');
expect(cleanExportSource).not.toContain('cardWatermarkPolicy');
expect(cleanExportSource).not.toContain('CardWatermarkOverlay');
```

Also extend the isolated free-export smoke flow. After its existing generated-output watermark and export-gate assertions, switch to Layout Studio and assert:

```ts
await selectMainTab(page, /Layout Studio/i);

const editorWatermark = page.getByTestId('template-editor-watermark');
await expect(editorWatermark).toBeVisible();
await expect(editorWatermark).toHaveAttribute('src', '/brand/cardforge-studio/watermark.svg');
await expect(editorWatermark).toHaveCSS('opacity', '0.2');
await expect(page.getByTestId('template-library-watermark').first()).toBeVisible();

const canvas = page.locator('[data-cardforge-canvas="true"]');
await canvas.focus();
await expect(canvas).toBeFocused();
```

- [ ] **Step 2: Run the focused unit test and verify RED**

Run: `npm run test -- tests/unit/card-watermark-policy.test.ts`

Expected: FAIL because the shell and editor surfaces do not yet pass or render the watermark decision.

Then run, where a local browser is available:

```bash
CARDFORGE_ACCESS_MODE=free NEXT_PUBLIC_CARDFORGE_ACCESS_MODE=free npx playwright test tests/smoke/card-forge.spec.ts --workers=1 --grep "lets free users try clean export"
```

Expected: FAIL because the editor and library watermark test IDs do not exist. If the local Chromium binary is unavailable, preserve the assertions for the GitHub Public smoke gate and record that environment limitation.

- [ ] **Step 3: Pass the entitlement decision from the app shell**

Import `shouldShowVisibleCardWatermark` in `CardForgeStudioShell.tsx`, derive:

```ts
const showVisibleCardWatermark = shouldShowVisibleCardWatermark(projectCapabilities.canExportClean);
```

and pass:

```tsx
showCardWatermark={showVisibleCardWatermark}
```

to `CardTemplateMaker`.

- [ ] **Step 4: Thread the explicit presentation prop through CardTemplateMaker**

Add `showCardWatermark: boolean` to `CardTemplateMakerProps`, destructure it, and pass it unchanged to both `TemplateLibraryPanel` and `TemplateCanvasStage`:

```tsx
showCardWatermark={showCardWatermark}
```

- [ ] **Step 5: Overlay both editable and Preview canvas modes**

Import `CardWatermarkOverlay` into `TemplateCanvasStage.tsx`, add `showCardWatermark: boolean` to its props, and render this immediately after the existing preview/edit conditional inside the positioned canvas container:

```tsx
{showCardWatermark ? <CardWatermarkOverlay testId="template-editor-watermark" /> : null}
```

Because the overlay is pointer-inert and outside template element data, both editor modes remain interactive and persistence remains unchanged.

- [ ] **Step 6: Overlay every template-library card thumbnail**

Import `CardWatermarkOverlay` into `TemplateLibraryPanel.tsx`, add `showCardWatermark: boolean` to the panel props, pass it to every `TemplateLibraryPreview`, make the thumbnail container positioned, and render:

```tsx
{showCardWatermark ? <CardWatermarkOverlay testId="template-library-watermark" /> : null}
```

after `CardPreview` within the thumbnail container.

- [ ] **Step 7: Run the focused unit test and verify GREEN**

Run: `npm run test -- tests/unit/card-watermark-policy.test.ts`

Expected: PASS.

Run the isolated browser command from Step 2 again. Expected: PASS where Chromium is installed; otherwise the GitHub Public smoke workflow is the required browser verification.

- [ ] **Step 8: Commit the Layout Studio change**

```bash
git add src/features/app-shell/components/CardForgeStudioShell.tsx src/features/template-editor/components/CardTemplateMaker.tsx src/features/template-editor/components/TemplateCanvasStage.tsx src/features/template-editor/components/TemplateLibraryPanel.tsx tests/unit/card-watermark-policy.test.ts tests/smoke/card-forge.spec.ts
git commit -m "Brand free Layout Studio card surfaces"
```

---

### Task 3: Full verification and delivery

**Files:**
- Modify only if a scoped regression is exposed.

**Interfaces:**
- Consumes: the completed policy and editor presentation behavior.
- Produces: a green PR, merged `main`, and verified production deployment.

- [ ] **Step 1: Run the React review checklist**

Inspect the modified TSX files for prop typing, named components, pointer/accessibility behavior, hook correctness, unnecessary state, and image handling. Apply only scoped fixes.

- [ ] **Step 2: Run complete local verification**

```bash
npm run lint
npm run typecheck
npm run test
npm run build
git diff --check origin/main...HEAD
git status --short
```

Expected: lint, types, all Vitest files, and production build pass; the worktree contains only intentional committed changes.

- [ ] **Step 3: Review the clean-export boundary**

Run:

```bash
rg -n "CardWatermarkOverlay|cardWatermarkPolicy" src/components/card-forge/CardPreview.tsx src/lib/cardPreviewExport.tsx src/features/card-generator/components/ExportCardImageButton.tsx src/features/card-generator/components/SaveAsPdfButton.tsx
```

Expected: no matches.

- [ ] **Step 4: Publish a pull request**

Push `feature/free-visible-card-watermarks`, open a PR describing the entitlement matrix and export boundary, and require CI, Public smoke, and Vercel preview success.

- [ ] **Step 5: Merge and verify production**

Merge after required checks pass. Confirm the exact merge SHA reaches a `READY` production deployment aliased to `cardforges.com`, run `npm run health:production`, verify the watermark SVG returns HTTP 200, confirm the `main` push CI succeeds, and verify no new Vercel runtime error group appears.
