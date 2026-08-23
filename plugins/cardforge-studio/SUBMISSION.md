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
- Long description: Design editable card Templates, create individual cards or complete sets, bulk-generate copy and unique artwork with ChatGPT, review exact CardForge-rendered outputs natively in chat, and continue everything in CardForge Studio. Developer publication tools remain a separate optional workflow.

Starter prompts:

1. Design a printable card Template and help me refine it.
2. Turn this list into a complete CardForge card set.
3. Add unique artwork and review my existing card set.

Initial-submission release notes for 0.9.0: CardForge Studio is an authenticated beta for editable Templates and complete card Sets with revision-safe cloud collaboration. Template and Set review now return immutable revision-bound PNG artifacts from the canonical CardForge renderer as native MCP image content, without iframe preview widgets.

## Authentication and reviewer fixture

The MCP server uses CardForge's production Clerk OAuth flow. There is no review-only authentication bypass.

Before submission, create one dedicated OpenAI reviewer account in Clerk that:

- uses an isolated email/password identity controlled by the publisher; a consumer mailbox or plus-address alias is acceptable, but it must not match an owner identity;
- is fully verified before submission and does not require the reviewer to complete MFA, email confirmation, SMS, private networking, or owner impersonation;
- remains on the ordinary Free account scope with no developer, owner, billing, or provider-console privileges;
- contains one intentionally cloud-saved set named `OpenAI Review Fixture`; temporary assistant drafts are created by the review cases instead of being pre-seeded because Free drafts expire after inactivity;
- contains no customer, owner, billing, or production marketing data.

Enter its credentials only in the OpenAI submission portal. Never commit the reviewer email or password. Keep the account available for the full review and resubmission window, then rotate its password or retire it according to the provider's current review policy. The developer-only `continue_template_in_pipeline` tool is not part of the Free-account positive cases; test it separately only if OpenAI requests developer-workflow coverage.

## Tool safety and UI declarations

Every MCP call records aggregate usage telemetry, so every tool truthfully declares `readOnlyHint: false`, including tools that otherwise only retrieve private data. The ten tools that can replace, remove, move, or permanently commit private working state declare `destructiveHint: true`: `update_editable_template`, `attach_template_artwork`, `upsert_card_set`, `upsert_card`, `upsert_cards`, `delete_cards`, `move_cards`, `delete_card_set`, `commit_cloud_set`, and `delete_cloud_set`. `upsert_card` and `upsert_cards` declare `openWorldHint: true` because they may retrieve a user-supplied public HTTPS artwork URL from outside the linked CardForge account. All other tools declare it false, and no tool publishes content. `checkout_cloud_set` only creates a private working copy and does not alter the cloud save; `continue_template_in_pipeline` creates a private review draft and does not publish.

Cloud mutations are revision-conditional. `commit_cloud_set` requires the exact working-document revision and source cloud revision, while `delete_cloud_set` requires the exact cloud revision. Stale operations fail rather than overwriting or deleting newer cloud work.

Template and Set preview tools do not register iframe/widget output templates. They return native MCP `image/png` content produced by CardForge's canonical renderer, plus separate revision-bound Studio URLs. Static creative review therefore requires no frame-domain or widget CSP permissions.

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

### Positive 3 — resume and revise a private Template

- Fixture: first create a private editable Template in the same review session, then use the returned document id for this case.
- Prompt: “List my editable Templates, reopen the one we just made, change its title to OpenAI Review Fixture, and show me the revised preview.”
- Expected tools: `list_editable_templates`, `get_editable_template`, `update_editable_template`, `preview_template_draft`.
- Expected result: the existing accepted plan remains locked, the same private document advances by one revision, and the preview and Studio URL target that exact revision; no developer Pipeline draft is created.

### Positive 4 — build and inspect a bulk set with artwork

- Fixture: create a private editable Template in this review session or reuse the still-active document from Positive 2 or 3. Use these public artwork URLs in order: `https://cardforges.com/site-fallbacks/showcase/creatures/emberclaw-whelp.webp`, `https://cardforges.com/site-fallbacks/showcase/creatures/moonveil-stag.webp`, and `https://cardforges.com/site-fallbacks/showcase/creatures/mossback-guardian.webp`.
- Prompt: “Use the editable Template in this session to make a three-card rock-paper-scissors set with distinct rules and the three review-fixture artwork URLs, then review it.”
- Expected tools: `create_editable_template` when no active document exists, then `upsert_card_set`, `get_card_generation_contract`, `upsert_cards`, and `preview_card_set`.
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

- Action: call `update_editable_template`, an upsert tool, `commit_cloud_set`, or `delete_cloud_set` with an expected revision older than the current document/cloud revision.
- Why it should not complete: accepting a stale write could silently overwrite or remove newer work.
- Expected result: a conflict response instructs the client to reload the current revision; the current document/cloud Set remains unchanged.

### Negative 3 — invalid artwork cannot masquerade as resolved

- Action: send an invalid/unresolvable artwork value or target a structural locked-frame field rather than a returned editable image key.
- Why it should not complete: unresolved media and structural frame fields cannot truthfully become editable embedded card artwork.
- Expected result: validation rejects the write or the preview explicitly reports `unresolved`, `template_fallback`, or `placeholder`; it never reports successful embedded artwork for an unresolved value.

## Domain verification

When OpenAI issues the challenge value, set `OPENAI_APPS_CHALLENGE_TOKEN` in the production Vercel environment and redeploy. Verify `https://cardforges.com/.well-known/openai-apps-challenge` returns only the exact plain-text token with no HTML, JSON wrapper, redirect, or surrounding whitespace. Never commit the value.