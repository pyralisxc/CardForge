# Launch Readiness Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify CardForge's live launch path thoroughly across production health, role-specific account behavior, core Studio workflows, business integrations, and living documentation, fixing issues found along the way.

**Architecture:** The audit is evidence-first: verify live deployment and public/API surfaces, then run local browser/API smoke for role and Studio workflows, then patch real gaps with focused tests. Documentation is updated only when it is stale or misleading against current behavior.

**Tech Stack:** Next.js, React, TypeScript, Vitest, Playwright, Vercel deployment connector, Stripe/Clerk/Supabase/Resend environment checks.

## Global Constraints

- Cold cut stale or misleading docs and legacy code paths; do not preserve compatibility bloat unless active user data depends on it.
- Do not expose or print secret values; verify presence/status through safe health routes and provider metadata only.
- Prefer local deterministic checks for code fixes, and live checks for deployment/SEO/account setup state.
- If a production-impacting issue is fixed, run focused tests, typecheck, build, and a browser smoke before committing.
- Keep `main` deployable at every checkpoint.

---

### Task 1: Production And SEO Health

**Files:**
- Inspect: `.vercel/project.json`
- Inspect: `src/app/robots.ts`
- Inspect: `src/app/sitemap.ts`
- Inspect: `src/lib/siteUrl.ts`
- Modify only if defects are found.

**Interfaces:**
- Vercel project id: `prj_395tFBFCrHJC2hP55haUKgas2cSC`
- Vercel team id: `team_zVCGtHmdwYLDIJgA1mt8c7Nm`
- Production domain at audit time: `https://card-forge-snowy.vercel.app`
- Current canonical domain: `https://cardforges.com`

- [x] Confirm the latest Vercel production deployment is `READY` and attached to the current `main` commit.
- [x] Fetch `/`, `/studio`, `/account`, `/developer`, `/owner`, `/robots.txt`, `/sitemap.xml`, `/api/templates`, `/api/billing/status`, and `/api/assets` from production and record status/body signals.
- [x] Confirm sitemap contains the public pages Google should discover and no private/API routes.
- [x] If route, robots, sitemap, or site URL defects are found, patch the smallest owning file and add/update the closest unit test.

### Task 2: Role And Business Flow Audit

**Files:**
- Inspect: `src/lib/accountEntitlement.ts`
- Inspect: `src/lib/billing.ts`
- Inspect: `src/app/api/billing/*/route.ts`
- Inspect: `src/features/account/components/AccountProfilePage.tsx`
- Inspect: `src/features/app-shell/components/CardForgeStudioShell.tsx`
- Modify only if defects are found.

**Interfaces:**
- `/api/account/entitlement` returns `accessMode`, `canExportClean`, and `ownerAccess`.
- `/api/billing/status` returns safe setup flags without secrets.
- `/api/billing/checkout` should start Creator Pass checkout for signed-in users only.
- `/api/billing/portal` should route signed-in subscribed users to Stripe customer portal.

- [x] Verify unauthenticated production/account API behavior does not leak privileged access.
- [x] Verify unpaid export messaging points to Creator Pass, not developer application copy.
- [x] Verify account/status copy distinguishes visitor, free/demo, paid creator, developer, and owner expectations clearly.
- [x] Inspect Stripe setup assumptions for live mode and confirm any remaining checks are owner-console/provider-dashboard tasks rather than app defects.
- [x] Patch copy or route behavior if role semantics are confusing or incorrect.

### Task 3: Core Studio Workflow Audit

**Files:**
- Inspect: `src/features/app-shell/components/CardForgeStudioShell.tsx`
- Inspect: `src/features/card-generator/components/GenerationWorkspace.tsx`
- Inspect: `src/features/card-generator/components/GeneratorFieldInput.tsx`
- Inspect: `src/features/template-editor/components/CardTemplateMaker.tsx`
- Inspect: `tests/smoke/card-forge.spec.ts`
- Modify only if defects are found.

**Interfaces:**
- Local Studio route: `/studio`
- Browser checks should cover Layout Studio, front/back deck setup, Generator image tools, generated output removal, and export gating.

- [x] Start a clean local dev server on an unused port or reuse `9002` if healthy.
- [x] Browser-smoke visitor Studio load, Layout Studio element selection, flip controls, front/back deck setup, Generator image tools, generated output creation/removal, and export gate.
- [x] Capture any console errors and classify blocked external resources separately from app defects.
- [x] Patch UI/workflow defects with focused unit or smoke coverage.

### Task 4: Owner Console And Living Docs

**Files:**
- Inspect: `docs/release-checklist.md`
- Inspect: `docs/backend-data-flow.md`
- Inspect: `docs/email-operations.md`
- Inspect: `src/lib/ownerConsoleStore.ts`
- Inspect: `src/app/api/owner/*/route.ts`
- Modify docs or owner-console copy only if stale.

**Interfaces:**
- `/owner` is owner-only.
- Owner console should expose business profile, legal/trust, billing snapshot, integration status, email test, accounts, and launch settings without secrets.

- [x] Compare release checklist claims against current test/deploy evidence.
- [x] Verify owner console integration status does not imply secrets are visible/editable in browser.
- [x] Verify email/Resend docs explain current domain and sender constraints accurately.
- [x] Patch stale docs or copy and remove obsolete launch-blocking notes that no longer apply.

### Task 5: Verification, Commit, And Push

**Files:**
- All modified files from earlier tasks.

**Interfaces:**
- `npm run test`
- `npm run typecheck`
- `npm run build`
- `git diff --check`

- [x] Run focused tests for any patched areas.
- [x] Run full unit suite, typecheck, production build, and diff whitespace check.
- [x] Re-run the browser smoke area affected by any patch.
- [x] Commit and push a clean launch-readiness update if files changed.
- [x] If no files changed, report the evidence and any manual dashboard checks still required.
