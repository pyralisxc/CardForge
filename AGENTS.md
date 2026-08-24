# CardForge Working Rules

CardForge is a live service app with local development. A fresh agent must be able to work from the repository and current providers without relying on prior chat history.

## Repository authority

Treat `main` plus live provider state as authoritative. Read current product truth in this order:

1. `README.md` for the live product/source map.
2. `docs/architecture.md` for ownership and invariants.
3. `docs/product-direction.md` for the intended product model and next delivery sequence; it does not override shipped behavior.
4. `docs/integrations.md` for provider-native ownership and trace paths.
5. `docs/operations.md` for current release/provider procedures.
6. `docs/risk-register.md` for unresolved or explicitly accepted risk only.

Do not reconstruct current requirements from old chats, closed PR prose, completed migration instructions, or historical branches when current code/docs/provider state answer the question. Git history remains evidence; it is not a second specification.

## Workflow authority

For CardForge implementation, refactor, testing, review, public-site, branding, accessibility, SEO, or UI-polish work, load and follow `.agents/skills/lean-repository-execution/SKILL.md` before generic process guidance.

The lean skill is CardForge's sole execution workflow. Do not create planning ledgers, status diaries, progress folders, or `docs/superpowers/**` unless Cameron explicitly requests that artifact. Use a compact inline plan only when work is high risk, materially ambiguous, or Cameron asks for one.

## Native-first integration rule

CardForge owns CardForge product policy. Providers/frameworks own their supported identity, payment, database, email, analytics, delivery, protocol, cache, redirect, retry, and deployment lifecycles whenever those native paths satisfy the requirement.

Before changing an external integration:

- read current official provider/framework guidance once;
- identify the provider-native solution before designing CardForge glue;
- use that native lifecycle unless a concrete CardForge requirement cannot be met;
- if extra orchestration is necessary, keep only the minimum bridge and state why in the PR;
- prefer deleting a workaround when the provider-native path now covers it;
- never add a second auth/session store, provider retry system, delivery ledger, cache, redirect protocol, or SDK abstraction merely for flexibility.

`docs/integrations.md` is the human trace map. If a provider journey cannot be explained there in a few hops, simplify before adding another layer.

## Human readability rule

A maintainer should be able to answer “where does this behavior live?” without reconstructing a graph from dozens of files. Keep route composition thin, feature owners explicit, public `client.ts`/`server.ts` interfaces narrow, and large modules separated by real responsibility rather than arbitrary line count.

When fixing a bug, first find the native owner and make the smallest change there. Do not create a unique workaround simply because it is locally convenient.

## Boundary failure contract

Every boundary owner must distinguish **unavailable**, **authentication required**, **not permitted**, **invalid input**, **conflict**, **not found**, and **limit reached**. Do not turn a provider timeout into signed-out, Free, inactive, empty, or missing state, and do not claim success after replacing unreadable persisted data with an empty value.

HTTP failures use the shared API error contract: stable code and kind, human message, retryability, correlation id, and a next action or structured limit when relevant. Agent tools must preserve equivalent boundary meaning in their result instead of flattening it into an ambiguous failure sentence. UI copy may be friendlier, but it must not erase the distinction.

Local browser work is not a CardForge metered allowance. Do not add proactive local quota warnings or cloud-style gates; surface actual browser rejection, invalid/corrupt data, and unsafe file constraints when they occur. Enforce and explain CardForge cloud, provider, permission, and submission limits at the action that crosses that boundary. Keep the authoritative server/provider check even when the client can explain a known limit earlier.

Do not add speculative guards for impossible states. A new failure branch must correspond to a real I/O, trust, persistence, concurrency, provider, validation, permission, or enforced-cap boundary and must leave authored work unchanged or recoverable.

## Roadmap and completed work

`docs/product-direction.md` owns the durable intended product model and delivery sequence. The live `/roadmap` and Supabase roadmap tables own publicly presented future/completed capability status and votes. Keep them consistent without turning either source into a duplicate of the other. When an official roadmap capability ships, mark it `shipped` so it appears as completed history while preserving votes. Do not leave completed work `planned` or `in_progress`. Delete only mistaken/duplicate rows when history has no value; normal completed roadmap records should remain shipped.

Closed implementation plans, migration cutovers, and rollout checklists belong in Git/provider history, not in current docs.

## Cameron shorthand

- Treat short replies like “yes”, “do that”, “verify it”, “push it”, or “full clean cut” as continuing the most recent concrete objective.
- Map the request to CardForge's actual ownership boundary before choosing tools.
- If the request touches production services, account state, payments, email, owner tools, domain setup, or provider dashboards, assume live-provider verification is required unless explicitly scoped local-only.
- Do not expand vague approval into broad tool-chasing. Use the smallest valid proof path.

## Verification rules

- Code health: focused tests while implementing; complete repository gate near completion.
- Public UI: localhost can prove provider-independent page/component behavior.
- Hosted integration: Vercel Preview proves a coherent branch deploys and supports browser inspection.
- Before any merge into `main`, send Cameron the stable Preview review link `https://card-forge-git-vercel-preview-pyralis-projects.vercel.app`, identify the exact candidate SHA, summarize what needs review, and wait for explicit approval. A READY deployment is evidence, not merge permission.
- Auth/provider flows: verify affected behavior on `https://cardforges.com` with the real signed-in owner/developer account when required.
- Do not use raw HTTP to judge signed-in browser behavior; it lacks the real Clerk session.
- Do not recreate retired QA identities merely to satisfy broad tests.
- If a verification method is invalid for the target, stop and use the correct owner/provider path rather than trying unrelated tools.
- Keep reports concise: what was checked, what passed, what failed, and whether it matters.

## Lean repository execution

Use one coherent objective branch and one final PR unless an independent high-risk billing, security, legal, migration, permission, or provider boundary requires separation.

During implementation, use one focused RED/GREEN cycle per behavior and run the complete gate once near completion. Default Git inspection to orientation, pre-commit, and pre-PR. Do not repeat unchanged Git/provider queries or create extra process artifacts.

For remote GitHub-only work, batch related file changes into one Git tree/commit per coherent milestone. GitHub CI is the deterministic code-health loop; Vercel Preview is hosted integration proof, not a compile loop. Do not push incomplete/no-op/test-only commits merely to retrigger provider status.

Provider-backed work uses one preflight, one approved mutation, and one postflight verification. If the same check would run twice without a relevant state change, stop the loop.

Direct instructions from Cameron override this protocol.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
