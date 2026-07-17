---
name: lean-repository-execution
description: Use when implementing, refactoring, testing, reviewing, or polishing a CardForge repository objective, especially when Git inspection, agent polling, provider checks, planning, or repeated verification could consume disproportionate time or credits.
---

# Lean Repository Execution

## Principle

Deliver the approved outcome with the least process that protects correctness and the actual risk boundary. Strict safety does not mean repeated Git ceremony.

## Risk lanes

- **Routine:** copy, styling, branding, SEO, docs, and contained UI.
- **Product:** application behavior, accessibility, data models, exports, and compatibility.
- **High risk:** billing, entitlements, authentication, permissions, security, legal identity or binding terms, production migrations, irreversible persistence, and provider/domain mutations.

## Execution

1. **Orient once.** Read `AGENTS.md`, affected owners, current status, and only necessary history. Reuse this orientation until files, ancestry, requirements, or provider state change.
2. **Use one coherent branch and PR.** Split only at independent ownership or high-risk rollout boundaries. Do not create workflow-only branches or chains of closely related PRs.
3. **Use the approved specification.** Do not generate another plan, ledger, or process document unless ambiguity blocks work or Cameron requests it.
4. **Implement cohesive batches.** Work inline by default. Use subagents only for independent work or one final review; do not create implementer-reviewer-fixer chains for ordinary tasks.
5. **Commit milestones.** Commit coherent outcomes, not every adjustment, test fix, or review note.

## Hard budgets

- **Git:** default to orientation, pre-commit, and pre-PR. Repeat only after state changed or to diagnose a specific failure.
- **Focused verification:** one intentional RED and one GREEN run per behavior. Rerun only after relevant code changes or a failure that needs diagnosis.
- **Full verification:** run once after implementation and cleanup. After a failure, rerun the failing portion; repeat the full gate only when the fix could affect the wider system.
- **Review:** one final independent review per PR and one targeted re-review of blocking fixes.
- **CI:** inspect the final run once. Reinspect only after a new push or changed check state.
- **Providers:** for high-risk changes, use one preflight, one approved mutation, and one postflight verification. Do not poll providers during ordinary edits.
- **Agents:** do not poll repeatedly. After a meaningful wait, request status once; if there is still no evidence of progress, interrupt and take over.

## Loop breaker

Stop immediately when either condition occurs:

- the same command, query, or verification is about to run twice without an intervening relevant change;
- two consecutive checks produce no new evidence.

State what is known, identify the unanswered question, and take the smallest action that answers it or report the blocker. Never keep checking unchanged state.

## Verification by lane

- **Routine:** focused check while building; full repository gate at PR completion.
- **Product:** focused tests plus typecheck/browser evidence as relevant; full gate and final review once.
- **High risk:** Product checks plus explicit failure safety, rollback/recovery, least privilege, idempotency where applicable, and final provider-backed proof.

High risk justifies stronger controls, not rediscovery of unchanged context.

## Reporting

Update Cameron only at a milestone, blocker, approval boundary, or completion. Final reports contain outcome, ownership, verification, provider proof, removed legacy, and unresolved risk.
