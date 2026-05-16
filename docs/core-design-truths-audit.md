# CardForge 3rd-Party Audit: Core Design Truths and Pivot Guidance

Last updated: 2026-05-14
Audience: Product, design, and engineering leads
Purpose: Align roadmap decisions to user expectations for a Canva-like universal template creator with easy single/bulk generation and print output.

## 1. Executive assessment

CardForge already has a strong foundation for freeform template design, variable-driven generation, and export workflows. The product is not far from the target vision.

Current state:
- Strong in freeform layout power and variable extraction.
- Moderate in generator clarity and reliability.
- Weak in native-text-editor interaction depth and bulk documentation UX.

Primary recommendation:
- Do not pivot away from current architecture.
- Pivot the next milestones toward interaction model and content contract standardization:
  - richer text editing model (including right-click actions),
  - clearer bulk "contract + docs" flow,
  - one shared variable and formatting spec across maker, single, and bulk.

## 2. Core design truths (proposed)

These are the non-negotiable product truths the roadmap should protect.

1. Template is structure, data is payload.
- A template defines zones, styling, and variable bindings.
- Single and bulk generators only provide payload values.
- This keeps design reusable and batch-safe.

2. Variables are first-class, typed contracts.
- Every bindable element must declare a variable identity and capabilities (text, image, multiline, rich text).
- A card should fail early if required variable contracts are invalid.

3. One formatting language everywhere.
- Rich text behavior should be identical in maker preview, single generator, bulk preview, and final export.
- If a token works in one surface, it must work in all surfaces.
- If the entry surface is markup-based, a live formatted preview should sit next to it so users are not forced to read syntax alone.

4. Bulk is a production pipeline, not just a textarea.
- Bulk flow must be deterministic, inspectable, and self-documenting.
- Mapping and validation are core, not optional extras.

5. Print trust is a product promise.
- Export must protect users from quality surprises.
- Preflight guidance should happen before users commit to PDF/image output.

6. Power should feel easy.
- Advanced controls should exist without making first-run users feel lost.
- Progressive disclosure is required for a Canva-like expectation.

## 3. Expectation-to-reality audit

### 3.1 Universal Canva-like template creator

Status: Partially met

What is already strong:
- Freeform canvas editing with layered elements exists.
- Supports text/image/shape/icon elements and appearance presets.
- Element binding syntax is implemented for variable-driven text.

Gaps:
- Interaction model is still system-builder oriented, not creator-native.
- Keyboard + context interactions are limited for text editing tasks.
- The maker file size/complexity suggests maintainability risk as feature depth grows.

### 3.2 Easy custom generation and printing (single + bulk)

Status: Mostly met

What is already strong:
- Single and bulk generation both derive fields from template placeholders.
- Bulk includes automap, mapping editor, preview warnings, and strict mode gating.
- Export stack supports PDF and image output with print controls.

Gaps:
- Bulk onboarding still relies on user interpretation instead of explicit guided contract.
- Specialized text formatting in CSV is possible but not taught clearly enough in-app.
- Preflight quality feedback is present but still fragmented across surfaces.

### 3.3 Designated text/image variables per element

Status: Met at baseline, needs hardening

What is already strong:
- Placeholders are extracted from template content.
- Image fields are derived/bound and included in generated field definitions.
- Required field logic exists with overrides.

Gaps:
- No explicit variable schema editor yet (type, required, validation pattern, docs).
- Contract remains inferred from template content instead of intentionally authored metadata.

### 3.4 Specialized text zones (highlight/color/bold/etc.)

Status: Partially met

What is already strong:
- Rich text markers and toolbar-based helpers exist.
- Supports emphasis, underline, highlight, inline color, and lists.

Gaps:
- Rich text parser is a custom lightweight grammar and can diverge from user expectations for nested/complex formatting.
- No native right-click formatting menu behavior in textareas.
- Formatting discoverability for bulk CSV is still weak.

### 3.5 Native text-editor feel (including right-click)

Status: Not met

Current gap:
- There is no dedicated app-level right-click editing/context command system for formatting operations.
- Current interaction pattern is toolbar-first and marker syntax-first.

Impact:
- Users expecting Canva/native editors may perceive friction and reduced polish.

### 3.6 Bulk documentation and customization clarity

Status: Partially met

What is already strong:
- Quick-start prompts and example CSV generation exist.
- Preview and quick-fix loops are implemented.

Gaps:
- No single, explicit "template data contract" artifact users can download and validate against.
- Rich-text and multiline CSV handling rules are not taught as a first-class workflow.

## 4. Software gaps and tool gaps

### Software gaps

1. Variable contract authoring gap
- Missing explicit schema authoring surface for fields (type, required, default, validation, examples).

2. Rich text consistency gap
- Lightweight parser + marker language is useful, but not yet robust enough for advanced expectations.

3. Editor interaction gap
- Missing context menu and command model for text operations.

4. Maker maintainability gap
- Large maker component indicates increasing cost/risk for future UX expansion.

5. Contract portability gap
- No JSON Schema/contract export for external validation or pipeline integration.

### Tooling and process gaps

1. UX parity test gap
- No dedicated tests ensuring formatting parity across maker/single/bulk/export.

2. Accessibility automation gap
- Limited keyboard/context interaction tests for advanced editing flows.

3. Documentation artifact gap
- Bulk "how-to" exists in pieces, not as one canonical contract-driven guide.

## 5. Pivot recommendation

Decision: Controlled pivot, not architecture reset.

Reason:
- Core platform direction is correct.
- Risks are mostly experience, contract clarity, and interaction depth.

### 5.1 What to keep

- Freeform template architecture.
- Variable-driven single/bulk generation model.
- Strict-mode + preview warning philosophy.
- Print/export quality emphasis.

### 5.2 What to change now (next 4-8 weeks)

1. Introduce Field Contract v1
- Add explicit metadata per variable:
  - key, type (text/image/number/richText), required, default, multiline, allowed formatting, description, example.
- Render this contract as:
  - generator form config,
  - bulk mapping target list,
  - downloadable docs template.

2. Add Text Editing Command Layer
- Implement shared text command utilities for bold/italic/underline/highlight/color/list actions.
- Add right-click context menu support for textarea fields in maker and single generator.
- Reuse same command layer in bulk quick-fix cells where applicable.
- Prefer parent composed previews plus child variable editors in the generator so segmented text stays understandable.

3. Add Bulk Contract Docs Surface
- New panel in bulk flow:
  - required fields,
  - accepted formats,
  - rich-text examples,
  - multiline quoting examples,
  - downloadable sample CSV + contract JSON.

4. Add Parity and Regression Tests
- Golden tests for rich text rendering parity across surfaces.
- Interaction tests for context menu commands and keyboard-first flows.

### 5.3 What to defer

- Enterprise multi-user features.
- AI assistant expansion beyond contract/lint helpers.
- Deep collaboration workflows.

## 6. Product feel alignment with company expectation

Target feel:
- "Professional creator tool" (confidence + power) with "consumer-editor ease" (clarity + speed).

Current feel:
- Powerful and promising, but occasionally technical and workflow-heavy.

Design direction to close the gap:
- Make contracts visible and friendly.
- Replace syntax-memory burden with guided controls.
- Preserve advanced depth behind progressive disclosure.

## 7. Milestones and acceptance criteria

## Milestone A: Contract-first generation

Deliver:
- Field Contract v1 model and UI.
- Contract-driven single and bulk forms.

Accept when:
- 100% of generated fields come from explicit contract metadata (not inference only).
- Required-field failures are deterministic and clearly actionable.

## Milestone B: Native-feel text editing

Deliver:
- Shared command layer for text actions.
- Right-click context menu in supported text zones.

Accept when:
- Text operations are available by toolbar, keyboard shortcut, and context menu.
- Bulk and single text behavior match maker preview behavior.

## Milestone C: Bulk clarity and docs

Deliver:
- In-app bulk contract docs panel.
- Downloadable CSV + contract JSON examples.

Accept when:
- New users can complete first successful bulk generation in under 5 minutes using only in-app guidance.

## Milestone D: Trust and quality hardening

Deliver:
- Cross-surface formatting parity tests.
- Accessibility and workflow smoke coverage for core generation paths.

Accept when:
- No regressions in rich text behavior across maker/single/bulk/export in release validation.

## 8. Evidence sampled in current codebase

Product docs and roadmap context:
- README.md
- docs/blueprint.md
- docs/card-generator-roadmap.md

Key implementation surfaces reviewed:
- src/components/card-forge/CardTemplateMaker2.tsx
- src/components/card-forge/makerConstants.tsx
- src/components/card-forge/SingleCardGenerator.tsx
- src/components/card-forge/BulkGenerator.tsx
- src/lib/templateFields.ts
- src/lib/textBindings.ts
- src/lib/textTools.ts
- src/lib/utils.ts
- src/app/page.tsx

## 9. Discussion prompts for product leadership

1. Do we want to standardize on a markdown-like rich text contract, or move to structured rich text JSON for long-term reliability?
2. Should right-click text commands be limited to core actions first (bold/italic/underline/highlight/color), then expand later?
3. Do we want template authors to manually define field contracts, auto-generate then edit, or both?
4. What is the expected first-run success time target for bulk users?
5. Which trust metric matters most for launch readiness: output fidelity, error recoverability, or workflow speed?
