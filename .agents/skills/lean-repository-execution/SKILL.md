---
name: lean-repository-execution
description: Use when implementing, refactoring, testing, reviewing, or polishing a CardForge repository objective, especially when Git inspection, agent polling, provider checks, planning, or repeated verification could consume disproportionate time or credits.
---

# Lean Repository Execution

## Authority and startup

Use this as CardForge's complete execution workflow. Load it after `AGENTS.md` and before applying generic task-process guidance.

State the selected risk lane, concrete objective, and verification budget in one compact progress update. Do not write a plan, ledger, status, workflow, or progress file unless Cameron explicitly requests it. Never create `docs/superpowers/**`.

Use an inline plan only when Cameron asks, material ambiguity blocks implementation, or the work is high risk. Otherwise, proceed directly from the approved objective.

## Principle

Deliver the approved outcome with the least process that protects correctness and the actual risk boundary. Strict safety does not mean repeated Git ceremony.

## Risk lanes

- **Routine:** copy, styling, branding, SEO, docs, and contained UI.
- **Product:** application behavior, accessibility, data models, exports, and compatibility.
- **High risk:** billing, entitlements, authentication, permissions, security, legal identity or binding terms, production migrations, irreversible persistence, and provider/domain mutations.

## Execution

1. **Orient once.** Read `AGENTS.md`, affected owners, current status, and only necessary history. Reuse this orientation until files, ancestry, requirements, or provider state change.
2. **Use one coherent branch and PR.** Split only at independent ownership or high-risk rollout boundaries. Do not create workflow-only branches or chains of closely related PRs.
3. **Implement cohesive batches.** Work inline by default. Do not use subagents for ordinary implementation. Use one only for independent investigation or high-risk/cross-owner final review.
4. **Commit milestones.** Commit coherent outcomes, not every adjustment, test fix, or review note.
5. **Keep context lean.** Summarize routine tool output and retain only evidence that changes a decision, proves a check, or explains a failure.

## Hard budgets

- **Git:** default to orientation, pre-commit, and pre-PR. Repeat only after state changed or to diagnose a specific failure.
- **Focused verification:** one intentional RED and one GREEN run per behavior. Rerun only after relevant code changes or a failure that needs diagnosis.
- **Full verification:** run once after implementation and cleanup. After a failure, rerun the failing portion; repeat the full gate only when the fix could affect the wider system.
- **Review:** self-review every PR diff. Add one independent review only for high-risk changes or material cross-owner changes; re-review only blocking fixes.
- **CI:** inspect the final run once. Reinspect only after a new push or changed check state.
- **Providers:** for high-risk changes, use one preflight, one approved mutation, and one postflight verification. Do not poll providers during ordinary edits.
- **Agents:** no agent fan-out by default. Do not poll. After a meaningful wait, request status once; if there is still no evidence of progress, interrupt and take over.

## Loop breaker

Stop immediately when either condition occurs:

- the same command, query, or verification is about to run twice without an intervening relevant change;
- two consecutive checks produce no new evidence.

State what is known, identify the unanswered question, and take the smallest action that answers it or report the blocker. Never keep checking unchanged state.

## Verification by lane

- **Routine:** focused check while building; full repository gate at PR completion.
- **Product:** focused tests plus typecheck/browser evidence as relevant; full gate and self-review once.
- **High risk:** Product checks plus explicit failure safety, rollback/recovery, least privilege, idempotency where applicable, one independent review, and final provider-backed proof.

High risk justifies stronger controls, not rediscovery of unchanged context.

## Reporting

Update Cameron only at a milestone, blocker, approval boundary, or completion. Final reports contain outcome, ownership, verification, provider proof when relevant, removed legacy, and unresolved risk.
