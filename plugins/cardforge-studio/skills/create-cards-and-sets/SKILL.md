---
name: create-cards-and-sets
description: Create or revise CardForge card sets, individual cards, bulk card lists, and per-card artwork from an approved editable Template, or inspect sets the linked account intentionally saved to CardForge cloud storage.
---

# Create CardForge cards and sets

Use this skill when the user wants actual card instances: one card, a deck/set, bulk generation from a list, unique artwork across cards, or to continue from a set they already cloud-saved in CardForge. The reusable Template stays separate from the card data.

## Core model

- **Template** = reusable visual design.
- **Card** = one filled instance of that design.
- **Set** = a named collection of cards using a front Template and optional compatible back.
- **Cloud-saved Set** = one set the signed-in user explicitly backed up to an account cloud slot so it can be restored across devices and discovered by CardForge's ChatGPT integration.
- **Project** = the complete local CardForge workspace.

CardForge remains local-first: local Templates, sets, cards, and project state can exist without cloud saving. Cloud visibility is explicit and bounded by account slots. A private mutable Studio working document is the agent collaboration/revision layer; it is not the permanent cloud-set library.

## Artwork and assembly rule

Image generation creates standalone artwork assets only. Never generate a flattened finished card as a substitute for CardForge assembly. Once standalone artwork exists, return control to CardForge: the Studio Template, card data, renderer, and set workflow assemble the finished card.

## Saved-set discovery

When the user says things such as "my saved set", "the set I backed up", "the one I made on my other device", or expects CardForge to remember a set without providing a working-document id:

1. Call `list_cloud_sets` instead of guessing what exists.
2. If the intended set is clear, call `get_cloud_set` with its stable set id. A normal 52-card set fits in the default card page; use `cardOffset` to continue larger sets.
3. Treat the result as read-only permanent library state. Do not claim to have changed the cloud save through these tools.
4. Browser-only sets are intentionally invisible to ChatGPT until the user backs them up in CardForge Studio.

## Exact-contract rule

Before making or revising cards in a private agent working document, call `get_card_generation_contract`. Never guess card columns or image keys. Use only the returned front/back fields, required fields, and image field keys.

When the connector reloads or a write response is lost, do not create replacements. Reload the current document/contract revision and retry with the **same set id and card ids**.

## Workflow

1. Create or revise the working set with `upsert_card_set`. Give a stable `setId` when practical and reuse the returned set id on every later write.
2. Call `get_card_generation_contract` and inspect all text and image fields before generating anything.
3. For a new multi-card concept, prefer a small representative sample first when visual correctness is still unproven; once the Template/contract is verified, generate the requested full set without unnecessary extra approval loops.
4. Use `upsert_card` for one card or `upsert_cards` for up to 100 cards. Give each planned card a stable `cardId` when practical and reuse the returned ids for revisions and retries. Put per-card artwork in the same card object's `artwork` array using an exact contract image field key. Prefer a generated/uploaded public HTTPS `sourceUrl`; use bounded raw base64 only when no URL is available.
5. Call `preview_card_set` after meaningful generation/artwork changes. Check the explicit artwork diagnostics: distinguish privately resolved artwork, renderable references, unresolved values, Template fallback, and placeholder use.
6. Open the exact returned Studio revision to install or update the same normal local Template, set, and cards.
7. In CardForge Studio, users can export finished media, export/import an editable individual card or set as CardForge JSON, or explicitly back up selected sets to their account cloud slots. Do not invent a parallel transfer format in chat.

If CardForge reports a revision conflict, reload the current working document or generation contract and retry the intended operation with the new `expectedRevision` and the same stable identities.
