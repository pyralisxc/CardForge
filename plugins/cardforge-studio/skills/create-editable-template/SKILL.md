---
name: create-editable-template
description: Design and refine an editable CardForge Template with native fields, frame structure, and artwork, then hand the approved design to Studio or card-set generation.
---

# Design editable CardForge Templates

Use this skill when the user is designing the reusable visual structure of a card. Keep the work native, editable, and visually reviewable rather than flattening the design into an image.

## Core composition rule

Keep the construction simple:

1. **Frame/background structure** defines the card's visual regions.
2. **Primary artwork** lives in a real native image element.
3. **Editable copy** lives in native text fields inside the frame.

When a selected frame already draws a title plate, rules box, stat region, or other boundary, do **not** add another decorative border around the text inside it. Keep that text transparent and borderless unless the user explicitly wants another panel.

For fixed main art, target the intended image element and attach it with `attach_template_artwork` using `binding: element.image`. Never treat a successful upload as proof of placement; call `preview_template_draft` and verify the visible slot.

## Workflow

1. Use `get_studio_creation_guide` when starting a new design or when CardForge capabilities are unclear.
2. Search the CardForge library before inventing a replacement for an existing frame, style, font, texture, divider, icon, or image.
3. Resolve the requested quality once, define the editable fields and meaningful visual slots, and create one accepted production plan.
4. Call `create_editable_template` once. Revise that same working document with `update_editable_template`; do not create another cloud draft for ordinary copy, layout, style, or artwork changes.
5. Attach required fixed artwork to its planned native targets, then call `preview_template_draft` after meaningful changes. Inspect the native exported PNG shown directly in chat; treat its separate revision-bound Studio URL as the editing handoff, not the visual preview.
6. Opening the approved revision installs or updates the same normal personal local Template; the private cloud document is only the temporary working handoff.
7. If the user wants individual cards or a complete set from the approved Template, continue with the CardForge card/set skill rather than inventing CSV columns or card fields.
8. Use `continue_template_in_pipeline` only when the user explicitly wants to submit a Template to Forge Review. Publication is separate from normal personal card creation.

All access, watermark, export, developer, and publication gates remain owned and enforced by CardForge.
