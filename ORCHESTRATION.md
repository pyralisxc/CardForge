# CardForge Orchestration

This file owns CardForge's stable branch, CI, hosted Preview, provider-migration, and human acceptance boundaries. It is not a status ledger. Always query GitHub, Vercel, Supabase, and other providers for current state rather than recording transient SHAs, deployments, limits, or active work here.

`AGENTS.md` and the repo-local Founder-to-Feature and Lean Repository Execution skills remain the development authority. Product meaning belongs in `docs/product-direction.md`; shipped ownership belongs in `docs/architecture.md`; provider seams belong in `docs/integrations.md`; operational procedure belongs in `docs/operations.md`.

## Branch roles

- A coherent feature branch and pull request own each active implementation package. Normal feature PRs target `vercel-preview`, not `main`; split only at independent ownership, rollback, or high-risk rollout boundaries.
- GitHub CI is the normal deterministic code-health loop. Ordinary feature, documentation, and test branches do not deploy to Vercel.
- `vercel-preview` is the accumulating, CI-verified **integration/staging branch** for the current product crunch. Its merge history is retained. Integrate feature PRs by guarded merge; do not reset, force-update, or repoint the branch as a disposable deployment pointer.
- `main` is the production deployment branch and remains the authoritative repository baseline together with live provider state.

## Preview cadence

1. Resolve product meaning before implementation when the change crosses owners or changes creator expectations.
2. Build coherent work on a feature branch; require the feature PR's exact-head GitHub `verify` and other applicable gates before merging into `vercel-preview`.
3. Integrate the verified PR into `vercel-preview`, preserving ancestry. The new integration SHA is the accumulated Preview checkpoint. Native Vercel deployment follows that branch; do not manufacture commits or reset branch refs to chase deployment status.
4. Verify Preview-specific migrations and provider boundaries when affected. For meaningful hosted candidates, require a READY deployment and exact-SHA `preview-smoke`; exercise the changed signed-in journeys at `https://card-forge-git-vercel-preview-pyralis-projects.vercel.app` when automation cannot establish the claim.
5. Repeat bounded implementation/integration cycles while the active crunch still has material work. Keep already-integrated features and their verification history; avoid scattered direct `main` PRs.
6. When Preview is substantially complete, freeze the **exact current Preview SHA** as the candidate and open/reconcile the Preview-to-`main` release PR. Recheck accumulated changes, migration order, live-provider risks, and required checks against that exact candidate; a newer Preview merge invalidates prior acceptance.
7. Give Cameron the stable Preview URL, exact candidate SHA, remaining risks, and concise review scope. A READY deployment proves availability, not acceptance. Promote only after Cameron explicitly approves that exact candidate and the production/provider release boundaries are satisfied.

Do not create no-op commits, temporary branches, or repeated provider-triggering refs to chase deployment state or quotas.

## Provider and migration boundary

- Preview uses the provider-specific staging seams documented in `docs/integrations.md` and `docs/operations.md`.
- Supabase migrations are immutable and forward-only. A candidate that depends on a migration must apply and verify that migration in the Preview environment before application behavior is accepted there.
- Production migrations, provider mutations, billing/auth changes, destructive operations, and other consequential releases follow their owner-specific approval and verification gates. Preview success never grants production authority.
- Prefer batching related schema/provider work into a deliberate release candidate so `main` moves at a meaningful product boundary rather than for every local increment.

## Routine authority and human gates

Agents may routinely create feature branches, implement an authorized referent, run focused checks, open or update a PR targeting `vercel-preview`, inspect CI, and integrate a green feature PR into accumulated Preview. Only the final Preview-to-`main` promotion is founder-gated; provider/destructive operations retain their independent gates.

Cameron's explicit acceptance is required before merging into `main`. Additional explicit approval remains required wherever `AGENTS.md`, provider policy, or the active task requires it—for example production/provider mutation, destructive action, permission expansion, or real billing activity.

After delivery, reconcile only verified durable truth into the existing canonical owner and close resolved work. Git and provider history preserve the development record; do not create a parallel release diary.
