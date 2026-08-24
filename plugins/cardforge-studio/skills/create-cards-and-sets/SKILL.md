---
name: create-cards-and-sets
description: Create, revise, organize, visually review, and cloud-sync CardForge Sets, cards, and per-card artwork from an approved editable Template.
---

# Create and revise CardForge cards and Sets

Use this skill when the user wants actual card instances: one card, a deck/Set, bulk generation from a list, unique artwork across cards, cleanup/reorganization, or collaborative work on a Set they saved to CardForge cloud. The reusable Template stays separate from card data.

## Core model

- **Template** = reusable visual design.
- **Card** = one filled instance of that design with a stable card id.
- **Set** = a named collection of cards using a front Template and optional compatible back.
- **Cloud-saved Set** = one Set the signed-in user explicitly saved to an account cloud slot so CardForge and the linked agent can continue it across devices.
- **Agent working document** = a private revisioned collaboration copy used for agent edits and exact Studio handoff. A successful agent write changes this document, not the browser workspace or permanent cloud Set automatically.
- **Project** = the complete local CardForge workspace.

CardForge remains local-first, but cloud Sets are a deliberate agent-collaboration surface as well as cross-device backup. Browser-only Sets remain private to that device until the user explicitly saves them to CardForge cloud or transfers them through an existing CardForge workflow.

## Capability rule

Use `get_cardforge_capabilities` when the account tier, cloud capacity, developer/owner role, or allowed workflow matters. Normal signed-in customers can use private Studio/card/cloud collaboration tools. Forge Review, shared-library publication, and owner operations remain separately scope-gated; never imply higher privileges merely because those capabilities exist in CardForge.

When continuing prior agent work without a known document id, use `list_agent_working_documents` before creating another draft.

## Artwork and assembly rule

Image generation creates standalone artwork assets only. Never generate a flattened finished card as a substitute for CardForge assembly. Once standalone artwork exists, return control to CardForge: the Studio Template, card data, renderer, and Set workflow assemble the finished card.

Artwork source limits are real workflow constraints. One incoming artwork source must be 2.4 MB or smaller before normalization; one mutation may contain at most 64 artwork files and 32 MB aggregate input. Prefer optimized PNG/JPEG/WebP or a public HTTPS source URL. CardForge decodes and normalizes all accepted raster formats, including WebP, before private storage. Large transparent full-card frames are especially likely to need optimization before attachment.

Storage success is not visual proof. Private/reference diagnostics establish that data can be resolved; canonical CardForge rendering establishes whether it actually decodes and renders correctly.

## Existing cloud Set workflow

When the user says things such as “my saved Set”, “the Set I backed up”, “the one I made on my other device”, or otherwise asks the agent to work on account cloud content:

1. Call `list_cloud_sets` instead of guessing what exists.
2. Call `get_cloud_set` for the intended Set and note its exact cloud revision. Page through cards when necessary.
3. For reading only, stop there. For edits, call `checkout_cloud_set` at that revision. This creates a private agent working document while leaving the cloud save unchanged.
4. Read the working state/contract once, retain its stable ids, and use the efficient revision workflow below.
5. Use selective canonical rendering while iterating and `preview_card_set` once at final/important review. The full contact sheet is composed only from canonical CardForge-rendered cards; it is not a separate Template interpretation.
6. If the user wants the permanent cloud Set updated, call `commit_cloud_set` with both the exact working-document revision and the original/current cloud revision. CardForge refuses stale commits rather than overwriting newer cloud work.
7. Use `delete_cloud_set` only when the user explicitly asks to remove the account cloud save. It requires the exact cloud revision and does not delete browser-local copies.

Do not describe a checkout as a cloud update, and do not describe a successful agent document write as visible in Studio until the exact revision has been applied there.

## Exact-contract and identity rule

For an unfamiliar Template/Set, call `get_card_generation_contract` once before writing fields. Never guess card columns or image keys. Reuse that known contract while the Template contract is unchanged; do not reload it after every successful card mutation. On revisions and retries, reuse the same Set and card ids rather than creating replacement identities.

For **new cards**, `writeMode: create` is preferred when duplicates would be harmful. CardForge can derive a deterministic id when a new card omits `cardId`, but the returned id becomes the identity for every later change.

For **existing cards**, prefer `patch_cards` when changing only selected fields. It requires stable `cardId`, has no card-creation path, distinguishes explicit `unsetFields` from unchanged fields, commits the batch in one revision, and preserves unrelated legacy/orphaned stored values with warnings. Existing `upsert_cards` with `writeMode: revise` remains supported for whole-card/contract-shaped revisions and still fails rather than silently creating a replacement card when an id is missing or stale.

When the connector reloads or a mutation response is lost, do not create replacements and do not blindly retry. If the mutation had an `operationId`, call `get_working_document_operation_status`; a committed receipt is terminal. Otherwise reload the current revision once and reconcile stable ids before deciding whether a retry is necessary.

## Efficient revision workflow

For ordinary existing Template/Set/card edits, optimize for:

**read once → atomic sparse patch → cheap validation → selective canonical render → final full canonical render**

1. Load the current working document/contract once and retain exact revision plus stable Template, Set, card, and element ids.
2. Use `patch_working_document` when one user request spans Template layout/metadata, multiple existing cards, and/or multiple Template artwork bindings. One valid call should commit all changes as one revision or none.
3. Use `patch_cards` for a card-only sparse batch. Do not reconstruct unchanged card payloads.
4. Use `attach_template_artworks` for multiple fixed Template assets instead of one revision per image.
5. Give important mutations an `operationId`. Reconcile timeouts with `get_working_document_operation_status` before any retry.
6. Use `validate_working_document` for cheap structural checks after compound edits. It does not launch Chromium and does not replace visual review.
7. Use `preview_cards` with changed or representative stable card ids during iteration to inspect native CardForge-rendered representative cards. Do not render the full Set after every small correction.
8. Use `preview_card_set` once at a meaningful final/milestone review to inspect the canonical contact sheet and Set-wide diagnostics.
9. Reread only on revision conflict, irreconcilable lost response, a Template contract change that requires new field knowledge, or when a mutation result genuinely omitted state needed for the next step.

A normal request such as “move these medallions under the frame, update their artwork, preserve the nine cards, and verify it” should generally be one initial read, one compound mutation, optional cheap validation, one selective canonical preview, and one final full Set preview—not repeated full-template resends and rereads.

## Card and Set workflow

1. For a genuinely new concept, create or revise the working Set with `upsert_card_set`. Reuse the returned stable Set id.
2. Call `get_card_generation_contract` once and inspect all text and image fields before the first card write or after a Template contract change.
3. For a new multi-card concept, a small representative sample is useful only while the Template/visual contract is unproven. Once verified, generate the requested full Set without unnecessary approval loops.
4. Put per-card artwork in the same card object's `artwork` array when using `upsert_card(s)`, using an exact contract image field key. Prefer a generated/uploaded public HTTPS `sourceUrl`; use bounded raw base64 only when no URL is available.
5. Use `move_cards`, `delete_cards`, and `delete_card_set` for ordinary maintenance rather than recreating Sets. `delete_card_set` refuses a non-empty Set unless `deleteCards: true` is explicitly used after the user asks for that destructive result.
6. Use selective preview during revision work, then full `preview_card_set` for final Set review. Structural diagnostics alone are not sufficient visual proof.
7. Open the exact returned Studio revision to apply/update the normal local Template, Set, and cards. Finished card work opens in **Sets**, not Make Cards.
8. When needed, call `get_agent_install_status` to distinguish “revision exists on the server” from “this exact revision has been acknowledged as applied by Studio.” Never tell the user a revision is visible locally without that evidence.
9. In CardForge Studio, users can continue editing, export finished media, transfer editable CardForge files, and explicitly manage cloud Sets. Do not invent a parallel transfer format in chat.

If CardForge reports a working-document or cloud revision conflict, reload the current state and retry the intended operation with the new expected revision while preserving stable identities. Never choose a winner silently.
