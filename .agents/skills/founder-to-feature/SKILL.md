---
name: founder-to-feature
description: Use before implementation when Cameron proposes, changes, audits, or approves a substantial CardForge feature, user journey, product behavior, cross-owner interaction, persistence rule, provider-backed workflow, or other objective whose intended outcome is clearer than its full behavioral contract.
---

# Founder to Feature

## Purpose

Translate founder-level product intent into an implementation-ready behavioral contract before code begins.

Cameron normally communicates through desired experience, analogy, frustration with current behavior, visual/use feedback, and short approvals. That is valid product input. Do not require him to specify state machines, persistence ownership, failure semantics, concurrency behavior, provider edge cases, or implementation structure when those can be derived from CardForge's current authorities.

This skill is CardForge's **repo-local specialization** of the reusable Founder-to-Feature method. Cameron may also have a global/account-level version installed, but CardForge must not depend on it. When global and repo-local guidance differ, follow `AGENTS.md`, this repo skill, current CardForge code/provider state, and the canonical CardForge docs.

This skill is a **pre-execution resolution gate**, not a second execution workflow. Once the feature is ready to build, hand the accepted contract to `.agents/skills/lean-repository-execution/SKILL.md`, which remains CardForge's sole execution workflow.

Do not create a permanent feature-spec layer. Work inline by default. Durable truth belongs only in CardForge's existing canonical docs after the behavior is verified.

## When to use it

Use this skill before implementation when an objective introduces or materially changes any of the following:

- a user journey or interaction model;
- object identity, ownership, persistence, location, copy/move/import/open semantics, or recovery;
- authentication, account transitions, permissions, entitlements, or provider-backed behavior;
- behavior spanning multiple feature owners or surfaces;
- a new product concept or a changed product rule;
- a request framed mainly as desired experience rather than a complete behavioral contract;
- a feature whose implementation could reasonably diverge between two competent agents because product semantics are still implicit.

Routine copy, styling, docs, narrow visual polish, contained bug fixes with an already-established contract, and implementation of an already-resolved behavioral contract may go directly to the lean execution skill.

## Founder-intent rule

Treat Cameron's product language as the source of desired outcome, not as an incomplete engineering ticket.

Examples of valid founder input include:

- “Drive should feel like another location.”
- “Signing in should just keep what I was doing.”
- “Campaigns should feel more like sets than folders.”
- “This asks me to resume too often.”

The agent owns the work of deriving the technical and behavioral consequences that follow from established CardForge truth.

Do not ask Cameron to decide an engineering consequence that is already implied by current product or architecture rules. Escalate only a **founder decision**: a choice that would materially change product philosophy, user expectation, ownership, identity, permission, destructive behavior, or another durable rule and cannot be resolved from current authority.

A useful distinction:

- **Founder decision:** “Should guest work merge into an account that already has work, or remain separate?”
- **Engineering consequence:** “A failed Move must leave the source recoverable.”

Resolve engineering consequences without pushing them back onto Cameron.

## Modes

### Explore

Use Explore when Cameron is brainstorming, comparing approaches, reacting to UX, asking for an audit, or asking “what if”.

In Explore:

- reason about the experience and consequences;
- identify conflicts with current Product Direction or Architecture;
- surface consequential choices and useful alternatives;
- use prototypes, Product Design tooling, reference research, or flow audits when helpful;
- **do not implement merely because an idea is promising.**

An audit, review, critique, or exploratory conversation is not implementation approval.

### Resolve

Use Resolve when the intended direction is accepted or implementation is requested but meaningful product semantics are still implicit.

Produce a compact behavioral contract in working context. Do not create a spec file unless Cameron explicitly asks for one.

The contract must establish:

1. **Outcome** — what the creator should experience, stated without implementation detail.
2. **Authority** — which current product/architecture/integration rules constrain the feature.
3. **Owners and identities** — canonical owner of each durable datum, object identity, account/provider identity, and any projections or caches.
4. **Invariants** — truths that must remain true across every relevant transition.
5. **State transitions** — how relevant states enter, change, recover, retry, cancel, reload, and exit.
6. **Failure and destructive semantics** — what may change, what must remain recoverable, and what partial success means.
7. **Black-box acceptance** — externally observable behavior independent of implementation structure.
8. **Unresolved founder decisions** — only choices that genuinely require product direction.

### Build

Enter Build only after the Definition of Ready below is satisfied.

Load and follow `.agents/skills/lean-repository-execution/SKILL.md`. Pass the resolved behavioral contract into implementation as the objective boundary.

Implementation agents may choose local engineering details inside the contract, but they may not silently invent new product semantics. If coding exposes a missing semantic decision, return to Resolve for that question before continuing the affected behavior.

## Resolution protocol

### 1. Orient to current truth once

Follow `AGENTS.md` and `docs/agent-map.md`. Read only the affected slices of the canonical authorities:

- `docs/product-direction.md` — intended product model and delivery sequence;
- `docs/architecture.md` — shipped ownership and invariants;
- generated `docs/product-surface-map.md` — compact observed current Product Reality; query the graph rather than hand-editing this projection when current placement/reachability matters;
- `docs/integrations.md` — provider seams;
- `docs/operations.md` — release/operational truth;
- `docs/risk-register.md` — unresolved known risk.

Use current code and live provider state where they are authoritative. Git history is evidence, not current specification.

Do not reconstruct a feature contract from old PR prose or historical audit reports when current truth answers the question.

### 2. Prove ownership before adding state

For every new or changed datum, identify its canonical owner before implementation.

State explicitly whether each additional representation is:

- the authority;
- a projection;
- an ephemeral working value;
- a provider-owned value;
- a cache that can be rebuilt.

Do not add a second persistent owner merely because it makes one implementation path easier.

Before proposing a new store, registry, queue, sync layer, route protocol, abstraction, entitlement, location concept, or user choice, prove that the existing owner cannot express the required behavior.

### 3. Extract invariants

Convert desired experience into rules that survive implementation choices.

Prefer statements such as:

- work identity does not change merely because storage location changes;
- a provider outage is not equivalent to an empty collection;
- Copy creates independent identity while Open does not;
- destructive source removal happens only after verified destination persistence;
- authored work remains unchanged or recoverable after a boundary failure.

Do not encode implementation structure as an invariant unless that structure is itself an established architectural rule.

### 4. Model relevant transitions

Consider the states that can change the user's expectation, including where relevant:

- first use and existing use;
- guest → new account;
- guest → existing account;
- sign out → same account;
- account A → account B;
- first provider connection;
- same-account reconnect;
- different-account reconnect;
- provider unavailable, offline, rate-limited, or timed out;
- permission revoked or resource missing;
- clean work vs dirty local edits;
- reload, restart, navigation away, cancel, and retry;
- stale revision or concurrent edit;
- multi-tab or multi-client interaction;
- partial success where a remote mutation succeeds but the response fails;
- desktop, narrow desktop, mobile, keyboard, pointer, and touch when the interaction model is affected.

Do not manufacture impossible branches. Apply only states supported by a real persistence, I/O, provider, permission, trust, concurrency, validation, navigation, or enforced-limit boundary.

### 5. Attack the contract before code

Try to break the proposed behavior from the outside.

For Product or High-risk work, generate at least ten materially different counterexamples across the relevant state transitions. For smaller feature work, cover every meaningful boundary even if fewer examples are necessary.

Counterexamples should test assumptions such as:

- “What if the remote write succeeded but CardForge timed out?”
- “What if this account already contains durable work?”
- “What if permission disappears after the object was opened?”
- “What if another tab saves before this one?”
- “What if the user retries the same action?”

A counterexample is useful only if it could change the contract, acceptance criteria, or implementation safety. Do not generate edge-case theater.

### 6. Define black-box acceptance

Acceptance criteria must describe observable creator behavior rather than internal function names, source strings, import locations, or implementation snapshots.

Include normal use, recovery, and the highest-risk relevant transitions.

A person or independent agent should be able to evaluate the criteria without knowing how the feature was implemented.

### 7. Freeze semantics before parallel implementation

Do not parallelize implementation while two agents could still make different valid decisions about identity, ownership, persistence, permissions, destructive behavior, failure meaning, or user-visible transition rules.

Parallel work is appropriate after semantic freeze when tasks have independent owners and share the same accepted contract.

Parallel investigation is acceptable before freeze when agents are collecting independent evidence rather than implementing competing interpretations.

## Definition of Ready

A substantial feature is Ready only when:

- the creator outcome is clear;
- applicable current authorities are known;
- canonical owners and identities are identified;
- no unproven second persistent owner is being introduced;
- durable invariants are explicit;
- relevant state transitions are resolved;
- failure, retry, partial-success, and destructive semantics are known;
- black-box acceptance criteria exist;
- adversarial review has not exposed an unresolved engineering consequence;
- any remaining ambiguity is explicitly a founder decision or a bounded implementation detail;
- two implementation agents following the contract would not reasonably create conflicting product behavior.

If these are not true, stay in Resolve. Do not use implementation as the mechanism for discovering basic product semantics.

## Optional specialist tools

Specialist tools may strengthen a phase but never become CardForge's source of truth.

- **Product Design** can help during Explore or adversarial UX review.
- **Linear** can receive the resolved contract and split it into implementation work after semantic freeze.
- **GitHub** remains the code/history surface and implementation review boundary.
- CardForge's canonical living docs remain the durable product and architecture authorities.

Do not require an optional external tool for the workflow to function. A fresh agent working only from the repository must still be able to complete the process.

## Living Truth Reconciliation

After accepted behavior is implemented and verified, reconcile what was learned before declaring the objective complete.

Ask: **What is now durably true about CardForge that a new agent must know without reading this PR?**

Promote only verified durable truth into its existing canonical owner:

- `docs/product-direction.md` for durable product meaning, desired placement, or intended model;
- `docs/architecture.md` for shipped ownership, identity, persistence, and architectural invariants;
- `docs/integrations.md` for intentional provider seams and supported provider journeys;
- `docs/operations.md` for durable operational/release procedure;
- `docs/risk-register.md` for unresolved material risk;
- `AGENTS.md` only for repository-wide agent behavior that truly applies across objectives.

`docs/product-surface-map.md` is generated observed reality, not an authored destination for product doctrine. Do not promote desired placement or future intent into it by hand; change code/semantic metadata or the Product Reality scanner and regenerate when observed topology changes.

Use **promote, consolidate, replace**:

1. update the existing canonical section where the truth belongs;
2. merge overlapping rules instead of appending another version;
3. remove or revise superseded language so current docs do not contradict themselves;
4. do not preserve temporary alternatives, implementation diaries, audit reports, rejected approaches, or feature-specific reasoning as permanent doctrine;
5. do not create a new permanent document when an existing authority can own the information.

Git history preserves archaeology. Living documentation must describe current truth.

A completed feature should pass this comprehension test:

> Could a fresh agent understand why CardForge now behaves this way from `AGENTS.md`, the routed code, and the canonical living docs without reading the feature's development history?

If not, reconcile the missing durable truth before completion.

If no durable rule changed, make no documentation change merely to prove the reconciliation step happened.

## Completion handoff

The lean execution workflow owns implementation, verification, Preview review, PR discipline, and merge boundaries.

When reporting completion, distinguish:

- the accepted outcome;
- the canonical owners affected;
- the important invariants proven;
- verification evidence;
- durable living-truth changes, if any;
- unresolved product decisions or risks.

Do not call a feature complete merely because code and tests are green. Completion means the accepted creator behavior is proven and CardForge's living truth still describes the system accurately.
