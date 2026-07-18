## Workflow Authority

For CardForge implementation, refactor, testing, review, public-site, branding, accessibility, SEO, or UI-polish work, load and follow:

`.agents/skills/lean-repository-execution/SKILL.md`

The lean skill is CardForge's sole execution workflow. Do not create `docs/superpowers/**` or any planning, ledger, status, workflow, or progress artifact unless Cameron explicitly requests that artifact. Use a compact inline plan only when the task is high risk, materially ambiguous, or Cameron asks for one.

## Lean Repository Execution

Use one coherent objective branch and one final PR unless an independent ownership or high-risk billing, security, legal, migration, permission, or provider boundary requires separation.

During implementation, use one focused RED/GREEN cycle per behavior and run the complete repository gate once near completion. Default Git inspection to orientation, pre-commit, and pre-PR. Do not repeat unchanged Git/provider queries, poll agents, or create extra planning and progress artifacts.

Provider-backed work uses one preflight, one approved mutation, and one postflight verification. If the same check would run twice without a relevant state change, or two checks produce no new evidence, stop the loop and take over or report the blocker.

Direct instructions from Cameron override this protocol.
