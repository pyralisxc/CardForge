# Rich Text Variable Authoring

Last updated: 2026-05-16

## Purpose

This document captures the intended authoring model for inline rich text variables in CardForge so Maker, Single, Bulk, preview, and export stay aligned.

## Current Product Direction

CardForge treats the `Text Editor` as the creator-facing surface for text elements. Its primary field is a Tiptap-powered visual rich text editor: static text and inline variable spans live in one flow, and formatting controls sit directly above that field.

Inline variables are element-scoped by default. A text element stays the parent container, and child variables fill the dynamic spans inside it.

Field cards below the expression are generator settings, not a second editor. They should show base/static fields and child variables for the selected element, infer their content model from context, and expose only field identity plus generator behavior such as required state and auto-fit.

## Generator Expectations

For segmented text elements, the generator should show:

1. Parent element context
   - element name
   - compact composed preview of the full text line/box

2. Field controls
   - base/static copy for the selected element when it is card-specific
   - one control per inline variable
   - labels based on variable names, not fallback sample text
   - required state, auto-fit state, and helper guidance

3. Rich text feedback
   - markup entry surface
   - live formatted preview right beside or directly below the entry surface

This keeps the generator readable while still exposing the real structure of the template.

## Preview and Export Expectations

Template preview is the only visual truth. The same `CardPreview` output should feed the Maker preview, generated card preview, PNG export, ZIP export, and PDF export so nested variables, rich text, auto-fit, fonts, images, and layout rules do not drift by surface.

For print and display standards:

- physical exports should default to production-grade 300 DPI or higher
- digital/display exports should stay at 96 DPI or higher
- browser-native exports are RGB; CMYK/PDF-X conversion belongs in a dedicated prepress step when a print vendor requires it
- export capture must wait for fonts and image assets before rasterizing
- PDF placement must use the same template aspect and physical-size calculations as image export

## Cleanup Rules

- Keep field defaults in `cardDataDefaults`, not copied into each form.
- Keep parent/child generator grouping in `GeneratorFieldGroups`, not rebuilt per screen.
- Keep text element contract, content-model, and auto-fit decisions in `textElementContracts` so Maker and preview do not drift.
- Single-card entry should focus on editing the current card. Bulk owns CSV contract downloads and the larger contract summary.
- Freeform UI should use element language, not section/row language. The launch build should not keep adapters for removed prototype fields; stored schema, visible controls, default templates, and tests should describe the current model only.

## Recommended Display Model

### Current

Use a visual editor backed by template-string serialization:

- highlighted text can become a variable from the toolbar
- created variables render as subtle outlined inline spans
- right-clicking a variable span reopens focused variable actions
- static text and variable spans share one writing surface
- generator rich text fields use the same editor component as Maker
- single-card entry, edit-card dialog, and bulk quick fixes use one shared generator field input so rich/rules fields do not drift into separate toolsets
- single-card entry and edit-card dialog use the same grouped field component so parent text elements and child variables render consistently

Why:
- matches expectations from Word, Canva, and Figma-style editors
- makes the template text look like the preview text
- keeps preview/export/generator aligned to one current authoring model

### Later

Adopt a structured segment model rather than raw-string templating as the primary visual source:

```ts
type TextSegment =
  | { type: "text"; text: string }
  | { type: "variable"; key: string; fallback: string };
```

For richer semantic text zones, allow a variable to carry structured rules blocks:

```ts
type RulesBlock = {
  kind: "ability" | "effect" | "reminder" | "flavor" | "subtitle" | "subtext";
  text: string;
};
```

## Non-Negotiable UX Rules

- Variable name is identity. Fallback text is sample content.
- Parent text context must stay visible when editing child variables.
- Mixed text elements should not lose their static body copy in generation; that body copy needs a first-class field when it is card-specific.
- Formatting controls belong directly above the text field being edited. Variable cards should not duplicate rich text style tools.
- The text toolbar should not present two competing versions of the same action. Layout controls such as size, alignment, and writing direction can sit beside inline rich-text controls, but bold/italic/underline/color should operate on the expression/selection rather than as separate variable-card overrides.
- Field content model should be inferred from context whenever possible. Avoid exposing a confusing editable `type` selector in the default variable card.
- Rich text must render consistently in Maker, Single, Bulk, preview, and export.
- Raw placeholder syntax is a serialization/debug format, not the default authoring experience.
- Auto-fit should preserve the authored appearance as long as possible, then shrink only as needed to fit the element bounds.
