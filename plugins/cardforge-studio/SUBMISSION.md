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
- Category: Creativity
- Requested availability: public, wherever ChatGPT plugins and CardForge's providers are available; a CardForge account is required because temporary working documents and connected-project authorizations are private to the linked account.
- Short description: Design cards and card sets
- Long description: Design editable card Templates, create individual cards or complete sets, bulk-generate copy and unique artwork with ChatGPT, review exact CardForge-rendered outputs natively in chat, and continue everything in CardForge Studio. Contributor publication tools remain a separate optional workflow.

Starter prompts:

1. Design a printable card Template and help me refine it.
2. Turn this list into a complete CardForge card set.
3. Add unique artwork and review my existing card set.

Historical hardening release notes for 1.0.2: CardForge Studio is an authenticated integration for editable Templates and complete card Sets with revision-safe temporary working documents and connected-project commits. This release aligns every strict structured-output contract with its runtime payload, preserves Google Drive work identity, returns exact-revision Studio links, and confirms browser installation before reporting a revision as acknowledged. Template and Set review returns response-budgeted native PNG displays derived only from immutable revision-bound canonical artifacts, without iframe preview widgets. displayImages distinguishes byte-identical canonical images from reduced displays; full canonical artifact metadata and exact-revision Studio links remain separate and unchanged.

## Authentication and reviewer fixture

The MCP server uses CardForge's production Clerk OAuth flow. There is no review-only authentication bypass.

Before submission, create one dedicated OpenAI reviewer account in Clerk that:

- uses an isolated email/password identity controlled by the publisher; a consumer mailbox or plus-address alias is acceptable, but it must not match an owner identity;
- is fully verified before submission and does not require the reviewer to complete MFA, email confirmation, SMS, private networking, or owner impersonation;
- remains on the ordinary Free account scope with no contributor, owner, billing, or provider-console privileges;
- requires no pre-seeded authored work; temporary assistant drafts are created by the review cases because Free drafts expire after inactivity;
- contains no customer, owner, billing, or production marketing data.

Enter its credentials only in the OpenAI submission portal. Never commit the reviewer email or password. Keep the account available for the full review and resubmission window, then rotate its password or retire it according to the provider's current review policy. The Contributor-only `continue_template_in_pipeline` tool is not part of the Free-account positive cases; test it separately only if OpenAI requests Contributor-workflow coverage.

## Tool safety and UI declarations

Every MCP call records aggregate usage telemetry, so every tool truthfully declares `readOnlyHint: false`, including tools that otherwise only retrieve private data. The twelve tools that can replace, remove, move, or permanently commit private working state declare `destructiveHint: true`: `update_editable_template`, `attach_template_artwork`, `attach_template_artworks`, `patch_working_document`, `patch_cards`, `upsert_card_set`, `upsert_card`, `upsert_cards`, `delete_cards`, `move_cards`, `delete_card_set`, and `commit_project`. The tools `attach_template_artworks`, `patch_working_document`, `upsert_card`, and `upsert_cards` declare `openWorldHint: true` because they may retrieve a user-supplied public HTTPS artwork URL from outside the linked CardForge account. All other tools declare it false, and no tool publishes content. `checkout_project` only creates a temporary private working copy and does not alter the connected provider project; `continue_template_in_pipeline` creates a private review draft and does not publish.

Connected-project commits are revision-conditional. `commit_project` requires the exact working-document, provider, and CardForge project revisions. Stale operations fail rather than overwriting newer provider work.

Template and Set preview tools do not register iframe/widget output templates. They return response-budgeted native MCP `image/png` displays derived only from CardForge's canonical renderer, plus separate revision-bound Studio URLs. The complete tool result is bounded across all selected images, text and structured metadata; displayImages reports canonical versus reduced bytes and actual display dimensions/size. Reduction preserves aspect ratio and alpha, without replacing cached canonical artifacts. Static creative review therefore requires no frame-domain or widget CSP permissions.

## Human reviewer cases and evidence

The canonical, versioned source for all **five positive and five negative** capability cases is `REVIEW_CASES.json`. The existing deterministic package builder maps P1–P5 and N1–N3 into `extensions.com.openai.review.test_cases` in the portable and Codex plugin manifests. N4–N5 remain in the downloadable human packet; the initial MCP portal accepts exactly 5+3 cases.

Download the **human review packet** alongside the matching Studio ZIP at `/downloads`; it records environment/version, prerequisite account and install steps, each prompt, tool expectations, observable outcomes, and an explicit **Not run** status until real execution evidence exists. That packet does not go inside the runtime ZIP.

The negative capability examples concern unsupported fulfillment, payment, ungoverned public publication, cross-account private access and infrastructure deployment. Auth 401, stale-revision conflicts and invalid artwork remain separate error/recovery invariants, not substitutes for capability negatives.

The actual reviewer video/demo and credential entry are owner tasks. No demo URL, login or policy approval is inferred from this package; secure credentials must be entered only in the official portal. Submission/public publication remains separately gated.

## Domain verification

When OpenAI issues the challenge value, set `OPENAI_APPS_CHALLENGE_TOKEN` in the production Vercel environment and redeploy. Verify `https://cardforges.com/.well-known/openai-apps-challenge` returns only the exact plain-text token with no HTML, JSON wrapper, redirect, or surrounding whitespace. Never commit the value.