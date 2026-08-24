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

For fixed main art, target the intended native image element with `binding: element.image`. Prefer `attach_template_artworks` when more than one asset or target is changing; it normalizes and binds the complete batch in one revision. `attach_template_artwork` remains supported for a single legacy attachment. Never treat storage success as proof of visual health: after a meaningful Template change, call `preview_template_draft` to verify placement and decode/render health through the canonical CardForge renderer. Keep its rendered image as visual evidence and its separate revision-bound Studio URL as the exact handoff/navigation target.

CardForge normalizes raster Studio artwork to private WebP storage. An incoming individual raster attachment must be 2.4 MB or smaller before normalization and no source dimension may exceed 8192 px. Large transparent full-card frame PNGs are common failure candidates even when their width/height is reasonable; optimize them first rather than repeatedly retrying an oversized payload. PNG, JPEG, and WebP are decoded and normalized through the same server path before storage.

## Efficient revision workflow

For an existing agent working document, prefer **read once → atomic sparse patch → cheap validation → selective canonical render → final canonical render**.

- Load the current working document once at the start and retain its exact revision plus stable Template/element/Set/card ids.
- Use `patch_working_document` for ordinary multi-part revisions. Patch only changed Template metadata, element properties, field contracts, cards, or Template artwork. Do not resend the full production plan/freeform canvas merely to move or restyle existing elements.
- Give important mutations an `operationId`. If the client times out, call `get_working_document_operation_status` before retrying. A committed receipt means do not repeat the mutation.
- Do not reread after a successful atomic patch merely to learn its new revision; the mutation response is authoritative. Reread only for a revision conflict, a lost/ambiguous response that cannot be reconciled by operation status, or state genuinely omitted from the mutation result.
- Use `validate_working_document` after compound edits when structural confidence is useful. It is intentionally cheap and does not launch Chromium. It does not replace canonical visual validation.
- During iteration, use `preview_cards` for changed/representative cards when a Set already exists, or `preview_template_draft` when the Template itself must be visually reviewed. Avoid repeatedly rendering the entire Set for each small correction.
- Run the full canonical Set preview once at the important final review/milestone. Canonical CardForge rendering remains the visual source of truth.

## Workflow

1. Use `get_cardforge_capabilities` when account tier/role matters, and `get_studio_creation_guide` when starting a new design or CardForge capabilities are unclear. If the user wants to resume earlier agent work without a known document id, use `list_agent_working_documents` before creating another draft.
2. Search the CardForge library before inventing a replacement for an existing frame, style, font, texture, divider, icon, or image.
3. Resolve the requested quality once, define the editable fields and meaningful visual slots, and create one accepted production plan.
4. Call `create_editable_template` once for a genuinely new design. Revise that same stable working document; for modern sparse revisions prefer `patch_working_document`, while `update_editable_template` remains supported for whole-template replacement workflows.
5. Batch required fixed artwork when possible, structurally validate after compound mutations, then use selective/canonical preview at meaningful milestones instead of after every granular write.
6. Opening the approved revision installs or updates the same normal personal local Template; the private agent document is only the temporary working handoff. The handoff is revision-bound, so a newer revision of the same document may be applied without reloading the page. Use `get_agent_install_status` when you need evidence that the current server revision was actually acknowledged by Studio rather than merely written by the agent.
7. If that agent-linked Template is later explicitly saved in Template Studio, CardForge syncs the saved Template back to the same private working document when its revision is still current. When the user says they saved Studio changes, reload `get_editable_template` before making the next agent revision. If CardForge reports that the agent draft is newer, preserve the browser copy and reopen the latest CardForge preview instead of overwriting it.
8. This round trip applies only to the linked agent-created Template. Arbitrary browser-local Templates and local card/Set edits remain local-first unless the user uses CardForge's existing transfer or agent card/Set/cloud workflow.
9. If the user wants individual cards or a complete Set from the approved Template, continue with the CardForge card/Set skill rather than inventing CSV columns or card fields.
10. Use `continue_template_in_pipeline` only when the user explicitly wants to submit a Template to Forge Review. Publication is separate from normal personal card creation and requires the relevant developer/owner contribution scope.

## Safety invariants

Efficiency never weakens CardForge's identity/revision rules. Reuse stable Template/Set/card/element ids, keep exact `expectedRevision` checks, never create replacement objects to work around a stale write, and never claim that a server revision is installed in the browser without installation evidence.

All access, watermark, export, developer, and publication gates remain owned and enforced by CardForge.
