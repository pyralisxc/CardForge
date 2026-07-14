# CardForge Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the verified production security, delivery, persistence, billing, abuse, legal, architecture, and growth-loop risks before wider paid promotion.

**Architecture:** Preserve CardForge's three storage lanes and feature ownership. Server-only operational data remains in Supabase, user binaries move from localStorage to an IndexedDB repository owned by `project`, and all production changes reach `main` through focused reviewable commits with automated gates.

**Tech Stack:** Next.js 15, React 18, TypeScript, Vitest, Playwright, Zustand, IndexedDB, Clerk, Stripe, Supabase, Resend, Vercel, GitHub Actions.

## Global Constraints

- Keep one source of truth per responsibility and delete replaced paths.
- Keep user project content browser-local unless explicitly exported or submitted.
- Never expose Supabase service credentials, Clerk secrets, Stripe secrets, or Resend keys.
- Provider mutations require live verification; compilation is not provider verification.
- Use test-first red/green cycles for behavior changes.
- Preserve current project imports through an explicit project-document version migration.
- Do not merge until lint, typecheck, unit tests, build, public smoke, and provider-specific checks pass.

---

### Task 1: Database privilege containment

**Files:**
- Create: `supabase/migrations/202607140001_harden_privileged_functions.sql`
- Create: `tests/unit/supabase-security-migrations.test.ts`
- Modify: `docs/operations.md`

- [ ] Write a failing migration-contract test proving privileged functions revoke `PUBLIC`, `anon`, and `authenticated`, retain only `service_role`, and harden future default function grants.
- [ ] Add the forward-only migration without changing existing Founder Beta claims.
- [ ] Run the focused test and full unit suite.
- [ ] Apply the migration to the live Supabase project after review.
- [ ] Verify role privileges directly and run security/performance advisors.
- [ ] Commit the migration and recorded verification requirements.

### Task 2: Delivery and repository controls

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/smoke.yml`
- Create: `.github/dependabot.yml`
- Create: `.github/CODEOWNERS`
- Create: `SECURITY.md`
- Create: `CONTRIBUTING.md`
- Create: `LICENSE`
- Create: `docs/risk-register.md`
- Modify: `AGENTS.md`, `README.md`, `docs/operations.md`

- [ ] Remove the exact owner login from public instructions.
- [ ] Add secret-free PR checks for install, lint, typecheck, test, and build.
- [ ] Add public smoke and protected provider-smoke workflow boundaries.
- [ ] Add governance documents and a deliberate proprietary license.
- [ ] Restore a concise active risk register.
- [ ] Enable required branch checks and PR protection after the workflows exist.

### Task 3: Critical regression suite

**Files:**
- Restore and update selected tests under `tests/unit/` and `tests/smoke/`.

- [ ] Restore store persistence and rehydration tests from Git history.
- [ ] Restore project import/export, local asset, corrupted file, and access tests.
- [ ] Restore editor command/history, field contract, rich-text, pointer math, and layer tests.
- [ ] Restore print geometry and preview/export parity tests.
- [ ] Restore API validation and free/paid/developer/owner lifecycle coverage.
- [ ] Split the smoke coordinator by product workflow.

### Task 4: Browser binary storage

**Files:**
- Create: `src/features/project/lib/browserAssetRepository.ts`
- Create: `src/features/project/lib/browserStorageHealth.ts`
- Create: `tests/unit/browser-asset-repository.test.ts`
- Create: `tests/unit/browser-storage-health.test.ts`
- Modify project, editor, generator, store, and project-document consumers.

- [ ] Specify the asset repository and migration behavior in failing tests.
- [ ] Store binary blobs in IndexedDB and lightweight references in Zustand/localStorage.
- [ ] Migrate legacy Data URLs once and delete legacy binary writes.
- [ ] Add size/resolution validation, quota warnings, visible failures, and recovery snapshots.
- [ ] Version project documents and keep exports self-contained.

### Task 5: Abuse protection

**Files:**
- Create: `src/lib/server/abuseProtection.ts`
- Create: `tests/unit/abuse-protection.test.ts`
- Modify contact, roadmap, Founder Beta, and developer mutation routes.

- [ ] Define per-action identity, burst, and daily limits in failing tests.
- [ ] Add a server-owned limiter with consistent `429` responses.
- [ ] Add contact honeypot and low-friction bot challenge support.
- [ ] Ensure Founder Beta identity always comes from the verified Clerk session.
- [ ] Apply account and payload limits to roadmap and developer actions.

### Task 6: Billing event ledger

**Files:**
- Create: `supabase/migrations/202607140002_billing_event_ledger.sql`
- Create: `src/features/billing/lib/billingEventStore.ts`
- Create: `tests/unit/billing-event-store.test.ts`
- Modify: `src/app/api/billing/webhook/route.ts`
- Modify owner billing operations and UI.

- [ ] Define duplicate, stale, retry, and reconciliation behavior in failing tests.
- [ ] Add immutable event records and subscription high-water state.
- [ ] Process Stripe events idempotently before updating Clerk.
- [ ] Record applied and failed external synchronization.
- [ ] Add owner reconciliation across Stripe, ledger, and Clerk.

### Task 7: Business identity and Clerk production readiness

**Files:**
- Modify owner defaults, legal migrations, live documentation, and provider readiness checks.
- Create Clerk migration inventory/reconciliation tooling under `scripts/`.

- [ ] Change operator identity to Neon Black Interactive LLC.
- [ ] Replace stale refund and paid-beta copy.
- [ ] Add a readiness failure when production serves a Clerk development key.
- [ ] Inventory and map existing Clerk IDs before changing provider keys.
- [ ] Reconcile Founder Beta, developer, owner, and Stripe entitlement references after the provider migration.

### Task 8: Coordinator decomposition and growth loop

**Files:**
- Split owner-console and template-editor coordinators by existing feature responsibility.
- Create card social-export modules under `src/features/card-generator/`.

- [ ] Lock current coordinator behavior with tests.
- [ ] Extract owner sections and store operations without duplicate ownership.
- [ ] Extract template-maker asset, shortcut, mode, and persistence coordination.
- [ ] Add individual-card square, portrait, and story share exports.
- [ ] Add watermarking for free/social output, clean paid export preservation, Web Share, and download/copy fallbacks.

### Task 9: Completion and production verification

- [ ] Run `git diff --check`, lint, typecheck, unit tests, build, audits, and all smoke suites.
- [ ] Review stale references, duplicate stores, legacy Data URL writes, and public owner identity.
- [ ] Open a focused PR with provider-impact notes.
- [ ] Wait for required checks, review the final diff, and merge to `main`.
- [ ] Verify the production Vercel deployment, runtime errors, Supabase advisors, Clerk mode, Stripe reconciliation, legal pages, and public sharing.
