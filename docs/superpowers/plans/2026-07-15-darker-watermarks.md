# Darker Watermarks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Increase every existing CardForge watermark by four percentage points while preserving all current sizing, placement, entitlement, interaction, and export behavior.

**Architecture:** Update the two opacity constants in the focused watermark policy module. Existing Studio overlays and the Share Card compositor already consume those constants, so no component or renderer structure changes are needed.

**Tech Stack:** Next.js 15, React 18, TypeScript, Canvas 2D, Vitest, Playwright

## Global Constraints

- Free Studio card surfaces use 24% opacity.
- Share Card square, portrait, and story artwork uses 28% opacity for every tier.
- Keep watermark width, placement, asset, pointer behavior, entitlement policy, and export boundaries unchanged.
- Keep Founder Beta, paid, developer, and owner Studio surfaces clean.
- Keep normal PNG, PDF, ZIP, spritesheet, and project exports clean and entitlement-gated.

---

### Task 1: Raise both opacity constants through tests

**Files:**
- Modify: `tests/unit/card-watermark-policy.test.ts`
- Modify: `tests/smoke/card-forge.spec.ts`
- Modify: `src/features/card-generator/lib/cardWatermarkPolicy.ts`

**Interfaces:**
- Preserves: `GENERATED_PREVIEW_WATERMARK_OPACITY: number` and `SOCIAL_SHARE_WATERMARK_OPACITY: number`.
- Changes: their values to `0.24` and `0.28`, respectively.

- [ ] **Step 1: Write the failing opacity assertions**

In `tests/unit/card-watermark-policy.test.ts`, require:

```ts
expect(GENERATED_PREVIEW_WATERMARK_OPACITY).toBe(0.24);
expect(SOCIAL_SHARE_WATERMARK_OPACITY).toBe(0.28);
```

In the isolated free-export browser flow, update both existing DOM assertions to:

```ts
await expect(previewWatermark).toHaveCSS('opacity', '0.24');
await expect(editorWatermark).toHaveCSS('opacity', '0.24');
```

- [ ] **Step 2: Run the focused unit test and verify RED**

Run: `npm run test -- tests/unit/card-watermark-policy.test.ts tests/unit/social-share-export.test.ts`

Expected: FAIL because the policy still exports `0.2` and `0.24`.

- [ ] **Step 3: Implement the approved constants**

Update `src/features/card-generator/lib/cardWatermarkPolicy.ts`:

```ts
export const GENERATED_PREVIEW_WATERMARK_OPACITY = 0.24;
export const SOCIAL_SHARE_WATERMARK_OPACITY = 0.28;
```

Do not change the asset URL, width constant, entitlement function, overlay component, or social compositor.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm run test -- tests/unit/card-watermark-policy.test.ts tests/unit/social-share-export.test.ts`

Expected: both files pass and the social placement test consumes `0.28` through the shared constant.

- [ ] **Step 5: Commit the opacity change**

```bash
git add tests/unit/card-watermark-policy.test.ts tests/smoke/card-forge.spec.ts src/features/card-generator/lib/cardWatermarkPolicy.ts
git commit -m "Darken CardForge watermarks"
```

---

### Task 2: Verify and deliver

**Files:**
- Modify only if a scoped regression is exposed.

**Interfaces:**
- Consumes: the two updated opacity constants and browser assertions.
- Produces: a green PR, merged `main`, and verified production deployment.

- [ ] **Step 1: Run complete local verification**

```bash
npm run lint
npm run typecheck
npm run test
npm run build
git diff --check origin/main...HEAD
git status --short
```

Expected: lint, types, all unit files, and the production build pass with no uncommitted changes.

- [ ] **Step 2: Confirm the scope remains constant-only**

Run:

```bash
git diff --stat origin/main...HEAD
git diff origin/main...HEAD -- src/features/card-generator/lib/cardWatermarkPolicy.ts tests/unit/card-watermark-policy.test.ts tests/smoke/card-forge.spec.ts
```

Expected: runtime behavior changes only through the two constants; test changes only update the approved opacity values.

- [ ] **Step 3: Publish and gate the PR**

Push `feature/darker-watermarks`, open a PR, and require CI, Public smoke, and Vercel preview success. The Public smoke `Verify free export gate` step must confirm both Studio overlays render at `0.24`.

- [ ] **Step 4: Merge and verify production**

Merge only after all gates pass. Confirm the exact merge SHA reaches a `READY` production deployment on `cardforges.com`, the `main` push CI succeeds, `npm run health:production` passes, the watermark SVG returns HTTP 200, and no new Vercel runtime error group appears.
