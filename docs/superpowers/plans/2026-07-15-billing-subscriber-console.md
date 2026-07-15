# Billing Subscriber Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make owner billing subscriber-first, retain only a configurable view of Stripe checkout history, and reconnect stale Stripe subscriptions to exact matching production Clerk accounts.

**Architecture:** Stripe remains authoritative. The owner summary loads subscriptions by default and history only on request; Supabase stores only a history cap and display cutoff. A focused billing panel owns the two-tab UI, while an injected reconciliation helper performs deterministic, testable Clerk mapping repair before the route updates ledger state.

**Tech Stack:** Next.js 15 App Router, React 18, TypeScript, Stripe Node SDK, Clerk Backend SDK, Supabase Postgres, Vitest, Radix Tabs and Alert Dialog.

## Global Constraints

- Subscribers is the default tab; checkout attempts never precede or mix with subscription rows.
- Checkout history is limited to the later of 30 days ago or the owner clear cutoff, and to a configurable 1–500 records with default 500.
- Clear history changes CardForge visibility only and never deletes Stripe records.
- Automatic mapping requires exactly one production Clerk account with the Stripe customer email.
- A customer without a production Clerk account signs in or registers with the same email and never purchases again.
- All mutations remain owner-only, no-store, server-side, and fail closed for unclassified provider errors.
- Stripe metadata updates preserve every key except the corrected `clerkUserId`.

---

### Task 1: Persist and normalize checkout-history preferences

**Files:**
- Create: `supabase/migrations/202607150002_billing_history_preferences.sql`
- Create: `tests/unit/supabase-billing-history-preferences-migration.test.ts`
- Modify: `src/features/owner/lib/ownerBillingOperations.ts`
- Modify: `tests/unit/owner-billing-operations.test.ts`

**Interfaces:**
- Produces: `DEFAULT_BILLING_HISTORY_LIMIT`, `MAX_BILLING_HISTORY_LIMIT`, `BILLING_HISTORY_RETENTION_DAYS`, `normalizeBillingHistoryLimit(value)`, and `getEffectiveBillingHistoryStart({ now, clearedBefore })`.
- Persists: `billing_checkout_history_limit integer not null default 500 check (... between 1 and 500)` and `billing_checkout_history_cleared_before timestamptz` on `cardforge_owner_settings`.

- [ ] **Step 1: Write failing normalization and migration tests**

```ts
expect(normalizeBillingHistoryLimit(undefined)).toBe(500);
expect(normalizeBillingHistoryLimit(0)).toBe(1);
expect(normalizeBillingHistoryLimit(900)).toBe(500);
expect(getEffectiveBillingHistoryStart({
  now: new Date('2026-07-15T12:00:00.000Z'),
  clearedBefore: '2026-07-14T12:00:00.000Z',
})).toBe('2026-07-14T12:00:00.000Z');
```

The migration test reads the SQL and asserts both columns, the 1–500 check, defaults, and no grant to `anon` or `authenticated`.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/unit/owner-billing-operations.test.ts tests/unit/supabase-billing-history-preferences-migration.test.ts`

Expected: FAIL because the helpers and migration do not exist.

- [ ] **Step 3: Implement the migration and pure helpers**

```ts
export const DEFAULT_BILLING_HISTORY_LIMIT = 500;
export const MAX_BILLING_HISTORY_LIMIT = 500;
export const BILLING_HISTORY_RETENTION_DAYS = 30;

export const normalizeBillingHistoryLimit = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_BILLING_HISTORY_LIMIT;
  return Math.min(MAX_BILLING_HISTORY_LIMIT, Math.max(1, Math.trunc(parsed)));
};
```

`getEffectiveBillingHistoryStart` returns the later ISO timestamp between 30 days before `now` and a valid `clearedBefore`.

- [ ] **Step 4: Verify GREEN**

Run the focused command from Step 2. Expected: both files pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/202607150002_billing_history_preferences.sql tests/unit/supabase-billing-history-preferences-migration.test.ts src/features/owner/lib/ownerBillingOperations.ts tests/unit/owner-billing-operations.test.ts
git commit -m "Add billing history retention preferences"
```

### Task 2: Add server-only history settings and bounded Stripe pagination

**Files:**
- Create: `src/features/owner/lib/ownerBillingSettingsStore.ts`
- Create: `tests/unit/owner-billing-history.test.ts`
- Modify: `src/features/owner/lib/ownerBillingOperations.ts`
- Modify: `src/app/api/owner/billing/summary/route.ts`
- Modify: `tests/unit/owner-billing-operations.test.ts`

**Interfaces:**
- Produces: `getOwnerBillingHistorySettings()`, `updateOwnerBillingHistoryLimit(limit)`, and `clearOwnerBillingHistory(clearedAt)`.
- Produces: `listStripeCheckoutHistory({ stripe, createdGte, limit })` which requests pages of at most 100 and stops exactly at the normalized cap.
- Extends `OwnerBillingSnapshot` with `historySettings: { limit: number; retentionDays: 30; clearedBefore: string | null; effectiveStart: string }`.

- [ ] **Step 1: Write failing pagination and preference tests**

```ts
const sessions = await listStripeCheckoutHistory({
  stripe: { checkout: { sessions: { list } } },
  createdGte: 1_784_000_000,
  limit: 150,
});
expect(list).toHaveBeenNthCalledWith(1, { created: { gte: 1_784_000_000 }, limit: 100 });
expect(list).toHaveBeenNthCalledWith(2, { created: { gte: 1_784_000_000 }, limit: 50, starting_after: 'cs_100' });
expect(sessions).toHaveLength(150);
```

Also assert that invalid update values throw a 400-class store error and that clear persists only the cutoff timestamp.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/unit/owner-billing-history.test.ts tests/unit/owner-billing-operations.test.ts`

Expected: FAIL because the store and paginator do not exist.

- [ ] **Step 3: Implement settings storage and summary methods**

`GET /api/owner/billing/summary` always loads subscriptions with `status: 'all'` and expanded customers. It loads checkout sessions only when `includeHistory=1` is present. `PUT` accepts `{ historyLimit }`; `DELETE` sets the server-time cutoff. Every method calls `getCurrentOwnerAccess`, returns no-store JSON, and never calls a Stripe deletion API.

- [ ] **Step 4: Verify GREEN**

Run the focused command from Step 2. Expected: all focused tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/owner/lib/ownerBillingSettingsStore.ts src/features/owner/lib/ownerBillingOperations.ts src/app/api/owner/billing/summary/route.ts tests/unit/owner-billing-history.test.ts tests/unit/owner-billing-operations.test.ts
git commit -m "Load bounded Stripe checkout history on demand"
```

### Task 3: Repair stale Clerk mappings by exact customer email

**Files:**
- Modify: `src/features/billing/lib/billingReconciliation.ts`
- Modify: `tests/unit/billing-reconciliation.test.ts`
- Modify: `src/app/api/owner/billing/reconcile/route.ts`
- Modify: `src/features/owner/lib/ownerConsole.ts`
- Modify: `tests/unit/owner-console.test.ts`

**Interfaces:**
- Produces: `findExactClerkUserByEmail({ clerk, email })` returning `{ kind: 'matched'; user } | { kind: 'missing' } | { kind: 'ambiguous' }`.
- Produces: `repairStripeSubscriptionClerkMapping({ stripe, subscription, clerkUserId })`, preserving metadata with `{ ...subscription.metadata, clerkUserId }`.
- Extends reconciliation JSON with `mappingRepaired`, `needsCustomerSignIn`, and `ambiguousClerkUsers` counts while retaining existing fields.

- [ ] **Step 1: Write failing decision and metadata-preservation tests**

```ts
expect(await findExactClerkUserByEmail({ clerk, email: 'maker@example.com' })).toEqual({
  kind: 'matched',
  user: expect.objectContaining({ id: 'user_prod' }),
});
expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_123', {
  metadata: { existing: 'keep', clerkUserId: 'user_prod' },
});
```

Add separate missing, ambiguous, and provider-error cases. Add owner-copy expectations that say the customer should sign in with the same email and should not purchase again.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/unit/billing-reconciliation.test.ts tests/unit/owner-console.test.ts`

Expected: FAIL because matching and repair outcomes do not exist.

- [ ] **Step 3: Implement deterministic reconciliation**

For a missing/stale metadata user, retrieve the Stripe customer email, call Clerk `getUserList({ emailAddress: [email], limit: 2 })`, and proceed only for exactly one result. Apply the existing entitlement metadata, update the Stripe subscription `clerkUserId`, and update the Supabase subscription baseline `clerk_user_id`. Missing and ambiguous matches are counted without changing entitlement; all other provider errors still return 500.

- [ ] **Step 4: Verify GREEN**

Run the focused command from Step 2. Expected: all focused tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/billing/lib/billingReconciliation.ts tests/unit/billing-reconciliation.test.ts src/app/api/owner/billing/reconcile/route.ts src/features/owner/lib/ownerConsole.ts tests/unit/owner-console.test.ts
git commit -m "Reconnect stale billing accounts by exact email"
```

### Task 4: Build the subscriber-first two-tab owner panel

**Files:**
- Create: `src/features/owner/components/OwnerBillingPanel.tsx`
- Create: `src/features/owner/lib/ownerBillingPresentation.ts`
- Create: `tests/unit/owner-billing-presentation.test.ts`
- Modify: `src/features/owner/components/OwnerConsolePage.tsx`

**Interfaces:**
- Produces: `OwnerBillingPanel` with no parent-managed billing state.
- Produces: `sortOwnerSubscriptions(subscriptions)` and `getOwnerSubscriptionConnectionLabel(subscription)` for stable, tested presentation.

- [ ] **Step 1: Write failing presentation tests**

```ts
expect(sortOwnerSubscriptions([
  { id: 'sub_canceled', status: 'canceled' },
  { id: 'sub_active', status: 'active' },
  { id: 'sub_past_due', status: 'past_due' },
]).map(({ id }) => id)).toEqual(['sub_active', 'sub_past_due', 'sub_canceled']);
```

Also assert the default tab constant is `subscribers` and that missing mappings produce the support-oriented connection label.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run tests/unit/owner-billing-presentation.test.ts`

Expected: FAIL because the presentation module does not exist.

- [ ] **Step 3: Implement the focused panel and remove inline billing coordination**

The panel initially fetches `/api/owner/billing/summary`, renders Radix tabs with Subscribers active, and fetches `?includeHistory=1` only on first selection of Checkout history. The history tab includes the cap input, Save button, and Alert Dialog for Clear displayed history. The confirmation explicitly says Stripe records remain intact. Reconcile shows all mapping outcomes and reloads the active view.

- [ ] **Step 4: Verify GREEN and static quality**

Run:

```bash
npx vitest run tests/unit/owner-billing-presentation.test.ts
npm run lint
npm run typecheck
```

Expected: all commands pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/owner/components/OwnerBillingPanel.tsx src/features/owner/lib/ownerBillingPresentation.ts tests/unit/owner-billing-presentation.test.ts src/features/owner/components/OwnerConsolePage.tsx
git commit -m "Make owner billing subscriber first"
```

### Task 5: Verify migration, full product, and live provider workflow

**Files:**
- Modify if evidence changes: `docs/operations/launch-provider-verification.md`
- Modify after live proof: `docs/operations/release-risk-register.md`

**Interfaces:**
- Consumes all prior tasks; produces deployable evidence and a clean production handoff.

- [ ] **Step 1: Run full local verification**

```bash
npm run lint
npm run typecheck
npm run test
npm run build
git diff --check origin/main...HEAD
```

Expected: every command exits 0.

- [ ] **Step 2: Apply and verify the production Supabase migration**

Apply `202607150002_billing_history_preferences.sql`, query the two new columns and constraints, then run Supabase security and performance advisors. Expected: no warning/error security regression.

- [ ] **Step 3: Publish through protected delivery**

Push the feature branch, open a PR, verify GitHub CI, Public smoke, Vercel preview, review threads, and mergeability, then squash-merge with the expected head SHA.

- [ ] **Step 4: Verify production**

Confirm the exact merge SHA is READY on `cardforges.com` with no alias error, run `npm run health:production`, and inspect Vercel runtime errors plus 4xx/5xx groups.

- [ ] **Step 5: Complete the owner proof**

Confirm Subscribers is the default and the single active subscription is prominent. Run Reconcile. If the result says `needsCustomerSignIn: 1`, instruct the customer to sign in or register with the Stripe email and then rerun; never ask them to buy again. Verify the Clerk entitlement, Stripe metadata, and Supabase baseline agree before closing the billing risk.
