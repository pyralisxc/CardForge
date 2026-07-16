# Authenticated Smoke QA Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make authenticated production smoke runs create and align their four dedicated Clerk QA identities before Playwright begins.

**Architecture:** A testable ESM helper owns validation, exact-email lookup, idempotent Clerk creation, CardForge metadata alignment, and developer-profile upserts. A thin CLI wires protected environment values to Clerk and Supabase clients, while GitHub Actions invokes it after secret validation.

**Tech Stack:** Node.js 22 ESM, `@clerk/backend`, `@supabase/supabase-js`, Vitest, GitHub Actions.

## Global Constraints

- Act only on `CARDFORGE_E2E_FREE_EMAIL`, `CARDFORGE_E2E_PAID_EMAIL`, `CARDFORGE_E2E_DEV_EMAIL`, and `CARDFORGE_E2E_OWNER_EMAIL`.
- Never print emails, passwords, secret keys, Clerk user IDs, or Supabase identifiers.
- Preserve unrelated Clerk private metadata and fail closed on ambiguous exact-email lookup.
- Free has no CardForge role keys; paid has `cardforgeAccess: "paid"`; developer has `cardforgeAccess: "dev"`; owner has developer access plus `cardforgeRole: "owner"`.
- Do not inspect or create Stripe customers or real CardForge customer accounts.

---

### Task 1: Testable QA identity bootstrap

**Files:**
- Create: `scripts/lib/authenticated-smoke-qa.mjs`
- Create: `tests/unit/authenticated-smoke-qa.test.ts`

**Interfaces:**
- Produces: `readQaAccountConfiguration(env)`, `buildQaPrivateMetadata(role, metadata)`, `ensureQaClerkUsers(options)`, and `ensureQaDeveloperProfiles(options)`.
- Consumes: a Clerk-compatible `users` client and a Supabase-compatible `from` client so tests can use in-memory fakes.

- [ ] **Step 1: Write failing validation and metadata tests**

Cover normalized unique emails, missing/invalid/duplicate rejection, unrelated metadata preservation, and exact free/paid/developer/owner CardForge keys.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run tests/unit/authenticated-smoke-qa.test.ts`

Expected: FAIL because `scripts/lib/authenticated-smoke-qa.mjs` does not exist.

- [ ] **Step 3: Implement validation and metadata helpers**

The configuration result must use this shape:

```js
[
  { role: 'free', envKey: 'CARDFORGE_E2E_FREE_EMAIL', email: '...' },
  { role: 'paid', envKey: 'CARDFORGE_E2E_PAID_EMAIL', email: '...' },
  { role: 'developer', envKey: 'CARDFORGE_E2E_DEV_EMAIL', email: '...' },
  { role: 'owner', envKey: 'CARDFORGE_E2E_OWNER_EMAIL', email: '...' },
]
```

`buildQaPrivateMetadata` must first delete `cardforgeAccess`, `cardforgeRole`, and `cardforgeAccessExpiresAt`, then add only the selected role's required keys.

- [ ] **Step 4: Verify GREEN**

Run: `npx vitest run tests/unit/authenticated-smoke-qa.test.ts`

Expected: validation and metadata tests PASS.

- [ ] **Step 5: Add failing Clerk creation/reuse tests**

Test missing-user creation, exact-match reuse, ambiguous-match failure without mutation, metadata update only on drift, random password non-disclosure, and role-only summary output.

- [ ] **Step 6: Verify the new tests fail for missing behavior**

Run: `npx vitest run tests/unit/authenticated-smoke-qa.test.ts`

Expected: FAIL because `ensureQaClerkUsers` is not implemented.

- [ ] **Step 7: Implement the minimal Clerk bootstrap**

Use `getUserList({ emailAddress: [email], limit: 2 })`, `createUser(...)` only when no match exists, `getUser(id)` for current metadata, and `updateUserMetadata(id, { privateMetadata })` only when CardForge role keys require alignment. Return structured results internally but expose a summary containing only role, created, and metadata-updated counts.

- [ ] **Step 8: Add and satisfy developer-profile tests**

Upsert only developer and owner rows into `cardforge_developer_profiles` with `status: "active"`, QA names, and `eligible_for_profit_share: true`; throw on a Supabase error.

- [ ] **Step 9: Run focused tests and commit**

Run: `npx vitest run tests/unit/authenticated-smoke-qa.test.ts`

Expected: all focused tests PASS.

Commit: `Add idempotent Clerk QA bootstrap`

### Task 2: Protected CLI and workflow integration

**Files:**
- Create: `scripts/bootstrap-authenticated-smoke-users.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/authenticated-smoke.yml`
- Modify: `tests/unit/repository-security.test.ts`
- Test: `tests/unit/authenticated-smoke-qa.test.ts`

**Interfaces:**
- Consumes: Task 1 helpers and the eight workflow secrets already validated by GitHub Actions.
- Produces: `npm run qa:bootstrap-authenticated-smoke` and a pre-Playwright workflow step.

- [ ] **Step 1: Write a failing repository integration assertion**

Assert that `package.json` exposes `qa:bootstrap-authenticated-smoke`, the workflow calls it after protected-secret verification and before Playwright installation, and the bootstrap script is listed as a required security-sensitive script.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npx vitest run tests/unit/authenticated-smoke-qa.test.ts tests/unit/repository-security.test.ts`

Expected: FAIL because the CLI, npm script, and workflow step are absent.

- [ ] **Step 3: Implement the CLI**

Create Clerk and Supabase clients from protected environment values, run the Task 1 bootstrap and profile upsert, print only counts by role, and on failure emit a generic stage label plus a nonzero exit code without serializing provider errors.

- [ ] **Step 4: Wire package and workflow**

Add:

```json
"qa:bootstrap-authenticated-smoke": "node scripts/bootstrap-authenticated-smoke-users.mjs"
```

Then add the workflow step:

```yaml
- name: Ensure reusable Clerk QA accounts
  run: npm run qa:bootstrap-authenticated-smoke
```

between secret verification and Chromium installation.

- [ ] **Step 5: Verify GREEN and commit**

Run: `npx vitest run tests/unit/authenticated-smoke-qa.test.ts tests/unit/repository-security.test.ts`

Expected: all focused tests PASS.

Commit: `Bootstrap authenticated smoke QA users`

### Task 3: Complete verification and delivery

**Files:**
- Review all files changed in Tasks 1–2.

**Interfaces:**
- Produces: a reviewed PR, green production deployment, and a rerunnable authenticated smoke workflow.

- [ ] **Step 1: Run exact final verification**

Run: `npm run lint && npm run typecheck && npm run test && npm run build && git diff --check`

Expected: every command exits 0.

- [ ] **Step 2: Review security-sensitive behavior**

Confirm no output path contains an email, password, secret, user ID, raw provider payload, or Stripe mutation; verify exact-email ambiguity stops before creation or metadata mutation.

- [ ] **Step 3: Open PR and wait for gates**

Require CI, Public smoke, and Vercel preview to pass with no unresolved review thread.

- [ ] **Step 4: Merge and verify production**

Squash merge the checked head, verify the exact production Vercel deployment is READY with `cardforges.com`, run `npm run health:production`, and confirm no new 4xx/5xx or runtime error group.

- [ ] **Step 5: Rerun Authenticated smoke**

The owner manually dispatches the workflow on `main`; verify all tests pass and retain the uploaded evidence artifact.
