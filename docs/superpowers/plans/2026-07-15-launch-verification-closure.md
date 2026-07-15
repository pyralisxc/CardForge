# Launch Verification Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make CardForge's remaining Clerk, billing, authenticated-smoke, dependency, and governance checks produce trustworthy production evidence.

**Architecture:** Keep provider truth in provider-owned systems while adding only the code needed to verify it safely. Reconciliation inserts conflict-safe subscription baselines, authenticated smoke fails closed and exercises the signed-out Clerk modal, and repository policy files encode explicit maintenance and risk status.

**Tech Stack:** Next.js 15, TypeScript, Stripe SDK, Clerk, Supabase, Vitest, Playwright, GitHub Actions, Dependabot, Vercel.

## Global Constraints

- Do not change customer pricing, entitlement rules, watermark policy, or clean-export behavior.
- Do not expose Supabase billing tables or RPCs to browser roles.
- Never print provider secrets or reusable QA account addresses in logs or artifacts.
- Reconciliation must not overwrite a row already established by a Stripe webhook.
- Major dependency upgrades remain intentional projects, not routine Dependabot PRs.
- Provider-owned verification must run against `https://cardforges.com` after the exact merge commit is READY.

---

### Task 1: Conflict-safe billing subscription baselines

**Files:**
- Create: `src/features/billing/lib/billingReconciliation.ts`
- Create: `tests/unit/billing-reconciliation.test.ts`
- Modify: `src/app/api/owner/billing/reconcile/route.ts`

**Interfaces:**
- Produces: `buildMissingBillingSubscriptionBaselines({ subscriptions, existingSubscriptionIds, reconciledAt })` returning rows for `cardforge_billing_subscriptions`.
- Consumes: Stripe subscription IDs, customer IDs, Clerk metadata, and the reconciliation timestamp.

- [ ] **Step 1: Write the failing helper tests**

```ts
import { describe, expect, it } from 'vitest';
import { buildMissingBillingSubscriptionBaselines } from '@/features/billing/lib/billingReconciliation';

describe('billing reconciliation', () => {
  it('builds a current ordering baseline for a missing Stripe subscription', () => {
    const reconciledAt = new Date('2026-07-15T22:00:00.000Z');
    expect(buildMissingBillingSubscriptionBaselines({
      subscriptions: [{
        id: 'sub_live_123',
        customer: 'cus_live_123',
        metadata: { clerkUserId: 'user_123' },
      }],
      existingSubscriptionIds: new Set(),
      reconciledAt,
    })).toEqual([{
      stripe_subscription_id: 'sub_live_123',
      stripe_customer_id: 'cus_live_123',
      clerk_user_id: 'user_123',
      last_event_created_at: reconciledAt.toISOString(),
      last_event_id: 'reconciliation:sub_live_123:1784152800000',
      updated_at: reconciledAt.toISOString(),
    }]);
  });

  it('does not overwrite a webhook-owned subscription row', () => {
    expect(buildMissingBillingSubscriptionBaselines({
      subscriptions: [{ id: 'sub_live_123', customer: null, metadata: {} }],
      existingSubscriptionIds: new Set(['sub_live_123']),
      reconciledAt: new Date('2026-07-15T22:00:00.000Z'),
    })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm run test -- tests/unit/billing-reconciliation.test.ts`

Expected: FAIL because `billingReconciliation.ts` does not exist.

- [ ] **Step 3: Implement the pure baseline builder**

```ts
type ReconciliationSubscription = {
  id: string;
  customer: string | { id: string } | null;
  metadata?: Record<string, string> | null;
};

export type BillingSubscriptionBaselineRow = {
  stripe_subscription_id: string;
  stripe_customer_id: string | null;
  clerk_user_id: string | null;
  last_event_created_at: string;
  last_event_id: string;
  updated_at: string;
};

const getObjectId = (value: string | { id: string } | null): string | null =>
  typeof value === 'string' ? value : value?.id ?? null;

export const buildMissingBillingSubscriptionBaselines = ({
  subscriptions,
  existingSubscriptionIds,
  reconciledAt,
}: {
  subscriptions: ReconciliationSubscription[];
  existingSubscriptionIds: ReadonlySet<string>;
  reconciledAt: Date;
}): BillingSubscriptionBaselineRow[] => subscriptions
  .filter((subscription) => !existingSubscriptionIds.has(subscription.id))
  .map((subscription) => ({
    stripe_subscription_id: subscription.id,
    stripe_customer_id: getObjectId(subscription.customer),
    clerk_user_id: subscription.metadata?.clerkUserId ?? null,
    last_event_created_at: reconciledAt.toISOString(),
    last_event_id: `reconciliation:${subscription.id}:${reconciledAt.getTime()}`,
    updated_at: reconciledAt.toISOString(),
  }));
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm run test -- tests/unit/billing-reconciliation.test.ts`

Expected: 2 tests pass.

- [ ] **Step 5: Integrate conflict-ignore baselines into the owner route**

After collecting subscriptions, require the Supabase server client, read existing IDs, build missing rows, and insert them with:

```ts
await supabase
  .from('cardforge_billing_subscriptions')
  .upsert(baselines, {
    onConflict: 'stripe_subscription_id',
    ignoreDuplicates: true,
  });
```

Re-read the IDs after insertion and return `ledgerCreated` plus the verified `missingLedger` count. Keep existing Clerk repair behavior unchanged.

- [ ] **Step 6: Run billing tests**

Run: `npm run test -- tests/unit/billing-reconciliation.test.ts tests/unit/billing-event-store.test.ts tests/unit/billing.test.ts tests/unit/owner-billing-operations.test.ts`

Expected: all focused billing tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/features/billing/lib/billingReconciliation.ts src/app/api/owner/billing/reconcile/route.ts tests/unit/billing-reconciliation.test.ts
git commit -m "Make billing reconciliation establish ledger baselines"
```

---

### Task 2: Fail-closed authenticated production smoke

**Files:**
- Modify: `tests/smoke/auth-account.spec.ts`
- Modify: `.github/workflows/authenticated-smoke.yml`
- Modify: `playwright.config.ts`
- Modify: `tests/unit/repository-security.test.ts`

**Interfaces:**
- Produces: a workflow preflight that requires all eight protected values and an interactive signed-out Clerk modal check.
- Produces: HTML report and trace artifacts for every authenticated smoke run.

- [ ] **Step 1: Add failing repository-policy assertions**

Add tests that read `.github/workflows/authenticated-smoke.yml` and assert it contains a named protected-secret preflight, every required secret name, an `if: always()` artifact step, and `actions/upload-artifact@v4`.

- [ ] **Step 2: Run the policy test and verify RED**

Run: `npm run test -- tests/unit/repository-security.test.ts`

Expected: FAIL because the workflow has no preflight or artifact upload.

- [ ] **Step 3: Add the workflow preflight**

Add a step before browser installation whose environment contains:

```yaml
CARDFORGE_E2E_FREE_EMAIL: ${{ secrets.CARDFORGE_E2E_FREE_EMAIL }}
CARDFORGE_E2E_PAID_EMAIL: ${{ secrets.CARDFORGE_E2E_PAID_EMAIL }}
CARDFORGE_E2E_DEV_EMAIL: ${{ secrets.CARDFORGE_E2E_DEV_EMAIL }}
CARDFORGE_E2E_OWNER_EMAIL: ${{ secrets.CARDFORGE_E2E_OWNER_EMAIL }}
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${{ secrets.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY }}
CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY }}
SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

The shell step checks each value with indirect expansion, reports names only, and exits 1 when any are empty.

- [ ] **Step 4: Add the signed-out Clerk browser check**

Before the reusable account matrix, add a Playwright test that opens `/`, waits for Clerk, clicks the `Sign in` button, waits for `.cl-modalContent`, verifies an identifier input or social-provider button is visible, and records any `/v1/client` or `/v1/environment` response with status 400 or greater. Assert the failure list is empty.

- [ ] **Step 5: Configure reviewable CI artifacts**

Use a line plus HTML reporter on CI and add this final workflow step:

```yaml
- name: Upload authenticated smoke evidence
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: authenticated-smoke-${{ github.run_id }}
    path: |
      playwright-report
      test-results
    if-no-files-found: warn
    retention-days: 14
```

- [ ] **Step 6: Run policy and type checks**

Run: `npm run test -- tests/unit/repository-security.test.ts`

Run: `npm run typecheck`

Expected: policy tests and typecheck pass. The production browser behavior is gated by the manually dispatched GitHub workflow because local provider state is not authoritative.

- [ ] **Step 7: Commit**

```bash
git add tests/smoke/auth-account.spec.ts .github/workflows/authenticated-smoke.yml playwright.config.ts tests/unit/repository-security.test.ts
git commit -m "Make authenticated production smoke fail closed"
```

---

### Task 3: Quiet major upgrades and make risk status explicit

**Files:**
- Modify: `.github/dependabot.yml`
- Modify: `docs/risk-register.md`
- Modify: `docs/operations.md`
- Modify: `tests/unit/repository-security.test.ts`

**Interfaces:**
- Produces: patch/minor-only routine update policy and a status/evidence record for every launch risk.

- [ ] **Step 1: Add failing maintenance-policy assertions**

Add repository tests that require npm and GitHub Actions major-version ignores, a `Status` column in the risk register, and the phrases `Awaiting live verification`, `Accepted`, and `Closed`.

- [ ] **Step 2: Run the policy test and verify RED**

Run: `npm run test -- tests/unit/repository-security.test.ts`

Expected: FAIL because current Dependabot and risk files do not meet the policy.

- [ ] **Step 3: Restrict Dependabot**

For npm, group development minor/patch, production patch, and production minor updates. Ignore `version-update:semver-major` for `"*"`. For GitHub Actions, group minor/patch updates and ignore majors.

- [ ] **Step 4: Rewrite the risk table with status and evidence**

Use these statuses:

- Supabase privileged RPC: `Closed`
- Clerk production instance: `Awaiting live verification`
- Delivery gates: `Implemented; rules update required`
- IndexedDB data safety: `Closed; stress review scheduled`
- Abuse controls: `Closed; monitor`
- Billing ledger: `Awaiting live verification`
- Legal identity: `Closed`
- Dependency advisories: `Accepted`
- Export/prepress boundary: `Accepted`
- Monitoring: `Implemented; alert ownership open`
- Coordinator decomposition: `Open`
- Social sharing/watermarks: `Closed`

- [ ] **Step 5: Add exact provider runbook steps**

Document the manual Clerk flow, owner reconciliation response fields, Stripe Dashboard **Resend** procedure, duplicate verification query, authenticated workflow dispatch, and solo-maintainer approval exception with an August 15, 2026 review date.

- [ ] **Step 6: Run policy tests and diff validation**

Run: `npm run test -- tests/unit/repository-security.test.ts`

Run: `git diff --check`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add .github/dependabot.yml docs/risk-register.md docs/operations.md tests/unit/repository-security.test.ts
git commit -m "Record launch risk closure policy"
```

---

### Task 4: Full verification and integration

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run the complete local gate**

Run in order:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
git diff --check origin/main...HEAD
```

Expected: lint and typecheck pass; all unit tests pass; production build exits 0; diff check is clean.

- [ ] **Step 2: Review scope and secret safety**

Run:

```bash
git diff --stat origin/main...HEAD
git diff origin/main...HEAD -- . ':!package-lock.json'
rg -n 'sk_live_|sk_test_|whsec_|service_role' .github docs src tests -g '!*.md'
```

Expected: no secret values, no entitlement changes, and only launch-verification scope.

- [ ] **Step 3: Publish a PR**

Push `feature/launch-verification`, open a ready PR, and wait for CI, Public smoke, and the Vercel preview to pass.

- [ ] **Step 4: Merge and verify production**

Squash merge after checks are green. Verify the exact merge SHA is READY on `cardforges.com`, run `npm run health:production`, confirm no recent Vercel runtime error groups, and verify `origin/main` has the same tree as the reviewed branch.

---

### Task 5: Provider-owned closure walkthrough

**Files:**
- Update after evidence: `docs/risk-register.md`
- Update after evidence: `docs/operations.md`

- [ ] **Step 1: Configure the active GitHub ruleset**

Require the `verify` and `public-smoke` status checks. Keep required approvals at zero while there is only one code owner; require one approval after a second reviewer is added. Keep pull requests, thread resolution, deletion protection, and non-fast-forward protection enabled.

- [ ] **Step 2: Run the manual Clerk flow**

In a signed-out production Chrome window, open the home page, click **Sign in**, complete sign-in, verify the header refreshes, open Account, sign out, and confirm no `/v1/client` or `/v1/environment` request fails in DevTools Network.

- [ ] **Step 3: Run owner billing reconciliation**

Sign in with the configured owner QA account, open `/owner`, select Operations, run **Reconcile billing**, and record `checked`, `repaired`, `unchanged`, `missingClerkUser`, `ledgerCreated`, and `missingLedger`.

- [ ] **Step 4: Prove a real webhook and duplicate delivery**

In Stripe Workbench, open the CardForge webhook destination and resend one recent `customer.subscription.updated`, `customer.subscription.created`, or `checkout.session.completed` event to `https://cardforges.com/api/billing/webhook`. Confirm HTTP 200 and one processed ledger row, then resend the same event and confirm the response records the durable `duplicate` decision, the event row remains singular, and entitlement is unchanged.

- [ ] **Step 5: Dispatch authenticated smoke**

Run **Actions → Authenticated smoke → Run workflow** on `main`. Verify the preflight, signed-out Clerk modal, account matrix, developer/owner lifecycle, and paid project-import steps pass. Retain the run URL and artifact for the risk register.

- [ ] **Step 6: Close noisy Dependabot majors**

Close the open major framework/toolchain PRs after the new policy is on `main`. Leave legitimate patch/minor PRs open for normal review.

- [ ] **Step 7: Record final evidence**

Update statuses from `Awaiting live verification` to `Closed`, include the production commit and workflow run URL, run the complete gate again, and publish the documentation-only closure through a final reviewed PR.
