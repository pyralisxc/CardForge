---
name: create-cards-and-sets
description: Create or revise CardForge card sets, individual cards, bulk card lists, and per-card artwork from an approved editable Template.
---

# Create CardForge cards and sets

Use this skill when the user wants actual card instances: one card, a deck/set, bulk generation from a list, or unique artwork across cards. The reusable Template stays separate from the card data.

## Core model

- **Template** = reusable visual design.
- **Card** = one filled instance of that design.
- **Set** = a named local collection of cards using a front Template and optional compatible back.
- **Project** = the complete CardForge workspace.

Normal personal work is local-first. The agent may edit one private mutable Studio working document, but approved Templates, sets, and cards install into the user's normal local CardForge workspace rather than a second cloud library.

## Exact-contract rule

Before making cards, call `get_card_generation_contract`. Never guess card columns or image keys. Use only the returned front/back fields, required fields, and image field keys.

When the connector reloads or a write response is lost, do not create replacements. Reload the current document/contract revision and retry with the **same set id and card ids**.

## Workflow

1. Create or revise the working set with `upsert_card_set`. Give a stable `setId` when practical and reuse the returned set id on every later write.
2. Call `get_card_generation_contract` and inspect all text and image fields before generating anything.
3. For a new multi-card concept, prefer a small representative sample first when visual correctness is still unproven; once the Template/contract is verified, generate the requested full set without unnecessary extra approval loops.
4. Use `upsert_card` for one card or `upsert_cards` for up to 100 cards. Give each planned card a stable `cardId` when practical and reuse the returned ids for revisions and retries.
5. Use `attach_card_artwork` only with an image field key returned by the contract and the exact stable card id.
6. Call `preview_card_set` after meaningful generation/artwork changes. Check that card copy varies as intended and that the set/card identities are correct before calling the set complete.
7. Open the exact returned Studio revision to install or update the same normal local Template, set, and cards.
8. In CardForge Studio, users can export finished media normally or export/import an editable individual card or set as CardForge JSON. Do not invent a parallel transfer format in chat.

If CardForge reports a revision conflict, reload the current working document or generation contract and retry the intended operation with the new `expectedRevision` and the same stable identities.
