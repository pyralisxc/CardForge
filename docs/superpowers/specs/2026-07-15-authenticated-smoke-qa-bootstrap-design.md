# Authenticated Smoke QA Bootstrap Design

## Goal

Make the scheduled and manually dispatched authenticated production smoke workflow self-sufficient when its four confirmed dedicated QA identities do not yet exist in the production Clerk instance.

## Considered approaches

1. **Create the users manually in Clerk.** This is simple but leaves recurring provider setup outside version control and caused the first production smoke run to fail.
2. **Bootstrap persistent QA identities before the workflow runs.** This is the selected approach. It keeps the reusable free, paid, developer, and owner identities stable while making setup repeatable and auditable.
3. **Create disposable users on every run.** This reduces persistent test data but adds provider churn, weakens the realism of reusable-account checks, and complicates the separate paid project-import test.

## Bootstrap behavior

A focused Node script will read the four existing protected email variables and the production `CLERK_SECRET_KEY`. For each configured email it will:

- normalize and validate the address without logging it;
- look up the exact Clerk user;
- create the user with an unlogged random password only when no user exists;
- fail closed if more than one user matches;
- ensure only the CardForge role keys required by that QA identity are aligned;
- preserve all unrelated private metadata;
- upsert the developer and owner QA identities into the existing server-owned developer profile table so asset-pipeline smoke coverage has the same durable profile state as normal developer setup;
- report role labels and created/aligned counts without exposing emails, passwords, keys, or user IDs.

The permanent QA role mapping is:

- free: no `cardforgeAccess` or `cardforgeRole` keys;
- paid: `cardforgeAccess: "paid"` and no owner role;
- developer: `cardforgeAccess: "dev"` and no owner role;
- owner: `cardforgeAccess: "dev"` and `cardforgeRole: "owner"`.

The script acts only on the four dedicated QA email variables confirmed by the owner. It does not inspect Stripe customers, repair subscriber identities, or create real customer accounts.
It does not create any new Supabase tables or browser policies; only the two QA developer-profile rows are inserted or aligned through the existing service-role path.

## Workflow integration

The authenticated smoke workflow will keep its existing protected-secret validation. After validation and before browser installation, it will run the bootstrap script. Browser tests then exercise the same production URL and the same reusable QA email variables as today.

The bootstrap is idempotent: scheduled runs reuse existing users and only realign CardForge role metadata if it drifted. A provider or validation error stops the workflow before Playwright begins.

## Testing

Unit tests will cover:

- creation of a missing QA user;
- reuse of an existing exact match;
- preservation of unrelated private metadata;
- removal of stale CardForge role keys for free/paid/developer identities;
- correct paid, developer, and owner metadata;
- rejection of missing, invalid, or duplicate email configuration;
- redacted output that contains no email, password, key, or user ID.

Before merge, lint, typecheck, the complete unit suite, production build, CI, public smoke, and Vercel preview must pass. After deployment, the owner will rerun Authenticated smoke and the run must complete successfully with uploaded evidence.

## Safety and recovery

- GitHub and Clerk secrets remain protected and are never printed.
- Random bootstrap passwords are not persisted or emitted; Clerk testing tokens continue to perform test sign-in.
- Existing unrelated Clerk metadata is preserved.
- Exact-email ambiguity fails without mutation.
- The four QA identities remain recognizable and can be deleted from Clerk if the smoke system is retired; the next authorized run can recreate them.
