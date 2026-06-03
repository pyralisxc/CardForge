# Developer Pipeline Model

This is the active product model for developer-submitted CardForge assets.

## Core Flow

Developer submissions enter the voting pipeline immediately after submit. There is no separate pre-vote review lane by default.

The owner can still intervene at any point, but the normal path is:

1. A developer submits a template, element recipe, texture, divider, icon, image, or overlay asset.
2. The asset appears in the shared voting queue for eligible developers.
3. Votes, owner vote weight, thresholds, and per-type caps determine whether the asset stays pipeline-only, becomes a publish candidate, publishes, or archives.
4. Published assets remain voteable so future signal and cap changes can re-rank them.
5. Archived assets remain recoverable. Archive is the normal "delete from active use" path.

## Visibility

Creator-facing visibility is intentionally simple:

- `free`: published into the Starter Library.
- `paid`: published into the Creator Pass library.

Everything else is pipeline inventory, not a creator-facing Studio library asset. Internal/back-compat tiers such as `developer` and `hidden` should be described in product UI as `Pipeline Only` or `Not Live`, not as extra customer-visible library tiers.

## Queue UX

The developer review surface should feel like one professional queue, not three separate lanes. Developers should see voteable items together, with filters and badges for:

- asset family
- lifecycle status
- free/paid/pipeline-only visibility
- contributor
- vote state
- quality/vote progress

Published, candidate, and archived items can share the same voting queue because the action is the same: review the asset and add signal. Status badges explain what the signal currently means.

## Submission UX

The submit form should adapt to the selected asset family. The core fields stay consistent so the workflow remains learnable, but the guidance should change by asset type:

- Templates expect generator-ready template JSON and should call out layout completeness, sample text, and clear field names.
- Pipeline Recipes expect structured preset/style JSON and should call out applicable element roles and visible reusable behavior.
- Textures should call out repeat/stretch intent and text readability.
- Dividers should call out orientation, stretch behavior, and section role.
- Icons should call out semantic use, small-size readability, and transparent/recolorable expectations.
- Images should call out crop intent, aspect ratio, source rights, and whether the asset is placeholder or finished art.
- Overlay Assets should call out placement, stacking behavior, resize constraints, and transparent edges.

This keeps the form dense enough for professional submission quality without forcing every asset type through a confusing universal checklist.

## Owner Controls

The owner side should show the pipeline as a capacity and governance system:

- active developer slots
- monthly submission allowance
- monthly published expectation
- vote thresholds and owner vote weight
- contributor self-voting rule
- free and paid caps per asset family
- archive visible limit
- contributor account overrides
- publish/archive/recover/reject actions

Owner `Archive` is the default removal action. Hard deletion should be reserved for admin-only spam, legal, privacy, or corrupted-data cases and should not be the normal UI behavior.

## Capacity Rules

Published capacity and pipeline/backlog capacity are separate concepts:

- Published caps decide how many free and paid assets are live in Studio libraries.
- Voting backlog is constrained by monthly developer submission allowances.
- Archive visibility is constrained by `archiveVisibleLimit`.

When caps tighten, the app should rebalance by keeping the strongest assets live, moving over-cap passing assets back to candidate review, and moving failing assets to archive. It should not silently hard-delete contribution history.

## Contact And Email

Developer access requests and contact/support requests route to the owner contact email configured for the site. The current product path is `mailto:` because it is transparent, low-risk, and enough for developer access requests before a larger notification system exists:

- `/contact` shows the current owner-managed contact document.
- developer account requests use the same owner contact destination or a clearly configured developer-program inbox.
- rejection/archive notes should remain visible in-product; outbound email is optional unless a future notification system is added.

If CardForge adds first-party form submission or automated notifications, prefer React Email for template authoring and a transactional email provider for delivery. Do not hand-roll SMTP, unsubscribe/compliance handling, deliverability, retries, or provider webhooks inside the app. See `docs/email-operations.md` for the business-email migration checklist.
