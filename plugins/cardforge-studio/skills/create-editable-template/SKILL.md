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

CardForge normalizes raster Studio artwork to private WebP storage. An incoming individual raster attachment must be 2.4 MB or smaller before normalization and no source dimension may exceed 8192 px. Large transparent full-card frame PNGs are common failure candidates even when their width/height is reasonable; optimize them first rather than repeatedly retrying an oversized payload.

## Workflow

1. Use `get_cardforge_capabilities` when account tier/role matters, and `get_studio_creation_guide` when starting a new design or CardForge capabilities are unclear. If the user wants to resume earlier agent work without a known document id, use `list_agent_working_documents` before creating another draft.
2. Search the CardForge library before inventing a replacement for an existing frame, style, font, texture, divider, icon, or image.
3. Resolve the requested quality once, define the editable fields and meaningful visual slots, and create one accepted production plan.
4. Call `create_editable_template` once. Revise that same working document with `update_editable_template`; do not create another cloud draft for ordinary copy, layout, style, or artwork changes.
5. Attach required fixed artwork to its planned native targets, then call `preview_template_draft` after meaningful changes. Inspect the native exported PNG shown directly in chat; treat its separate revision-bound Studio URL as the editing handoff, not the visual preview.
6. Opening the approved revision installs or updates the same normal personal local Template; the private agent document is only the temporary working handoff. The handoff is revision-bound, so a newer revision of the same document may be applied without reloading the page. Use `get_agent_install_status` when you need evidence that the current server revision was actually acknowledged by Studio rather than merely written by the agent.
7. If that agent-linked Template is later explicitly saved in Template Studio, CardForge syncs the saved Template back to the same private working document when its revision is still current. When the user says they saved Studio changes, reload `get_editable_template` before making the next agent revision. If CardForge reports that the agent draft is newer, preserve the browser copy and reopen the latest CardForge preview instead of overwriting it.
8. This round trip applies only to the linked agent-created Template. Arbitrary browser-local Templates and local card/Set edits remain local-first unless the user uses CardForge's existing transfer or agent card/Set/cloud workflow.
9. If the user wants individual cards or a complete Set from the approved Template, continue with the CardForge card/Set skill rather than inventing CSV columns or card fields.
10. Use `continue_template_in_pipeline` only when the user explicitly wants to submit a Template to Forge Review. Publication is separate from normal personal card creation and requires the relevant developer/owner contribution scope.

All access, watermark, export, developer, and publication gates remain owned and enforced by CardForge.
