# CardForge Orchestration

This file owns CardForge's stable branch, CI, hosted Preview, provider-migration, and human acceptance boundaries. It is not a status ledger. Always query GitHub, Vercel, Supabase, and other providers for current state rather than recording transient SHAs, deployments, limits, or active work here.

`AGENTS.md` and the repo-local Founder-to-Feature and Lean Repository Execution skills remain the development authority. Product meaning belongs in `docs/product-direction.md`; shipped ownership belongs in `docs/architecture.md`; provider seams belong in `docs/integrations.md`; operational procedure belongs in `docs/operations.md`.

## Branch roles

- A coherent feature branch and pull request own an active development package. Related creator-facing improvements may accumulate there until they form a substantial review candidate. Split only at independent ownership, rollback, or high-risk rollout boundaries.
- GitHub CI is the normal deterministic code-health loop. Ordinary feature, documentation, and test branches do not deploy to Vercel.
- `vercel-preview` is a reusable deployment pointer, not a development or history branch. Move it to the exact reviewed pull-request SHA only when the integrated candidate is worth hosted inspection.
- `main` is the production deployment branch and remains the authoritative repository baseline together with live provider state.

## Preview cadence

1. Resolve product meaning before implementation when the change crosses owners or changes creator expectations.
2. Build and verify coherent milestones on the feature branch. Use focused local checks and the pull request's authoritative full CI gate.
3. When the candidate is coherent, move `vercel-preview` to that exact SHA once. Move it again only after a relevant fix changes the candidate.
4. Verify the affected hosted journey on the stable Preview URL: `https://card-forge-git-vercel-preview-pyralis-projects.vercel.app`.
5. Give Cameron the stable URL, exact candidate SHA, and concise review scope. A READY deployment proves availability; it is not approval.
6. Merge to `main` only after Cameron explicitly approves that exact candidate.

Do not create no-op commits, temporary branches, or repeated provider-triggering refs to chase deployment state or quotas.

## Provider and migration boundary

- Preview uses the provider-specific staging seams documented in `docs/integrations.md` and `docs/operations.md`.
- Supabase migrations are immutable and forward-only. A candidate that depends on a migration must apply and verify that migration in the Preview environment before application behavior is accepted there.
- Production migrations, provider mutations, billing/auth changes, destructive operations, and other consequential releases follow their owner-specific approval and verification gates. Preview success never grants production authority.
- Prefer batching related schema/provider work into a deliberate release candidate so `main` moves at a meaningful product boundary rather than for every local increment.

## Routine authority and human gates

Agents may routinely create feature branches, implement an authorized referent, run focused checks, open or update its pull request, inspect CI, and prepare an exact-SHA Preview candidate.

Cameron's explicit acceptance is required before merging into `main`. Additional explicit approval remains required wherever `AGENTS.md`, provider policy, or the active task requires it—for example production/provider mutation, destructive action, permission expansion, or real billing activity.

After delivery, reconcile only verified durable truth into the existing canonical owner and close resolved work. Git and provider history preserve the development record; do not create a parallel release diary.
