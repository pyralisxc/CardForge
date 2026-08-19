# CardForge Working Rules

CardForge is a live service app with local development, not a purely local app. Interpret Cameron's shorthand through that reality before choosing tools or verification paths.

## Workflow Authority

For CardForge implementation, refactor, testing, review, public-site, branding, accessibility, SEO, or UI-polish work, load and follow `.agents/skills/lean-repository-execution/SKILL.md` before applying generic process guidance.

The lean skill is CardForge's sole execution workflow. Do not create `docs/superpowers/**` or any planning, ledger, status, workflow, or progress artifact unless Cameron explicitly requests that artifact. Use a compact inline plan only when the task is high risk, materially ambiguous, or Cameron asks for one.

## Native-first integration rule

CardForge owns CardForge product policy. Providers and frameworks own their supported identity, payment, database, email, analytics, delivery, protocol, cache, redirect, retry, and deployment lifecycles whenever those native paths satisfy the product requirement.

Before changing an external integration:

- read the current official provider/framework guidance once;
- identify the provider-native solution before designing CardForge glue;
- use the provider's supported lifecycle directly unless a concrete product requirement cannot be met that way;
- if extra CardForge orchestration is necessary, keep only the minimum behavior that bridges the documented gap and state that reason in the PR;
- prefer deleting a workaround over preserving it as a compatibility layer when the native path now covers the requirement;
- never add a second auth/session store, provider retry system, delivery ledger, cache, redirect protocol, or SDK abstraction merely for flexibility.

`docs/integrations.md` is the human trace map for provider ownership and intentional CardForge seams. If an integration cannot be explained through that map in a few hops, simplify the implementation before adding another layer.

## Cameron Shorthand

- Treat short replies like "yes", "do that", "verify it", "push it", "full clean cut", or similar as continuing the most recent concrete objective.
- Before acting on shorthand, map the request to CardForge's actual ownership boundaries: local code, public UI, signed-in account state, or provider-owned systems.
- If the request touches production services, account state, payments, email, owner tools, domain setup, or provider dashboards, assume live-provider verification is required unless Cameron explicitly asks for local-only work.
- Do not expand vague approval into broad tool-chasing. Pick the smallest valid path that proves the specific claim.

## Verification Rules

- Code health: use focused unit tests, `tsc --noEmit`, and `next build` as appropriate.
- Public UI: localhost is acceptable for pages and components that do not depend on real signed-in provider state.
- Auth/provider flows: verify on `https://cardforges.com` in the correct browser profile, because Clerk, Stripe, Resend, Supabase, Vercel, domains, and cookies are live service concerns.
- Owner/admin flows must be verified in the Chrome profile signed into CardForge as the configured owner QA account.
- Do not use raw HTTP requests to judge signed-in behavior. They do not carry the browser session and can produce misleading failures.
- Do not chase local Clerk, Stripe, Resend, Supabase, or browser-profile failures unless the task is specifically local-provider setup.
- If a verification path fails because the method is invalid for the target, stop and report the mismatch instead of trying unrelated tools.
- Keep verification reports concise: what was checked, what passed, what failed, and whether the failure matters.

## Local Development Boundaries

- Localhost can prove build output, routing shells, and public UI behavior.
- Localhost should not be treated as final proof for owner access, payments, email delivery, production domain behavior, or provider dashboard state.
- Prefer live checks for production service behavior after code is pushed and deployed.

## Lean Repository Execution

Use one coherent objective branch and one final PR unless an independent ownership or high-risk billing, security, legal, migration, permission, or provider boundary requires separation.

During implementation, use one focused RED/GREEN cycle per behavior and run the complete repository gate once near completion. Default Git inspection to orientation, pre-commit, and pre-PR. Do not repeat unchanged Git/provider queries, poll agents, or create extra planning and progress artifacts.

For remote GitHub-only work, do not use file-writing actions that create commits as the implementation loop. Prepare related file changes as one Git tree/commit, or an equivalent batch, and move the branch once per coherent milestone. GitHub CI is the code-health loop; Vercel Preview is hosted integration proof for a deployable checkpoint, not a substitute compile loop. Do not push incomplete, no-op, or test-only commits merely to obtain or retrigger a preview. If Vercel is rate limited, stop pushing until the provider state changes instead of creating more commits.

Provider-backed work uses one preflight, one approved mutation, and one postflight verification. If the same check would run twice without a relevant state change, or two checks produce no new evidence, stop the loop and take over or report the blocker.

Direct instructions from Cameron override this protocol.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
