# Billing Subscriber Console Design

## Goal

Make the owner billing console subscriber-first, keep checkout attempts available without cluttering daily operations, and safely reconnect subscriptions that still reference a retired Clerk development user.

## Owner experience

The Billing snapshot keeps its configuration and subscription-count metrics, then presents two tabs:

1. **Subscribers** is selected by default. It shows Stripe subscription records only. Active and trialing subscriptions appear first, followed by attention states such as past due, then ended subscriptions. Each row shows status, price and interval, renewal or cancellation timing, customer email, and Clerk connection status.
2. **Checkout history** is secondary and loads only when selected. It shows Stripe Checkout Sessions, including completed, abandoned, and repeated attempts. It is clearly described as operational history rather than a list of accounts or subscribers.

The history tab includes a configurable maximum record count, defaulting to 500 and constrained to 1–500. CardForge also applies a fixed 30-day window. Both limits apply, so the console returns at most the configured number of sessions created during the visible 30-day period.

The **Clear displayed history** action records the current time as a visibility cutoff after owner confirmation. It does not delete or alter Stripe records. Sessions created after that cutoff remain visible. The UI states this distinction before confirmation.

## Data ownership and retention

Stripe remains the source of truth for checkout sessions, subscriptions, customers, and billing history. CardForge stores only two display preferences in the existing server-only owner settings row:

- `billing_checkout_history_limit`, default 500, constrained to 1–500.
- `billing_checkout_history_cleared_before`, nullable timestamp used as the owner-selected visibility cutoff.

The effective history start is the later of:

- 30 days before the request; or
- `billing_checkout_history_cleared_before`.

The server requests Stripe Checkout Sessions using that creation-time filter and cursor pagination, stopping at the configured cap. CardForge does not copy sessions into a new history table and does not attempt to delete Stripe financial records.

## API behavior

The owner billing summary endpoint remains owner-only and no-store.

- A normal request returns configuration and subscriptions without loading checkout history.
- An explicit history request returns filtered checkout sessions plus the effective retention settings.
- An owner-only update validates and persists the history limit.
- An owner-only clear action advances the visibility cutoff to the current server time.

Invalid values return a structured 400 response. Missing Supabase configuration returns a safe default for reads and a clear 503 for settings mutations. Stripe or Clerk failures remain fail-closed and produce no partial entitlement changes.

## Subscription-to-Clerk repair

Reconciliation first tries the Clerk user ID stored in Stripe subscription metadata. If that user no longer exists:

1. Resolve the Stripe customer email.
2. Search the production Clerk instance for an exact email match.
3. Proceed automatically only when exactly one Clerk user matches.
4. Update the subscription metadata to the production Clerk user ID while preserving all unrelated metadata.
5. Apply the existing Stripe identifiers and paid entitlement to that Clerk user.
6. Keep the Supabase subscription baseline current and report the repair in the reconciliation result.

If no production Clerk user matches, the subscription remains active and unchanged. The console reports **Needs customer sign-in** with the customer email. The support instruction is: ask the customer to sign in or create a CardForge account with the same email, then run reconciliation again. The customer must not purchase again.

If multiple Clerk users match the same email, reconciliation does not guess. It reports an ambiguous mapping for owner review. Provider errors other than a confirmed missing Clerk user continue to fail the reconciliation rather than being misclassified.

## Security and privacy

- All billing endpoints require verified owner access.
- Stripe and Clerk secret keys remain server-only.
- The owner UI may show the customer email needed for support but never renders provider secrets.
- Metadata repair changes only the `clerkUserId` mapping and preserves other Stripe metadata.
- Clearing history is display-only and cannot destroy accounting evidence.
- The owner settings table remains RLS-enabled with no permissive browser policy; server service-role access owns the data path.

## Testing and verification

Automated coverage will include:

- history-limit normalization and 1–500 validation;
- effective 30-day/cutoff calculation;
- multi-page Stripe history collection stopping at the configured cap;
- default summary behavior that does not request checkout history;
- display clearing without Stripe deletion;
- Subscribers as the default tab and lazy history loading;
- exact-email Clerk repair, including preserved Stripe metadata;
- no-match and ambiguous-match behavior without entitlement mutation;
- non-404 Clerk/provider failures remaining fatal;
- Supabase migration constraints, RLS posture, and defaults.

Before merge, the branch must pass lint, typecheck, the full unit suite, production build, GitHub CI, public smoke, and Vercel preview deployment. After merge, production must pass route health checks and show no new billing runtime error group.

## Live closure sequence

After deployment:

1. Open Owner → Operations → Billing snapshot and confirm Subscribers is the default tab.
2. Confirm exactly one active Stripe subscription is shown.
3. If its customer has a production Clerk account under the Stripe email, run Reconcile and confirm the mapping and entitlement are repaired.
4. If no production account exists, ask the customer to sign in or register with that same email, then run Reconcile again.
5. Open Checkout history, verify the 30-day/default-500 policy, change the cap once, and confirm it persists.
6. Clear displayed history, confirm old attempts disappear, and confirm Stripe subscription data remains unchanged.
