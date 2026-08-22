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

Artwork source limits are real workflow constraints. One incoming artwork source must be 2.4 MB or smaller before normalization; one card-write operation may contain at most 64 artwork files and 32 MB aggregate input. Prefer optimized PNG/JPEG/WebP or a public HTTPS source URL. Large transparent full-card frames are especially likely to need optimization before attachment.

## Existing cloud Set workflow

When the user says things such as “my saved Set”, “the Set I backed up”, “the one I made on my other device”, or otherwise asks the agent to work on account cloud content:

1. Call `list_cloud_sets` instead of guessing what exists.
2. Call `get_cloud_set` for the intended Set and note its exact cloud revision. Page through cards when necessary.
3. For reading only, stop there. For edits, call `checkout_cloud_set` at that revision. This creates a private agent working document while leaving the cloud save unchanged.
4. Use the normal exact-contract card/Set tools on that working document.
5. Call `preview_card_set` after meaningful changes. Inspect both the structural artwork diagnostics and the native CardForge-rendered representative cards shown in chat.
6. If the user wants the permanent cloud Set updated, call `commit_cloud_set` with both the exact working-document revision and the original/current cloud revision. CardForge refuses stale commits rather than overwriting newer cloud work.
7. Use `delete_cloud_set` only when the user explicitly asks to remove the account cloud save. It requires the exact cloud revision and does not delete browser-local copies.

Do not describe a checkout as a cloud update, and do not describe a successful agent document write as visible in Studio until the exact revision has been applied there.

## Exact-contract and identity rule

Before making or revising cards in an agent working document, call `get_card_generation_contract`. Never guess card columns or image keys. Use only returned front/back fields, required fields, and image field keys.

For **new cards**, `writeMode: create` is preferred when duplicates would be harmful. CardForge can derive a deterministic id when a new card omits `cardId`, but the returned id becomes the identity for every later change.

For **existing cards**, use `writeMode: revise` and provide every current stable `cardId`. Revision mode fails if an id is missing or does not exist instead of silently creating a replacement. This is the preferred bulk-edit path for an existing Set.

When the connector reloads or a write response is lost, do not create replacements. Reload the current document/contract/Set preview and retry with the same Set and card ids.

## Card and Set workflow

1. For a new concept, create or revise the working Set with `upsert_card_set`. Reuse the returned stable Set id.
2. Call `get_card_generation_contract` and inspect all text and image fields before writing cards.
3. For an existing Set revision, call `preview_card_set` first to obtain the current stable card ids. Use one `upsert_cards` call with `writeMode: revise` for a bounded multi-card update instead of creating new copies and cleaning duplicates afterward.
4. For a new multi-card concept, a small representative sample is useful only while the Template/visual contract is unproven. Once verified, generate the requested full Set without unnecessary approval loops.
5. Put per-card artwork in the same card object's `artwork` array using an exact contract image field key. Prefer a generated/uploaded public HTTPS `sourceUrl`; use bounded raw base64 only when no URL is available.
6. Use `move_cards`, `delete_cards`, and `delete_card_set` for ordinary maintenance rather than recreating Sets. `delete_card_set` refuses a non-empty Set unless `deleteCards: true` is explicitly used after the user asks for that destructive result.
7. Call `preview_card_set` after meaningful generation, artwork, or cleanup changes. Structural diagnostics are not sufficient proof: inspect the native rendered cards in the preview.
8. Open the exact returned Studio revision to apply/update the normal local Template, Set, and cards. Finished card work opens in **Sets**, not Make Cards.
9. When needed, call `get_agent_install_status` to distinguish “revision exists on the server” from “this exact revision has been acknowledged as applied by Studio.” Never tell the user a revision is visible locally without that evidence.
10. In CardForge Studio, users can continue editing, export finished media, transfer editable CardForge files, and explicitly manage cloud Sets. Do not invent a parallel transfer format in chat.

If CardForge reports a working-document or cloud revision conflict, reload the current state and retry the intended operation with the new expected revision while preserving stable identities. Never choose a winner silently.
