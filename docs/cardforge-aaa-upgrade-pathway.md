# CardForge AAA Upgrade Pathway

## Product North Star

CardForge should become a premium fantasy/tabletop card authoring studio: Cameron supplies the high-quality art assets, and the platform makes those assets usable through a reliable canvas engine, a contract-first variable/template creator, and a clean local-first launch path.

The target is not a corporate design tool. The target is a serious fantasy game creator workflow where users can build what the previews promise.

## Agent Lanes

### Agent Ember: Canvas Engine

Owns selection, movement, delete, layer tree, grouping, undo/redo, hit testing, and canvas interaction quality.

Primary files:
- `src/components/card-forge/CardTemplateMaker.tsx`
- `src/features/template-editor/hooks/useCanvasPointerInteractions.ts`
- `src/features/template-editor/lib/layerTree.ts`
- `src/lib/freeformEditor.ts`
- future: `src/features/template-editor/lib/canvasCommands.ts`
- future: `src/features/template-editor/hooks/useTemplateEditorController.ts`

Current diagnosis:
- Canvas edits do not have one transaction boundary.
- Selection is UI state, not editor document state.
- Undo behavior differs by drag, keyboard, inspector, and layer actions.
- Layer model relies on raw `zIndex` and `parentId` without enough command-level rules.
- Hit testing is rectangular and simpler than the visual editor.

Target:
- A command-driven editor where all edits flow through semantic commands such as `addElement`, `deleteSelection`, `moveSelection`, `resizeSelection`, `groupSelection`, `reorderLayer`, and `setElementProps`.
- History stores document plus selection at command boundaries.
- Canvas rendering becomes mostly presentational.

### Agent Rune: Variable Forge

Owns template variables, text contracts, rich text, single-card data, bulk import, validation, and schema/export parity.

Primary files:
- `src/lib/templateFields.ts`
- `src/lib/textBindings.ts`
- `src/lib/richTextDocument.ts`
- `src/lib/textElementContracts.ts`
- `src/components/card-forge/CardForgeRichTextEditor.tsx`
- `src/components/card-forge/TextElementInspector.tsx`
- `src/components/card-forge/SingleCardGenerator.tsx`
- `src/components/card-forge/BulkGenerator.tsx`
- `src/lib/bulkGeneration.ts`

Current diagnosis:
- Variables are still partly placeholder-first instead of contract-first.
- Scoped variables can collide because some extraction maps are keyed only by `key`.
- Duplicating a text element does not cleanly duplicate or remap its scoped contracts.
- Single and Bulk expose slightly different field surfaces.
- Rich text is useful but still serialized through marker strings, which creates edge-case risk.

Target:
- Explicit `FieldContract v1` is the source of truth.
- Text editor shows variable tokens, while contracts hold type, label, required/default/example, validation, formatting allowance, and schema metadata.
- Single, Bulk, preview, edit dialog, PNG, ZIP, and PDF all consume the same contract model.

### Agent Vault: Asset And Platform

Owns premium asset ingestion, catalog navigation, project portability, account mockability, security gates, and release hygiene.

Primary files:
- `src/app/api/assets/route.ts`
- `src/lib/cardAssets.ts`
- `src/lib/partAssetCatalog.ts`
- `src/lib/projectDocument.ts`
- `src/features/template-editor/components/ElementLibraryPanel.tsx`
- `src/lib/accountEntitlement.ts`
- `src/app/api/account/entitlement/route.ts`
- `src/app/api/billing/checkout/route.ts`
- `README.md`
- `docs/release-checklist.md`

Current diagnosis:
- Texture/divider/part discovery is a good foundation.
- `public/card-assets/parts/` is scaffolded but not proven by real premium packs.
- Project import/export does not yet preserve custom part assets.
- Mock entitlement is possible through env settings, but there is no obvious tester-facing QA matrix.
- Dependency audit has unresolved Clerk/js-cookie and Next/PostCSS findings.
- A tracked user template conflicts with release hygiene expectations.

Target:
- Cameron can drop premium packs into `public/card-assets/parts/<pack>/` plus `data/assets/parts/<pack>/` sidecars and see them cleanly in the catalog.
- The product supports mock free/dev/paid testing before full Clerk setup.
- Release docs and audit state are truthful.

## Recommended Path

### Phase 1: Stabilize The Authoring Core

Goal: make the current editor feel reliable enough to continue building on.

1. Extract pure canvas commands into `src/features/template-editor/lib/canvasCommands.ts`.
2. Add `tests/unit/canvas-commands.test.ts`.
3. Move delete, duplicate, group, ungroup, arrange, and layer reorder rules out of `CardTemplateMaker.tsx`.
4. Define deterministic post-command selection behavior.
5. Prevent invalid layer parenting and descendant cycles.
6. Make lock/delete policy explicit.

Success checks:
- Unit tests cover delete selection, duplicate with descendants, group/ungroup, layer reorder, locked selection, and next-selection rules.
- Existing smoke test for click/drag/delete remains green.
- Undo does not become worse.

### Phase 2: Create The Editor Controller

Goal: stop canvas systems from playing over each other.

1. Add `src/features/template-editor/hooks/useTemplateEditorController.ts`.
2. Route canvas, layer panel, inspector, and keyboard actions through one dispatch path.
3. Store active face, selected element, checked layers, and document changes together where command behavior needs them.
4. Define transaction modes: immediate, transient drag, commit-on-blur, commit-on-slider-end.
5. Make undo/redo restore document plus selection.

Success checks:
- Drag creates one undo entry only when movement occurs.
- Inspector edits are undoable.
- Keyboard nudges are predictable.
- Delete/undo restores the deleted element and selection.

### Phase 3: Contract-First Variable Forge

Goal: make the template/variable creator feel like a premium product, not syntax editing.

1. Make `fieldContracts` authoritative while preserving migration from current placeholders.
2. Fix scoped variable key collisions.
3. Duplicate text elements with clean copied/remapped contracts.
4. Decide one rule for static/base text in Single and Bulk, then make both match.
5. Upgrade the variable settings UI into explicit contract cards.

Success checks:
- Tests cover duplicate scoped variables, rename collisions, remove-variable-keep-text, Single/Bulk parity, and rich text combined marks.
- User can create a variable, rename it, type it, generate it in Single, and import it in Bulk without touching placeholder syntax.

### Phase 4: Premium Asset Pack Readiness

Goal: let Cameron's real premium art become the product's customization engine.

1. Add the first human-made premium parts pack with sidecars.
2. Test discovery, role filtering, default dimensions, and insert behavior.
3. Decide whether custom project parts are portable. If yes, extend project document custom assets beyond textures/dividers.
4. Add a catalog QA checklist for required metadata: role, dimensions, targets, display name, pack grouping, and insert defaults.

Success checks:
- `/api/assets` returns parts with roles and defaults.
- Asset Catalog can search/filter/insert real premium parts.
- A project using premium parts survives save/import when the product requires portability.

### Phase 5: Launch Hardening

Goal: remove “is this broken?” uncertainty before real users.

1. Resolve or formally document the Clerk/js-cookie audit finding.
2. Track the framework-pinned Next/PostCSS audit status honestly.
3. Add mock entitlement QA matrix: no Clerk, free, dev, paid, Clerk signed out, Clerk allowlisted.
4. Harden account/billing API routes with JSON error boundaries.
5. Remove or intentionally reclassify tracked local user templates and runtime logs.
6. Rename package metadata from `nextn` to `cardforge`.

Success checks:
- `npm run test`, `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run smoke` pass.
- `npm audit --omit=dev` status is resolved or has an explicit release decision.
- Release checklist reflects reality.

## Execution Recommendation

Do not start with more visual assets or landing-page polish. Start with Phase 1 and Phase 2 so the product can actually support Cameron's premium assets.

Best immediate slice:

1. Extract `canvasCommands.ts`.
2. Add command tests for delete, duplicate, group, reorder, and locked selection.
3. Wire `CardTemplateMaker` to use those commands while preserving the current UI.
4. Then introduce `useTemplateEditorController`.

That gives the whole platform a sturdier spine before deeper variable and asset work.

## Progress Log

### 2026-05-21: Phase 1 Ember Command Checkpoint

Implemented:
- Added `src/features/template-editor/lib/canvasCommands.ts` as the first pure canvas command boundary.
- Added `tests/unit/canvas-commands.test.ts` for delete, locked delete refusal, locked descendant protection, duplicate with descendants, group, ungroup, layer reorder, arrange, and keyboard nudge behavior.
- Routed `CardTemplateMaker` group, ungroup, duplicate, layer drop, delete, arrange, and keyboard nudge actions through the command layer.
- Locked descendant policy is explicit: deleting a group refuses when one of its descendants is locked.

Next:
- Start the `useTemplateEditorController` extraction so command dispatch, selection, history, and transient drag commits have one owner.
- Decide whether pointer drag/resize should move from interaction hook math into command objects during Phase 2 or stay as controller-managed transient operations.

### 2026-05-21: Phase 2 Ember Controller Checkpoint

Implemented:
- Added `src/features/template-editor/lib/templateEditorState.ts` as the pure editor state model for template, active face, selected element, undo history, and redo future.
- Added `src/features/template-editor/hooks/useTemplateEditorController.ts` as the React owner for editor document state, selection, checked layers, active face, canvas updates, and command dispatch.
- Updated `CardTemplateMaker` to consume the controller instead of owning document history, face state, selected element state, checked layer state, and command wiring locally.
- Undo/redo now restores template, active face, and selected element together at the editor state level.
- Added smoke coverage that deletes a selected canvas element, undoes, and verifies the restored element is selected again.

Next:
- Decide whether pointer drag/resize should become command objects or remain transient operations managed by the interaction hook.
- Move more field-contract/variable editing mutations into controller-level transactions before starting Rune Phase 3.

### 2026-05-21: Phase 3 Rune Contract Checkpoint

Implemented:
- Added scoped field data keys so same-named variables can be edited per text element when contracts intentionally scope them by `elementId`.
- Updated text resolution and card text rendering to prefer scoped field data before falling back to shared placeholder keys.
- Updated template field extraction so scoped contracts with the same placeholder key stay separate in Single/Bulk field definitions instead of collapsing into one field.
- Added duplicate contract remapping for copied text elements: scoped contracts are copied to the new element, copied placeholder keys are renamed, and the original variable remains independent.
- Extended command duplicate results with an original-to-copy id map so higher-level template behavior can remap contracts without guessing.

Next:
- Upgrade the variable editor UI copy and controls so users see scoped variables as first-class contract cards rather than placeholder syntax.
- Add richer validation and collision repair tools for imported/legacy templates that already contain ambiguous shared placeholders.
