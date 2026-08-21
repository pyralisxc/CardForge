# CardForge Studio submission source

This file is the reusable source for the OpenAI plugin listing and review. It contains no credentials or challenge secrets. Copy secrets only into the OpenAI portal or Vercel environment that owns them.

## Listing

- Name: CardForge Studio
- Developer: Cameron Locke
- MCP server URL: `https://cardforges.com/mcp`
- Website: `https://cardforges.com`
- Support: `https://cardforges.com/contact?kind=support`
- Privacy policy: `https://cardforges.com/privacy`
- Terms of service: `https://cardforges.com/terms`
- Logo source: `https://cardforges.com/brand/cardforge-studio/favicon.svg`
- Category: Design
- Requested availability: public beta, globally wherever ChatGPT plugins and CardForge's providers are available; a CardForge account is required because all working documents and cloud sets are private to the linked account.
- Short description: Design cards and generate complete card sets.
- Long description: Design editable card Templates, create individual cards or complete sets, bulk-generate copy and unique artwork with ChatGPT, review results, and continue everything in CardForge Studio. Developer publication tools remain a separate optional workflow.

Starter prompts:

1. Design a printable card Template and help me refine it.
2. Turn this list into a complete CardForge card set.
3. Add unique artwork and review my existing card set.

Initial-submission release notes for 0.7.0: CardForge Studio is an authenticated beta for building editable Templates and complete card sets with ChatGPT. This initial version includes native bulk artwork ingestion, explicit artwork-resolution diagnostics, exact-revision Studio handoff, cloud-set discovery, and review-accurate tool safety annotations.

## Authentication and reviewer fixture

The MCP server uses CardForge's production Clerk OAuth flow. There is no review-only authentication bypass.

Before submission, create one dedicated OpenAI reviewer account in Clerk that:

- does not require MFA, email confirmation, SMS, private networking, or owner impersonation;
- has the minimum developer scope needed to exercise `continue_template_in_pipeline` without owner privileges;
- contains one ordinary editable Template named `OpenAI Review Fixture` and one intentionally cloud-saved set with the same name;
- contains no customer, owner, billing, or production marketing data.

Enter its credentials only in the OpenAI submission portal. Rotate or retire the account after review according to the provider's current review policy.

## Tool safety and UI declarations

Every MCP call records aggregate usage telemetry, so every tool truthfully declares `readOnlyHint: false`, including tools that otherwise only retrieve private data. The five tools that can replace private working state declare `destructiveHint: true`: `update_editable_template`, `upsert_card_set`, `upsert_card`, `upsert_cards`, and `attach_template_artwork`. `upsert_card` and `upsert_cards` declare `openWorldHint: true` because they may retrieve a user-supplied public HTTPS artwork URL from outside the linked CardForge account. All other tools declare it false, and no tool publishes content. `continue_template_in_pipeline` creates a private review draft; it does not publish.

The template preview UI is model-only and cannot call MCP tools. Its exact CSP allows frames and redirects only to `https://cardforges.com`; it declares no additional connect or resource domains.

## Positive review cases

### Positive 1 — discover the native workflow

- Fixture: the authenticated reviewer account; no saved content is required.
- Prompt: “What can CardForge help me make, and which built-in assets should I reuse for a fantasy spell card?”
- Expected tools: `get_studio_creation_guide`, then `search_studio_library`.
- Expected result: a CardForge-native plan using returned library assets; no document is created until the user confirms or delegates the production plan.

### Positive 2 — create, revise, attach, and preview one Template

- Fixture: use `mimeType: image/png` and raw base64 `iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2ZxQAAAAASUVORK5CYII=` when calling `attach_template_artwork`; use the returned planned asset requirement id and `binding: element.image`.
- Prompt: “Create an editable poker-size fantasy spell Template, make the title and rules editable, attach the review-fixture artwork to the planned main-art slot, and show me a preview.”
- Expected tools: `create_editable_template`, `attach_template_artwork`, `preview_template_draft`; use `update_editable_template` only when a material revision is requested.
- Expected result: one private document whose revision advances, artwork reports its exact native binding, the rendered PNG appears in chat, and the separate Studio URL targets the exact revision.

### Positive 3 — resume an existing Template and hand it to Forge Review

- Fixture: the review account owns an editable Template and has the minimum developer scope.
- Prompt: “List my editable Templates, open the review fixture, and continue it in Forge Review without publishing it.”
- Expected tools: `list_editable_templates`, `get_editable_template`, `continue_template_in_pipeline`.
- Expected result: the existing accepted plan remains locked, one private Pipeline draft is created, and the returned URL opens Forge Review; nothing becomes public.

### Positive 4 — build and inspect a bulk set with artwork

- Fixture: use the review account's editable Template named `OpenAI Review Fixture`. Use these public artwork URLs in order: `https://cardforges.com/site-fallbacks/showcase/creatures/emberclaw-whelp.webp`, `https://cardforges.com/site-fallbacks/showcase/creatures/moonveil-stag.webp`, and `https://cardforges.com/site-fallbacks/showcase/creatures/mossback-guardian.webp`.
- Prompt: “Use my OpenAI Review Fixture Template to make a three-card rock-paper-scissors set with distinct rules and the three review-fixture artwork URLs, then review it.”
- Expected tools: `upsert_card_set`, `get_card_generation_contract`, `upsert_cards`, `preview_card_set`.
- Expected result: the agent uses only returned field keys, reuses stable set/card IDs, stores artwork in the bulk transaction, and reports each image as resolved, unresolved, template fallback, or placeholder.

### Positive 5 — read an intentional cloud save

- Fixture: the review account owns the cloud-saved set `OpenAI Review Fixture`.
- Prompt: “Find my cloud-saved OpenAI Review Fixture and summarize its cards without changing it.”
- Expected tools: `list_cloud_sets`, then `get_cloud_set`.
- Expected result: only the linked account's intentional cloud save is returned; browser-local projects and embedded private artwork bytes are not exposed.

## Negative review cases

### Negative 1 — signed-out access fails closed

- Action: connect to `https://cardforges.com/mcp` without a CardForge OAuth token.
- Why it should not complete: the request has no linked CardForge identity, so returning tools or data could expose private account content.
- Expected result: HTTP 401 with OAuth discovery information; no tool result or private identifier is returned.

### Negative 2 — a stale revision cannot overwrite newer work

- Action: call `update_editable_template` or an upsert tool with an `expectedRevision` older than the current document revision.
- Why it should not complete: accepting a stale write could silently overwrite a newer browser or assistant revision.
- Expected result: a conflict response instructs the client to reload the current revision; the current document remains unchanged.

### Negative 3 — invalid artwork cannot masquerade as resolved

- Action: send an invalid/unresolvable artwork value or target a structural locked-frame field rather than a returned editable image key.
- Why it should not complete: unresolved media and structural frame fields cannot truthfully become editable embedded card artwork.
- Expected result: validation rejects the write or the preview explicitly reports `unresolved`, `template_fallback`, or `placeholder`; it never reports successful embedded artwork for an unresolved value.

## Domain verification

When OpenAI issues the challenge value, set `OPENAI_APPS_CHALLENGE_TOKEN` in the production Vercel environment and redeploy. Verify `https://cardforges.com/.well-known/openai-apps-challenge` returns only the exact plain-text token with no HTML, JSON wrapper, redirect, or surrounding whitespace. Never commit the value.
