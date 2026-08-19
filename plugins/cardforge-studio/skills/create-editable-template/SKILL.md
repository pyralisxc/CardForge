---
name: create-editable-template
description: Create and review private editable CardForge Templates, then optionally continue an exact chosen Template into Forge Review.
---

# Create editable CardForge Templates

Use the CardForge Studio tools when the user wants an editable visual Template rather than a flattened image.

## Core composition rule

Keep the construction simple and native. Prefer three functional layers:

1. **Frame/background structure** — the selected frame kit, border art, texture, or native structural shapes that define the card's visual regions.
2. **Primary content** — the real main artwork in a native image element and any other required image/icon slots.
3. **Editable copy** — native text fields positioned inside the regions already provided by the frame.

When a frame or frame image already draws a title plate, rules box, stat region, or other visible boundary, do **not** add another decorative border around the text element inside it. Keep the text element transparent/borderless unless the user explicitly wants an additional panel.

## Artwork binding rule

A visible main-art region must be a native image element with a stable element id. For fixed generated or user-provided artwork, the production-plan asset must target that exact element id and be attached with `attach_template_artwork` using `binding: element.image`. For user-replaceable artwork, use a native image field contract instead.

Never treat successful upload as proof of correct placement. After attaching artwork, call `preview_template_draft` and verify that the intended image element shows the artwork rather than a placeholder or unrelated image.

## Workflow

1. Call `get_studio_creation_guide` before planning a new design, then gather the title, canvas size or physical format, visible copy, intended editable layers, and required fidelity from the user's request.
2. Search the CardForge library before inventing structure. If the user already selected or supplied a frame, treat that frame as the composition skeleton rather than recreating its boxes with extra shapes.
3. Inventory the meaningful visual slots. Decide which are frame/background structure, fixed produced artwork, user-replaceable image fields, and editable text.
4. Build the native Template with stable ids and explicit geometry. Text placed inside an existing framed region should normally use no element border and no opaque panel fill.
5. Do not invent campaign metadata, specialty tags, use-case tags, descriptions, preview URLs, or publication claims.
6. Call `create_editable_template` once for the accepted plan. Revise that same Studio document with `update_editable_template`; do not create a new cloud draft for ordinary layout, copy, style, or artwork revisions.
7. Attach every required fixed artwork asset to its planned native target with `attach_template_artwork`.
8. Call `preview_template_draft` after creation and after meaningful layout or artwork changes. Inspect the returned composition/binding diagnostics as well as the visual preview. Do not call the work complete while the intended art slot is still a placeholder, an asset targets the wrong element, or redundant borders obscure the selected frame.
9. Let the user open the approved revision in Studio. Agent revisions install into the same normal personal local Template; the private cloud Studio document remains only the working handoff document.
10. Use `list_editable_templates` before referring to an unknown document id. Use `get_editable_template` before discussing the contents of a saved draft.
11. Call `continue_template_in_pipeline` only when the user explicitly chooses the Studio document and wants a Forge Review draft. If the document contains multiple Templates, require the exact Template id.
12. Explain that the Pipeline handoff is still a draft. The developer completes missing review metadata in Forge Review, and only the CardForge owner can publish.

All access, watermark, export, developer, and publication gates remain owned and enforced by CardForge.
