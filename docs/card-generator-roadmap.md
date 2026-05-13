# CardForge Card Generator Roadmap

Last updated: 2026-05-13

## Goal

Turn CardForge into a robust card generator with a simple default workflow, stronger bulk operations, and a cleaner contract between templates and generator data.

## Architectural Health Report

- [HEALTHY] Preview rendering pipeline: maker and preview now share the same rich-text renderer and text-style helpers.
- [CLEANUP] Generator UX contract: generator behavior still relies on field-name heuristics instead of explicit field capabilities.
- [EXTRACT] Template field analysis: placeholder extraction and generator field behavior are duplicated across generator surfaces.
- [REWRITE] Template text binding model: single-field bindings are too limiting for template-authored emphasis and sentence-level formatting.
- [FEATURE] Dataset management: saved data sets, naming rules, and batch editing are valuable, but they are not part of the initial refactor slice.

## Product Principles

- Easy mode first. Normal users should not need to learn markup syntax to succeed.
- Templates own presentation. Generators should focus on data entry and validation.
- Advanced controls stay available, but they should be progressive rather than mandatory.
- Single-card and bulk flows must follow the same field contract.

## Phases

### Phase 1 — Shared Field Schema

Status: In progress

- [EXTRACT] Introduce a shared template field-definition shape used by generator surfaces.
- [EXTRACT] Derive image, multiline, and rich-text capability from template usage instead of generator-local heuristics.
- [CLEANUP] Reuse the same field metadata in example CSV generation and field rendering.

### Phase 2 — Generator V2 (Single Card)

Status: In progress

- [CLEANUP] Replace guess-based field rendering with schema-driven controls.
- [FEATURE] Add inline help, syntax hints, and lightweight field previews for advanced rich-text fields.
- [CLEANUP] Separate basic editing from advanced formatting controls.

### Phase 3 — Bulk Generator V2

Status: In progress

- [CLEANUP] Move bulk generation toward an import-and-validate workflow.
- [CLEANUP] Add parsed table preview, row-level validation, and first-cards preview before generation.
- [CLEANUP] Make CSV examples schema-aware, including multiline quoted examples where relevant.

### Phase 4 — Template Expression Model

Status: In progress

- [REWRITE] Allow template-authored text expressions with multiple placeholders inside one text layer.
- [REWRITE] Preserve current fallback behavior while expanding template expressiveness.
- [REWRITE] Add regression tests before widening expression support.

### Sprint 1 — Shared Field Schema Foundation

Status: In progress

Goals:

- Create a shared template field-definition helper.
- Move single-card and bulk generators to the shared helper.
- Add focused unit coverage for field-definition extraction.

Completed:

- Roadmap document created.
- Shared template field-definition helper added.
- Single-card generator now uses the shared field schema.
- Bulk generator now uses the shared field schema.
- Focused unit tests and typecheck passed for the first extraction slice.
- Shared field schema now exposes richer editor hints and helper copy.
- Single-card generator now reuses the shared rich-text toolbar for multiline rich-text fields.
- Bulk CSV guidance now explicitly calls out multiline quoting and rich-text preservation.
- Maker inspector now supports explicit text binding modes: Field Binding and Template Expression.
- Template Expression mode uses the shared rich-text toolbar and preserves full text expressions.
- Unit coverage now verifies simple binding detection for safe mode switching.
- Bulk generator now includes a Preview & Validation panel that shows mapped sample rows before generation.
- Bulk preview now surfaces row-level warnings for missing mapped values.
- Shared field schema now defines explicit required/optional rules.
- Bulk preview validation now warns for missing required values and unmapped required template fields.
- Bulk preview now supports filter views: all rows, only rows needing fixes, and clean rows.
- Bulk preview now supports per-row quick fixes for missing required values, and fixes are carried into generation.
- Cleanup checkpoint: bulk generation now correctly skips unmapped CSV columns (matching preview warnings and mapping intent).
- Bulk mapping now defaults to an auto-match summary with optional Advanced Mapping controls.
- Optional Strict Mode now blocks generation until warnings are resolved when enabled.
- Focused unit coverage now verifies bulk auto-mapping, advanced mapping updates, and strict-mode gating logic.
- Browser smoke coverage now verifies advanced mapping visibility and strict-mode warning gating flow.
- Export profile selection is now available (Physical Print vs Virtual Export) and is persisted in app settings.
- PDF, single-card image export, and ZIP export now use shared export profiles for DPI/target render sizing.
- Export preflight validation now blocks critical quality issues and surfaces warning-level issues before export.
- Focused unit coverage now verifies print/virtual profile behavior and placeholder quality checks.
- Export DPI is now user-configurable with 300 DPI as the default baseline and 150/600 options.
- Missing required fields now generate warnings instead of hard blocks, while critical placeholder image issues can still block physical exports.
- Single-card image export now supports PNG, JPEG, WebP, and TIFF (best-effort with browser capability checks).
- Image field extraction/classification/rendering now share a single image-key contract, fixing missing image inputs for placeholder and fixed-source image layers.
- Physical-mode manual validation confirms image input visibility in Single Card Generator and successful Save as PDF action flow (button enters saving state and returns to ready state).

Next:

- Keep expanding the shared field schema toward explicit field capabilities instead of inferred-only hints.
- Add print-safe overlays (3mm bleed, 5mm safe area) and print-preview parity controls in preview surfaces.
- Add deeper print preflight checks for low-resolution source images and text-overflow risk.
- Run a final mobile-width QA pass to tighten layout density in bulk preview and quick-fix sections.