# CardForge Orchestration

This file owns CardForge's stable branch, CI, hosted Preview, provider-migration, and human acceptance boundaries. It is not a status ledger. Always query GitHub, Vercel, Supabase, and other providers for current state rather than recording transient SHAs, deployments, limits, or active work here.

`AGENTS.md` and the repo-local Founder-to-Feature and Lean Repository Execution skills remain the development workflow authority. The [CardForge Google Drive product wiki](https://drive.google.com/file/d/1SagFp1f95MLEp7paLl3RP18apMbXDfzK/view) owns greater cross-branch future direction; `docs/product-direction.md` records branch-local product and interaction context. Implementation ownership for this revision is described in `docs/architecture.md`, provider seams in `docs/integrations.md`, and operational procedure in `docs/operations.md`; source, live providers, and deployed behavior require their own verification.

The cross-version product wiki migrated from Confluence to [Google Drive](https://drive.google.com/file/d/1NSS0PQHyjsM18-kHEyTbWdaM6_QH1OXG/view) on November 19, 2026. Historical Confluence links do not overrule the Drive owner's current decisions. The next intended release is **0.1.0**, superseding the never-released 0.0.1 draft. This documentation decision does not authorize Main promotion, a tag, or publication.\n\n## Branch roles

- A coherent feature branch and pull request own each active implementation package. Normal feature PRs target `vercel-preview`, not `main`; split only at independent ownership, rollback, or high-risk rollout boundaries.
- GitHub CI is the normal deterministic code-health loop. Ordinary feature, documentation, and test branches do not deploy to Vercel.
- `vercel-preview` is the accumulating, CI-verified **integration/staging branch** for the current product crunch. Its merge history is retained. Integrate feature PRs by guarded merge; do not reset, force-update, or repoint the branch as a disposable deployment pointer.
- `main` is the production deployment branch and remains the authoritative repository baseline together with live provider state.

Keep these two long-lived branches and hosted environments. Short-lived PR branches do not imply another deployment; GitHub release tags identify shipped versions, not a third environment.

## Preview cadence

1. Resolve product meaning before implementation when the change crosses owners or changes creator expectations.
2. Build coherent work on a feature branch; require the feature PR's exact-head GitHub `verify` and other applicable gates before merging into `vercel-preview`.
3. Integrate the verified PR into `vercel-preview`, preserving ancestry. The new integration SHA is the accumulated Preview checkpoint. Native Vercel deployment follows that branch; do not manufacture commits or reset branch refs to chase deployment status.
4. Verify Preview-specific migrations and provider boundaries when affected. For meaningful hosted candidates, require a READY deployment and exact-SHA `preview-smoke`; exercise the changed signed-in journeys at `https://card-forge-git-vercel-preview-pyralis-projects.vercel.app` when automation cannot establish the claim.
5. Repeat bounded implementation/integration cycles while the active crunch still has material work. Keep already-integrated features and their verification history; direct `main` maintenance follows the separate lane below, never as a shortcut for releasing unfinished features.
6. When Preview is substantially complete, freeze the **exact current Preview SHA** as the candidate and open/reconcile the Preview-to-`main` release PR. Recheck accumulated changes, migration order, live-provider risks, and required checks against that exact candidate; a newer Preview merge invalidates prior acceptance.
7. Give Cameron the stable Preview URL, exact candidate SHA, remaining risks, and concise review scope. A READY deployment proves availability, not acceptance. Promote only after Cameron explicitly approves that exact candidate and the production/provider release boundaries are satisfied.

Do not create no-op commits, temporary branches, or repeated provider-triggering refs to chase deployment state or quotas.

## Main maintenance lane

Production maintenance need not wait for the next Preview feature release. Dependency updates, CI maintenance and hotfixes may use a short-lived branch based on current `main` and a PR targeting `main`. A maintenance label is not evidence of low risk or compatibility.

1. Keep the candidate limited to maintaining the released product; exclude unrelated Preview features. Review the actual dependency/lockfile or workflow delta and satisfy current-base GitHub `verify`, affected checks and review-thread requirements without bypassing branch protection.
2. Verify the exact Main-based candidate at the affected boundary. Runtime/auth/provider changes need appropriate browser/provider evidence; use a bounded isolated candidate deployment when hosted proof is needed, without replacing accumulated Preview or enabling a third permanent environment. CI-only changes do not require an application deployment merely for ceremony.
3. Send Cameron the Main base, exact candidate SHA, scope, verification, remaining risks and the isolated review URL when applicable. The stable accumulated Preview is not this candidate. Wait for explicit approval of this exact maintenance candidate before merging; a changed candidate invalidates approval. Production/provider mutations retain their own gates.
4. Merge through GitHub and perform the applicable production deployment/smoke and provider postflight. A successful CI check or READY deployment never supplies approval.
5. Promptly reconcile updated `main` into `vercel-preview` through a forward-merge PR. Preserve Preview features and newer intentional dependency choices, resolve manifests and regenerate/verify the lockfile with the native package manager, then run affected CI. Do not reset Preview, blindly choose one side of package files, or promote Preview into Main to achieve reconciliation. Substantive conflicts follow the normal resolution gate before integration.

## Versioned releases

The accepted release model is an approved Main commit tagged `vX.Y.Z`, with a GitHub Release, concise release notes and the authorized versioned plugin assets described in [Operations](docs/operations.md#versioned-releases-and-plugin-assets). Maintenance can produce a patch release while Preview continues toward the next milestone. Tags, release publication and artifact uploads are part of the approved release operation, not permission granted by a package version or a green PR. This model does not claim that release automation or a particular release already exists.

## Provider and migration boundary

- Preview uses the provider-specific staging seams documented in `docs/integrations.md` and `docs/operations.md`.
- **Standing local/Preview/Staging development authority:** once a CardForge objective is authorized, agents may perform bounded nonproduction SQL and infrastructure work needed for that objective without new founder approval for each statement. This includes transactional fixtures and rollback tests, recoverable test-data inserts/updates/deletes, scoped Staging-only repairs, and migration verification. Before writing, establish the exact Staging project, affected scope, expected outcome, and recovery path; afterward verify the native result. Authorization to develop is not authority to ignore provider permissions or a tool's required interaction.
- Persistent schema changes still use new, immutable, forward-only migration files and the existing GitHub/Preview integration; never introduce untracked Staging schema drift or reapply an already-applied migration. A candidate depending on a migration is not accepted until that migration and affected provider behavior are verified in Staging. An expired/ambiguous confirmation or write receipt requires native readback, not blind retry.
- Production writes/migrations and Main promotion, permission expansion or RLS bypass, credential and billing changes, cross-environment provider configuration, broad reset/truncate, irreversible or broad deletion of protected creator/catalog content or retained history, and other reserved owner decisions still require explicit approval. Direct SQL must not bypass CardForge's native Pipeline review/publication, Storage deletion, identity, or protected ledger workflows. Preview success never grants production authority.
- Prefer batching related schema/provider work into a deliberate release candidate so `main` moves at a meaningful product boundary rather than for every local increment.

## Routine authority and human gates

Agents may routinely create feature branches, implement an authorized referent, run focused checks, open or update a PR targeting `vercel-preview`, inspect CI, integrate a green feature PR into accumulated Preview, and execute bounded nonproduction SQL/infrastructure work under the standing authority above. Do not ask the founder again for each routine Staging statement in the same authorized objective.

Cameron's explicit acceptance is required before merging into `main`. Additional explicit approval is reserved for the consequential operations described above or separately required by `AGENTS.md`, provider policy, or the active task. Follow any provider- or client-enforced confirmation through its supported path; do not sidestep it with new credentials, alternate endpoints, or hidden mutations.

After delivery, reconcile only verified durable truth into the existing canonical owner and close resolved work. Git and provider history preserve the development record; do not create a parallel release diary.
