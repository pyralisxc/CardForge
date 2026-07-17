# CardForge Working Rules

CardForge is a live service app with local development, not a purely local app. Interpret Cameron's shorthand through that reality before choosing tools or verification paths.

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

For implementation, refactor, public-site, branding, accessibility, SEO, testing, review, or UI-polish work, agents MUST load and follow:

`.agents/skills/lean-repository-execution/SKILL.md`

Use one coherent objective branch and one final PR unless an independent ownership or high-risk billing, security, legal, migration, permission, or provider boundary requires separation.

During implementation, use one focused RED/GREEN cycle per behavior and run the complete repository gate once near completion. Default Git inspection to orientation, pre-commit, and pre-PR. Do not repeat unchanged Git/provider queries, poll agents, or create extra planning and progress artifacts.

Provider-backed work uses one preflight, one approved mutation, and one postflight verification. If the same check would run twice without a relevant state change, or two checks produce no new evidence, stop the loop and take over or report the blocker.

Direct instructions from Cameron override this protocol.
