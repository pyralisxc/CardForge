# Launch Verification Closure Design

**Date:** July 15, 2026

## Goal

Turn the follow-up audit's remaining provider and maintenance findings into durable production evidence without broadening the product surface or changing customer entitlements.

## Current evidence

- Production renders a Clerk `pk_live_` publishable key, loads Clerk from `clerk.cardforges.com`, and reports the Clerk SDK environment as production.
- The only recent `/__clerk/v1/client` and `/__clerk/v1/environment` `400` requests belong to an older production deployment. Current production does not configure a local Clerk proxy URL.
- Supabase is `ACTIVE_HEALTHY`. Founder Beta and billing RPC execution is denied to `anon` and `authenticated` and allowed to `service_role`.
- Supabase billing event and subscription tables are empty.
- The owner billing reconciliation route repairs Clerk metadata but only counts missing subscription-ledger rows; it does not create them.
- The authenticated smoke workflow has no completed runs and can report success when required reusable-account secrets are absent because Playwright skips those tests.
- The active GitHub ruleset requires pull requests, prevents branch deletion and non-fast-forward pushes, and requires thread resolution. It currently requires zero approvals and no status checks.
- Dependabot is opening uncoordinated major framework and toolchain upgrades.

## Considered approaches

### 1. Manual verification only

Run the owner reconciliation, Stripe redelivery, and authenticated smoke as-is. This is the smallest change, but it cannot populate the empty billing subscription table and could produce a misleading green smoke run with skipped tests.

### 2. Targeted closure PR followed by provider proof — selected

Fix only the gaps that prevent trustworthy verification, then run the provider checks against the deployed result. This keeps scope narrow while making the evidence repeatable.

### 3. Full observability platform

Add an external error tracker, alert routing, and business-event telemetry before launch. This would improve operations, but it adds vendor and privacy decisions that are not necessary to close the current audit.

## Design

### Billing reconciliation baseline

The owner reconciliation route will insert missing Stripe subscriptions into `cardforge_billing_subscriptions` without overwriting rows already owned by real webhook events. Each inserted row receives:

- Stripe subscription and customer IDs;
- the Clerk user ID from Stripe metadata, when present;
- the reconciliation start time as the ordering baseline; and
- a clearly prefixed reconciliation marker in `last_event_id`.

The insert will use conflict-ignore semantics. A concurrent or earlier webhook row remains authoritative. Events created before the reconciliation baseline become stale, while future Stripe lifecycle events remain eligible. The response will report how many baselines were created and how many subscriptions remain absent.

### Authenticated smoke integrity

The workflow will fail before installing a browser when any required protected secret is absent. It will also run a signed-out production check that:

- waits for the global Sign in control;
- opens the Clerk modal;
- confirms the modal reaches an interactive state; and
- fails on Clerk client/environment responses with HTTP 400 or greater.

The existing reusable free, paid, developer, and owner matrix remains the entitlement proof. Playwright reports and traces will be uploaded on every run so a result is reviewable instead of only green or red.

### Dependency policy

Dependabot will group patch and minor updates conservatively and ignore all major npm and GitHub Actions updates. Major React/Next/type and toolchain migrations become intentional projects instead of routine maintenance PRs. Existing noisy major PRs will be closed after the policy reaches `main`; legitimate patch PRs remain open for normal review.

### Governance and documentation

The risk register will gain an explicit status and evidence column. Closed work will be marked closed, provider-dependent work will be marked implemented/awaiting live verification, and accepted limitations will retain review dates.

The operations runbook will record:

- the exact authenticated-smoke preflight requirements;
- the billing reconciliation and safe Stripe resend procedure;
- the current solo-maintainer branch-rule exception; and
- the manual Clerk sign-in/sign-out evidence required after provider or domain changes.

The active branch ruleset will require the CI and Public smoke checks. Approval count remains zero while `@pyralisxc` is the only code owner, because GitHub does not allow an author to satisfy their own required approval. The register will record a dated action to require one approval when a second reviewer is added.

## Verification

- Unit tests prove reconciliation rows, conflict-ignore behavior, workflow preflight, Clerk modal diagnostics, Dependabot major suppression, and risk status coverage.
- Full lint, typecheck, unit, and production build gates pass locally and on GitHub.
- Public Playwright smoke passes on the PR.
- The exact merge commit reaches a READY production deployment on `cardforges.com`.
- A manually dispatched authenticated production smoke run passes without skipped account roles.
- Owner reconciliation creates the existing live subscription baseline and aligns Clerk metadata.
- A Stripe dashboard resend creates one processed billing event; a second resend receives the durable `duplicate` decision without creating another row or changing entitlement.
- Supabase advisors and Vercel runtime error checks remain free of warning/error findings.

## Out of scope

- New pricing or entitlement rules.
- A framework-major upgrade.
- A new external monitoring vendor.
- Browser-direct access to server-owned Supabase tables.
