# Centered Watermark Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add entitlement-aware centered watermarks to free generated previews and centered branding to every Share Card image without contaminating clean export renderers.

**Architecture:** A focused policy module owns the approved asset path and visual constants, while a small DOM overlay component brands only the generator surfaces that explicitly opt in. The social compositor imports the same constants and draws the watermark inside the rendered card bounds after obtaining a clean card canvas; PNG/PDF/ZIP/spritesheet/project exporters remain unchanged.

**Tech Stack:** Next.js 15, React 18, TypeScript, Canvas 2D, Tailwind CSS, Vitest, Playwright

## Global Constraints

- Use `/brand/cardforge-studio/watermark.svg` as the single runtime watermark asset.
- Draw no white or colored background plate behind the watermark.
- Use one horizontal centered mark, not a tiled, diagonal, or corner mark.
- Free/unentitled generated previews use 20% opacity and approximately 68% card width.
- Share Card images use 24% opacity and center the watermark inside the card bounds for every account tier.
- Founder Beta, paid, developer, and owner Studio previews stay clean through `canExportClean`.
- Normal PNG, PDF, ZIP, spritesheet, and project-file exports stay clean and entitlement-gated.
- The template editor canvas stays clean.

---

### Task 1: Watermark policy and DOM overlay

**Files:**
- Create: `src/features/card-generator/lib/cardWatermarkPolicy.ts`
- Create: `src/features/card-generator/components/CardWatermarkOverlay.tsx`
- Create: `tests/unit/card-watermark-policy.test.ts`

**Interfaces:**
- Produces: `CARD_WATERMARK_URL`, `GENERATED_PREVIEW_WATERMARK_OPACITY`, `GENERATED_PREVIEW_WATERMARK_WIDTH_PERCENT`, `SOCIAL_SHARE_WATERMARK_OPACITY`, and `shouldShowGeneratedPreviewWatermark(canExportClean: boolean): boolean`.
- Produces: `<CardWatermarkOverlay testId?: string />`, a pointer-inert decorative overlay.

- [ ] **Step 1: Write the failing policy test**

```ts
import { describe, expect, it } from 'vitest';
import {
  CARD_WATERMARK_URL,
  GENERATED_PREVIEW_WATERMARK_OPACITY,
  GENERATED_PREVIEW_WATERMARK_WIDTH_PERCENT,
  SOCIAL_SHARE_WATERMARK_OPACITY,
  shouldShowGeneratedPreviewWatermark,
} from '@/features/card-generator/lib/cardWatermarkPolicy';

describe('card watermark policy', () => {
  it('brands only generated previews without clean-export entitlement', () => {
    expect(shouldShowGeneratedPreviewWatermark(false)).toBe(true);
    expect(shouldShowGeneratedPreviewWatermark(true)).toBe(false);
  });

  it('uses the approved transparent mark and visual treatment', () => {
    expect(CARD_WATERMARK_URL).toBe('/brand/cardforge-studio/watermark.svg');
    expect(GENERATED_PREVIEW_WATERMARK_OPACITY).toBe(0.2);
    expect(GENERATED_PREVIEW_WATERMARK_WIDTH_PERCENT).toBe(68);
    expect(SOCIAL_SHARE_WATERMARK_OPACITY).toBe(0.24);
  });
});
```

- [ ] **Step 2: Run the policy test and verify RED**

Run: `npm run test -- tests/unit/card-watermark-policy.test.ts`

Expected: FAIL because `cardWatermarkPolicy` does not exist.

- [ ] **Step 3: Implement the policy module**

```ts
export const CARD_WATERMARK_URL = '/brand/cardforge-studio/watermark.svg';
export const GENERATED_PREVIEW_WATERMARK_OPACITY = 0.2;
export const GENERATED_PREVIEW_WATERMARK_WIDTH_PERCENT = 68;
export const SOCIAL_SHARE_WATERMARK_OPACITY = 0.24;

export const shouldShowGeneratedPreviewWatermark = (canExportClean: boolean): boolean =>
  !canExportClean;
```

- [ ] **Step 4: Add the focused DOM overlay**

```tsx
import {
  CARD_WATERMARK_URL,
  GENERATED_PREVIEW_WATERMARK_OPACITY,
  GENERATED_PREVIEW_WATERMARK_WIDTH_PERCENT,
} from '@/features/card-generator/lib/cardWatermarkPolicy';

export function CardWatermarkOverlay({ testId = 'generated-card-watermark' }: { testId?: string }) {
  return (
    <img
      src={CARD_WATERMARK_URL}
      alt=""
      aria-hidden="true"
      data-testid={testId}
      draggable={false}
      className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 select-none"
      style={{
        opacity: GENERATED_PREVIEW_WATERMARK_OPACITY,
        width: `${GENERATED_PREVIEW_WATERMARK_WIDTH_PERCENT}%`,
      }}
    />
  );
}
```

- [ ] **Step 5: Run the focused test and commit**

Run: `npm run test -- tests/unit/card-watermark-policy.test.ts`

Expected: PASS.

Commit: `git commit -am "Add centered card watermark policy"` after adding the new files.

---

### Task 2: Entitlement-aware generated preview overlays

**Files:**
- Modify: `src/features/card-generator/components/GenerationWorkspace.tsx`
- Modify: `src/features/card-generator/components/GeneratedCardGallery.tsx`
- Modify: `tests/smoke/card-forge.spec.ts`
- Test: `tests/unit/card-watermark-policy.test.ts`

**Interfaces:**
- Consumes: `shouldShowGeneratedPreviewWatermark(canExportClean)` and `<CardWatermarkOverlay />` from Task 1.
- Produces: `GeneratedCardGalleryProps.showPreviewWatermark: boolean`.

- [ ] **Step 1: Extend the isolated free-export browser test**

After the generated output is visible, assert:

```ts
const previewWatermark = page.getByTestId('generated-card-watermark').first();
await expect(previewWatermark).toBeVisible();
await expect(previewWatermark).toHaveAttribute('src', '/brand/cardforge-studio/watermark.svg');
await expect(previewWatermark).toHaveCSS('opacity', '0.2');
```

- [ ] **Step 2: Run the isolated smoke test and verify RED**

Run: `CARDFORGE_ACCESS_MODE=free NEXT_PUBLIC_CARDFORGE_ACCESS_MODE=free npx playwright test tests/smoke/card-forge.spec.ts --workers=1 --grep "lets free users try clean export"`

Expected: FAIL because no generated preview overlay exists. If the local Chromium binary is unavailable, preserve the failing assertion for GitHub Actions and use the focused unit/source checks locally.

- [ ] **Step 3: Add watermark opt-in to the generated gallery**

Add `showPreviewWatermark: boolean` to `GeneratedCardGalleryProps`. Inside each card's existing `relative group/card` wrapper, render:

```tsx
{showPreviewWatermark ? <CardWatermarkOverlay /> : null}
```

immediately after `CardPreview`, so hover controls remain above and interactive.

- [ ] **Step 4: Derive the policy once in GenerationWorkspace**

```ts
const showGeneratedPreviewWatermark = shouldShowGeneratedPreviewWatermark(canExportClean);
```

Pass that value to `GeneratedCardGallery`. Wrap each front/back deck `CardPreview` in a `relative w-fit` container and render `<CardWatermarkOverlay />` only when `showGeneratedPreviewWatermark` is true.

- [ ] **Step 5: Add a source-boundary unit assertion**

Extend the unit test to read the source files and prove:

```ts
expect(workspaceSource).toContain('shouldShowGeneratedPreviewWatermark(canExportClean)');
expect(gallerySource).toContain('showPreviewWatermark ? <CardWatermarkOverlay /> : null');
expect(cardPreviewSource).not.toContain('CardWatermarkOverlay');
```

This protects the clean editor boundary without requiring a DOM test environment.

- [ ] **Step 6: Run focused unit tests and commit**

Run: `npm run test -- tests/unit/card-watermark-policy.test.ts`

Expected: PASS.

Commit: `git commit -am "Brand free generated previews"`.

---

### Task 3: Move Share Card branding onto the card

**Files:**
- Modify: `src/features/card-generator/lib/socialShareExport.ts`
- Modify: `tests/unit/social-share-export.test.ts`
- Modify: `src/features/card-generator/components/ShareCardButton.tsx`

**Interfaces:**
- Consumes: `CARD_WATERMARK_URL` and `SOCIAL_SHARE_WATERMARK_OPACITY` from Task 1.
- Produces: `getSocialShareWatermarkPlacement(layout, intrinsicRatio?)`, returning `{ x, y, width, height, opacity }` inside the card bounds.

- [ ] **Step 1: Write failing layout tests**

```ts
const layout = getSocialShareLayout({ preset: 'square', cardWidth: 750, cardHeight: 1050 });
const watermark = getSocialShareWatermarkPlacement(layout);

expect(layout.watermarkUrl).toBe(CARD_WATERMARK_URL);
expect(watermark.opacity).toBe(0.24);
expect(watermark.x).toBeGreaterThanOrEqual(layout.cardX);
expect(watermark.y).toBeGreaterThanOrEqual(layout.cardY);
expect(watermark.x + watermark.width).toBeLessThanOrEqual(layout.cardX + layout.cardWidth);
expect(watermark.y + watermark.height).toBeLessThanOrEqual(layout.cardY + layout.cardHeight);
```

Read the social renderer source and assert that it no longer contains the footer plate call:

```ts
expect(source).not.toContain('context.fillRect(watermarkX - 18');
expect(source).toContain('context.globalAlpha = watermarkPlacement.opacity');
```

- [ ] **Step 2: Run the social unit test and verify RED**

Run: `npm run test -- tests/unit/social-share-export.test.ts`

Expected: FAIL because `getSocialShareWatermarkPlacement` does not exist and the footer implementation remains.

- [ ] **Step 3: Rebalance the social layout**

Replace `footerSpace` with a bottom margin matching the selected preset's visual balance. Calculate `maxHeight` from `output.height - topMargin - bottomMargin`, then center the card in that available region. Keep `watermarkUrl` but remove `footerY` from the returned layout.

- [ ] **Step 4: Implement in-card placement and composition**

```ts
export const getSocialShareWatermarkPlacement = (layout: SocialShareLayout) => {
  const width = Math.round(layout.cardWidth * 0.68);
  const height = Math.round(width * 260 / 1000);
  return {
    x: Math.round(layout.cardX + (layout.cardWidth - width) / 2),
    y: Math.round(layout.cardY + (layout.cardHeight - height) / 2),
    width,
    height,
    opacity: SOCIAL_SHARE_WATERMARK_OPACITY,
  };
};
```

After drawing the card, load the watermark and draw it at this placement under `context.globalAlpha`. Do not draw any fill rectangle behind it.

- [ ] **Step 5: Update Share Card copy**

Change the dialog description and toast copy from footer-style “attribution” to a centered, translucent CardForge watermark. Keep the statement that normal entitled exports remain clean.

- [ ] **Step 6: Run focused tests and commit**

Run: `npm run test -- tests/unit/social-share-export.test.ts tests/unit/card-watermark-policy.test.ts`

Expected: PASS.

Commit: `git commit -am "Center branding on shared card artwork"`.

---

### Task 4: Full verification and delivery

**Files:**
- Modify only if verification exposes a scoped regression.

**Interfaces:**
- Consumes all feature behavior from Tasks 1-3.
- Produces a reviewed PR, merged `main`, and verified production deployment.

- [ ] **Step 1: Run local verification**

Run in order:

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
git diff --check
```

Expected: all commands pass; Vitest includes the new watermark tests.

- [ ] **Step 2: Review the diff against the policy**

Confirm no watermark imports exist in `src/lib/cardPreviewExport.tsx`, `ExportCardImageButton.tsx`, `SaveAsPdfButton.tsx`, or ZIP/spritesheet exporters. Confirm the editor's direct `CardPreview` usage is unchanged.

- [ ] **Step 3: Push a feature branch and open a PR**

Use branch `feature/centered-watermark-policy`. The PR must summarize the entitlement matrix and clean-export boundary.

- [ ] **Step 4: Wait for required checks**

Require CI, Public smoke, and Vercel preview success. The isolated free smoke must visibly find the centered preview watermark.

- [ ] **Step 5: Merge and verify production**

Merge only after green checks. Confirm the exact merge SHA reaches a READY Vercel production deployment, the watermark SVG returns HTTP 200, public health passes, and no new runtime error group appears.
