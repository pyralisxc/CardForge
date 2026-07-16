# Template Editor Decomposition Plan

**Status:** In progress

**Goal:** Turn `CardTemplateMaker` into a small composition boundary with focused session, viewport, element/layer, variable, template-command, asset, and presentation owners while preserving editor appearance, history, grouping, pointer behavior, drafts, project operations, and clean/watermarked rendering policy.

**Architecture:** `useTemplateEditorController` remains the authoritative edit/history engine. Focused hooks adapt that engine into responsibility-specific commands and state. Pure field contracts and field extraction move to Domain because Generator and Template Editor both consume them. The browser entry point is exported from `features/template-editor/client.ts`; outside features never deep-import editor internals. Presentation components receive explicit view models and commands rather than owning persistence or mutating unrelated state.

---

## Non-negotiable invariants

- Undo, redo, grouping, ungrouping, duplication, deletion, layer order, pointer movement, snapping, zooming, and keyboard shortcuts retain their existing behavior.
- Recovered drafts hydrate before the workspace becomes interactive and autosave never blocks editing.
- Free users continue to see the visible watermark; entitled users and clean exports remain unchanged.
- Template files, generated cards, Project persistence, and provider-owned data formats do not change.
- No compatibility adapters, duplicate editor implementations, or legacy re-export paths remain after the cut.
- Every new module has one named responsibility and stays under the 500-line review threshold unless it is a focused static catalog.
- Architecture violations may only decrease; the baseline must never accept a new violation.

---

## Target ownership

### Domain

- Template field definitions, contract validation, placeholder extraction policy, and generator/editor field interpretation.
- Pure template and element transformations that do not depend on React, browser APIs, or feature state.

### Template Editor session

- Draft hydration and autosave lifecycle.
- Initial/selected template resolution.
- Font bootstrap and font-face presentation data.
- Connection to `useTemplateEditorController`.

### Template Editor variables

- Active variable focus.
- Scoped rename, creation, removal, and structured-row commands.
- Field-contract upserts for the selected text element.

### Template Editor elements and layers

- Element creation, duplication, deletion, grouping, arrangement, alignment, flipping, and appearance recipes.
- Layer-tree state, drag/drop, checked groups, and selected-element capabilities.
- Asset-library compatibility and selected appearance/preset derivation.

### Template Editor viewport

- Zoom, auto-fit, grid/preview flags, mobile panel, canvas refs, pointer/touch/wheel/drop behavior, and viewport commands.

### Template Editor template commands

- Save/new/open/clone operations.
- Frame, custom dimensions, grid default, and template image upload commands.
- Global editor keyboard command routing.

### Presentation

- Top bar, library/layer sidebar, canvas stage, inspector sidebar, and shortcut legend compose explicit models and commands.
- Presentation does not read Project persistence or provider APIs.

---

## Implementation sequence

### Task 1: Define the clean cut in executable tests

- [x] Add a structural test that requires the focused hooks/components and the public client entry.
- [x] Require `CardTemplateMaker.tsx` to remain below 500 lines.
- [x] Require App Shell to import the editor only through `features/template-editor/client`.
- [x] Require shared field rules to live in Domain and prevent Card Generator from importing Template Editor internals.
- [x] Require retired editor-touched root helpers to be absent.

### Task 2: Move shared field policy to Domain

- [x] Move field-contract and template-field logic into `domain/templates`.
- [x] Update Template Editor, Generator, tests, and fixtures to import the Domain interface.
- [x] Delete the old feature-owned pure-policy files with no compatibility re-exports.
- [x] Remove the Template Editor → Card Generator cycle edge and corresponding baseline entries.

### Task 3: Retire editor-touched catch-all roots

- [x] Move frame kits and editor options under Template Editor ownership.
- [x] Split general text and CSV helpers into Shared and Card Generator owners, then delete `lib/utils`.
- [x] Split browser library bootstrap calls beside their consumers, then delete `lib/clientBootstrapData`.
- [x] Move the toast hook into the generic UI owner and update consumers in one clean cut.
- [x] Delete obsolete root constants after App Shell and Template Editor own their configuration.

### Task 4: Extract session lifecycle

- [x] Create a session hook that owns draft hydration/autosave, initial template resolution, fonts, and controller binding.
- [x] Keep the editor non-interactive until draft recovery resolves.
- [x] Add focused tests for selected-template precedence, draft recovery, clearing, and autosave initialization.

### Task 5: Extract variable commands

- [x] Create a variable hook for focus, scoped rename/create/remove, structured rows, and contract upserts.
- [x] Preserve conflict messaging, focus restoration, and rich-text content-model inference.
- [x] Keep variable refs private to the variable responsibility.

### Task 6: Extract element and layer commands

- [x] Create focused element and layer hooks with explicit controller command inputs.
- [x] Preserve safe placement, z-order, selection, locked-layer feedback, grouping, and drag/drop behavior.
- [x] Keep pure placement/transform calculations outside React where useful and cover them directly.

### Task 7: Extract viewport and command routing

- [x] Create a viewport hook for refs, zoom, auto-fit, pointer/touch/wheel/drop, grid, preview, and mobile state.
- [x] Create a template-command hook for save/new/open/clone/frame/dimension/upload actions.
- [x] Centralize keyboard routing against named commands without bypassing the controller.

### Task 8: Extract presentation composition

- [x] Create focused library/layer and inspector sidebar components.
- [x] Keep the existing canvas stage and editor panels as leaf components.
- [x] Reduce `CardTemplateMaker` to session + command composition under 500 lines.
- [x] Preserve responsive panel behavior, semantic labels, and test identifiers.

### Task 9: Close boundaries and publish

- [x] Export the supported lazy browser entry through `features/template-editor/client.ts`; App Shell no longer deep-imports editor internals and the Studio route remains code-split.
- [x] Regenerate a strictly smaller architecture baseline: 286 to 221 tracked violations, with size warnings reduced from 17 to 16.
- [x] Run focused editor tests, lint, typecheck, architecture check, the full unit suite (63 files / 396 tests), production build, diff check, and dependency audit. The Studio route stayed code-split and decreased to 16.5 kB / 556 kB first load; only the accepted nested Next/PostCSS advisory remains.
- [ ] Require hosted CI and Public smoke, squash merge, verify exact production deployment health/logs, and update live architecture/risk evidence.
