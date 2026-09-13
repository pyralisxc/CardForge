---
name: cardforge-codebase-context
description: Use for broad CardForge code orientation, cross-file tracing, structural impact analysis, architecture discovery, callers/references, or implementation lookup when the private CardForge Codebase MCP is available. Treat it as derived acceleration only: verify freshness first, keep current source/GitHub authoritative, and fall back cleanly when the index is stale or unavailable.
---

# CardForge Codebase Context

## Purpose

Use CardForge's existing private Codebase Memory MCP to reduce repeated source-reading when a task needs broad structural context.

This skill is an **accelerator**, not an authority and not a dependency of CardForge development.

Canonical endpoint when the client supports remote MCP:

- transport name commonly configured in Codex: `cardforge_codebase`
- remote MCP: `https://mcp.cardforges.com/mcp`
- human owner viewer: `https://jarvis.cardforges.com/codebase/`

Each client must authenticate independently. A working GitHub connection does not prove the Codebase MCP is connected in that client.

## Authority boundary

Use this order when facts matter:

1. current task worktree / exact branch source;
2. GitHub current source and commit state;
3. CardForge canonical living docs for accepted product/architecture meaning;
4. Product Reality for generated current product topology;
5. Codebase MCP for derived structural/search context.

The Codebase MCP index is rebuildable derived evidence. It never overrides current source.

Do not infer that code is absent solely because a graph/search query returns nothing.

## When to use

Prefer this skill when the question is expensive to answer by opening files one by one, especially:

- where a symbol, concept, or feature is implemented;
- callers, references, dependency paths, or cross-file relationships;
- likely structural impact of changing an owner/public interface;
- architecture/module discovery;
- broad semantic/full-text source retrieval;
- tracing implementation paths after Product Reality identifies the relevant product owner/surface;
- orienting a fresh agent before focused source inspection.

Do not call the MCP merely because it exists. For a known file/owner or a narrow local edit, inspect the source directly.

## Freshness gate

Before relying on graph/index evidence, call `jarvis_source_status` when that tool is exposed by the deployed gateway.

Treat Codebase MCP evidence as **non-current** when freshness is:

- stale;
- blocked;
- failed;
- unknown;
- missing an indexed commit;
- commit-mismatched for the baseline you are reasoning about.

When non-current, use GitHub/current source directly and continue the task. Do not block development merely because the accelerator is unavailable.

If `jarvis_source_status` is absent, do not guess the indexed commit. Treat exact-current claims as unverified and use source for consequential conclusions.

## Branch semantics

The managed Codebase MCP checkout/index normally follows the managed CardForge `main` copy, not the active agent's feature worktree.

Therefore:

- use the MCP for baseline/main structural orientation when fresh;
- use the actual worktree/GitHub branch for feature-branch truth;
- use Git diff/PR diff for branch-specific changes;
- use Product Reality A→B diff when the project workflow provides it for product-topology changes;
- never describe the MCP graph as proving unindexed branch code.

For a branch task, a useful pattern is:

`fresh main Codebase MCP` + `current branch source/diff` + `Product Reality when relevant`.

## Relationship to Product Reality

These systems answer different questions.

Use **Product Reality** first for broad questions about what CardForge currently exposes and how product surfaces, actions, feature owners, routes/APIs, providers, MCP tools, workflows, and tests connect.

Use **Codebase MCP** for structural implementation discovery inside or across those owners: symbols, source relationships, code paths, architecture, semantic retrieval, and focused snippets.

Do not merge their authority models and do not reconstruct one from the other unnecessarily.

## Safe tool usage

When available and fresh, prefer harmless read-oriented discovery such as:

- `list_projects` / project discovery;
- `index_status`;
- `search_graph`;
- `trace_path`;
- `get_architecture`;
- focused `get_code_snippet` or equivalent read operations;
- other read-only graph/search tools exposed by the current Codebase Memory version.

Tool names can evolve. Use current tool discovery rather than assuming historical parity.

Do not use ordinary CardForge feature work to:

- delete the shared index;
- rebuild/reindex the shared cache;
- pull/reset/stash the managed checkout;
- mutate server configuration;
- change OAuth/access policy;
- widen network access;
- modify Oracle/Jarvis services.

Shared-index maintenance belongs to the separately managed Jarvis/Oracle operations workflow.

## Client connection rule

Consider a client connected only after all applicable checks succeed:

1. endpoint configuration;
2. OAuth authentication/consent;
3. MCP tool discovery;
4. one harmless real read;
5. identification of the CardForge project/index queried.

Do not assume authentication transfers between desktop Codex, ChatGPT, Codex Cloud, spawned agents, or other clients.

If the client cannot attach the remote MCP, continue with GitHub/current source. Never weaken gateway authentication to make a client connect.

## Efficient use

Use Codebase MCP to **narrow**, then inspect authoritative source.

Good pattern:

1. establish freshness;
2. ask the smallest structural question;
3. identify relevant owner/files/path;
4. read only the authoritative source slice required for the decision;
5. stop querying when additional graph calls add no new information.

Do not dump the full graph into model context when a focused query answers the question.

## Reporting

When Codebase MCP materially influenced a conclusion, report its freshness/commit limitation when relevant.

Examples:

- `Codebase MCP was fresh for main at <sha>; branch-specific conclusions came from the PR/worktree diff.`
- `Codebase MCP freshness could not be established, so I used GitHub source directly.`

Do not present derived graph evidence as a second source of product truth.

## Governing rule

> **Use the graph to find reality faster. Use current source to establish what is actually true.**
