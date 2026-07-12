# Image Generation Layout Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full image customization in generation and flip controls in Layout Studio without preserving legacy one-off image transform paths.

**Architecture:** Layout Studio stores layer-level flip transforms directly on `FreeformCardElement`. Generator stores per-output image overrides in hidden `CardData` keys, parallel to text style overrides but using an image-specific override helper. Card preview resolves template element values plus generated output overrides at render time so single generation, edit dialog, gallery, export, print, and bulk output share one rendering path.

**Tech Stack:** Next.js, React, TypeScript, Zustand, Vitest, Playwright smoke via installed Chrome.

## Global Constraints

- Cold cut: do not keep the old `appearance.assetFlipX` as the primary flip path; normalize/render through element-level image transform fields.
- Generator owns per-output customization; Layout Studio owns structure and defaults.
- No separate preview/export behavior: `CardPreview` must be the shared rendering path for generated images.
- TDD: write failing tests before production code.

---

### Task 1: Image Override Data Model

**Files:**
- Create: `src/lib/imageFieldOverrides.ts`
- Create: `tests/unit/image-field-overrides.test.ts`
- Modify: `src/types/index.ts`
- Modify: `src/lib/bulkGeneration.ts`

**Interfaces:**
- `ImageFieldOverrideProperty = 'fit' | 'positionX' | 'positionY' | 'flipX' | 'flipY' | 'scale' | 'offsetX' | 'offsetY' | 'rotation' | 'frameX' | 'frameY' | 'frameWidth' | 'frameHeight'`
- `buildImageFieldOverrideDataKey(fieldKey, property)` returns `__cardforgeImageField.<fieldKey>.<property>`.
- `resolveImageElementOverrides(element, data, fieldKey)` returns render-ready image element fields and CSS values.

- [x] Write failing tests proving override keys parse and resolve image fit, object position, flip, scale, offsets, rotation, and frame geometry.
- [x] Run focused test and confirm failure.
- [x] Implement helper and types.
- [x] Extend bulk style column recognition so `art.image.fit` and `art.image.scale` columns import into `CardData`.
- [x] Run focused tests until green.

### Task 2: Shared Rendering and Layout Flip

**Files:**
- Modify: `src/components/card-forge/CardPreview.tsx`
- Modify: `src/features/template-editor/components/TemplateEditableElement.tsx`
- Modify: `src/features/template-editor/components/ElementAlignmentPanel.tsx`
- Modify: `src/features/template-editor/components/CardTemplateMaker.tsx`

**Interfaces:**
- `FreeformCardElement` gains `flipX?: boolean`, `flipY?: boolean`, `imageScale?: number`, `imageOffsetX?: number`, `imageOffsetY?: number`, `imageRotation?: number`, `imageObjectPositionX?: string`, `imageObjectPositionY?: string`.
- `ElementAlignmentPanel` emits `onFlip('x' | 'y')`.

- [x] Write failing tests for transform string creation/resolution.
- [x] Replace render-time `appearance.assetFlipX` use with element-level `flipX`/`flipY`.
- [x] Add Flip X and Flip Y buttons to Align To Canvas & Layer.
- [x] Wire selected-layer flip updates in `CardTemplateMaker`.

### Task 3: Generator Image Tools

**Files:**
- Modify: `src/features/card-generator/components/GeneratorFieldInput.tsx`
- Modify: `src/features/card-generator/components/GeneratorFieldGroups.tsx`
- Modify: `src/features/card-generator/components/EditCardDialog.tsx` if needed through shared `GeneratorFieldGroups`

**Interfaces:**
- Image fields receive `imageStyleValues` and `onImageStyleChange`.
- UI exposes Fit, X/Y position, Flip X/Y, Scale, Offset X/Y, Rotation, and optional Frame X/Y/W/H controls.

- [x] Write failing component-adjacent unit tests where available for override key wiring.
- [x] Add collapsible Image tools panel for image fields.
- [x] Feed image override keys through single and edit flows using `CardData`.
- [x] Verify generated outputs render overrides in shared preview.

### Task 4: Verification

**Files:**
- Test-only changes as required.

- [x] Run focused tests.
- [x] Run `vitest run`.
- [x] Run `next typegen && tsc --noEmit`.
- [x] Run `next build`.
- [x] Browser-smoke `/studio` for Layout Studio flip buttons and Generator image tools.
