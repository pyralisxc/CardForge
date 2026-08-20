---
name: create-editable-template
description: Create and review private editable CardForge Templates, then use their native contracts to create individual cards or complete sets.
---

# Create editable CardForge Templates and sets

Use the CardForge Studio tools when the user wants an editable visual Template or wants to turn an approved Template into real cards rather than a flattened image.

## Core composition rule

Keep the construction simple and native. Prefer three functional layers:

1. **Frame/background structure** — the selected frame kit, border art, texture, or native structural shapes that define the card's visual regions.
2. **Primary content** — the real main artwork in a native image element and any other required image/icon slots.
3. **Editable copy** — native text fields positioned inside the regions already provided by the frame.

When a frame or frame image already draws a title plate, rules box, stat region, or other visible boundary, do **not** add another decorative border around the text element inside it. Keep the text element transparent/borderless unless the user explicitly wants an additional panel.

## Artwork binding rule

A visible main-art region must be a native image element with a stable element id. For fixed generated or user-provided artwork, the production-plan asset must target that exact element id and be attached with `attach_template_artwork` using `binding: element.image`. For user-replaceable artwork, use a native image field contract instead.

Never treat successful upload as proof of correct placement. After attaching artwork, call `preview_template_draft` and verify that the intended image element shows the artwork rather than a placeholder or unrelated image.

## Card and set rule

A Template is the reusable design. A card is one filled instance. A set is a named local collection of cards with a default front Template and optional matching back.

Before inventing card keys, CSV columns, or image-field names, call `get_card_generation_contract`. It returns the exact Template fields and the same bulk contract used by CardForge Studio.

Use `upsert_card_set` once to create or revise the working set. Use `upsert_card` for one card and `upsert_cards` for a bounded bulk pass. Stable set/card ids revise the same objects; ordinary revisions must not create duplicate cloud documents or duplicate local copies. Use `attach_card_artwork` only with image field keys returned by the contract. Finish with `preview_card_set`, then let the user open that exact revision in Studio for visual review and local installation.

## Workflow

1. Call `get_studio_creation_guide` before planning a new design, then gather the title, canvas size or physical format, visible copy, intended editable layers, and required fidelity from the user's request.
2. Search the CardForge library before inventing structure. If the user already selected or supplied a frame, treat that frame as the composition skeleton rather than recreating its boxes with extra shapes.
3. Inventory the meaningful visual slots. Decide which are frame/background structure, fixed produced artwork, user-replaceable image fields, and editable text.
4. Build the native Template with stable ids and explicit geometry. Text placed inside an existing framed region should normally use no element border and no opaque panel fill.
5. Do not invent campaign metadata, specialty tags, use-case tags, descriptions, preview URLs, or publication claims.
6. Call `create_editable_template` once for the accepted plan. Revise that same Studio document with `update_editable_template`; do not create a new cloud draft for ordinary layout, copy, style, artwork, card, or set revisions.
7. Attach every required fixed Template artwork asset to its planned native target with `attach_template_artwork`.
8. Call `preview_template_draft` after creation and after meaningful layout or artwork changes. Inspect the returned composition/binding diagnostics as well as the visual preview.
9. When the user wants cards, create/revise the set with `upsert_card_set`, load `get_card_generation_contract`, then use `upsert_card` or `upsert_cards`. Never fabricate field keys that are absent from the contract.
10. Attach per-card image assets with `attach_card_artwork` using the real image field key and stable card id.
11. Call `preview_card_set` after meaningful individual or bulk generation. Resolve missing or invalid data before saying the set is complete.
12. Let the user open the approved revision in Studio. Agent revisions install into the same normal personal local Template, set, and cards; the private cloud Studio document remains only the working handoff document.
13. Use `list_editable_templates` before referring to an unknown document id. Use `get_editable_template` before discussing the contents of a saved draft.
14. Call `continue_template_in_pipeline` only when the user explicitly chooses the Studio document and wants a Forge Review draft. The Pipeline is for Template publication, not for personal card/set storage.

All access, watermark, export, developer, and publication gates remain owned and enforced by CardForge.
