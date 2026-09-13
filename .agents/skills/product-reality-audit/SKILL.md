---
name: product-reality-audit
description: Use when auditing where CardForge capabilities, surfaces, actions, feature owners, APIs, providers, MCP tools, workflows, or verification evidence currently connect, or when checking topology drift during development, Preview promotion, or merge to main.
---

# Product Reality Audit

## Purpose

Use CardForge's generated Product Reality Graph before manually reconstructing product topology from scattered source files.

Product Reality is **descriptive evidence**, not Product Direction. It reports relationships the repository can observe; it does not decide whether a placement is desirable, whether UI quality is good, or whether an implementation should exist.

## Three reality states

Product Reality deliberately separates accepted truth from temporary development evidence.

### A — accepted checkpoint

`main` owns the last accepted Product Reality checkpoint:

- `docs/generated/product-reality.ndjson` is the complete record-oriented machine graph;
- `docs/product-surface-map.md` is the compact generated human projection.

A is durable because it represents the version of CardForge already accepted into `main`.

### W — working audit

During development, inspect the current branch/worktree without changing the repository:

```bash
npm run product-reality:audit -- --base origin/main
```

This creates a heat-map report plus a working NDJSON packet under the operating system's temporary directory. Those files are disposable audit evidence. **Never commit W.** Re-run it whenever an implementation/audit question benefits from a fresh view.

PR CI also renders the live A → W delta into its summary so topology drift remains visible while the feature is still changing.

### B — sealed candidate checkpoint

Only when a coherent candidate is being prepared for Preview/main, seal the candidate:

```bash
npm run product-reality:seal
npm run product-reality:check
```

Commit the generated NDJSON and Surface Map only at this checkpoint boundary. Once that candidate merges, B becomes the new accepted A.

This keeps experimental development topology out of durable Git truth while preserving an exact accepted history from merge to merge.

## A → B checkpoint diff

The durable diff answers:

> What accepted product topology are we replacing, and what topology are we asking CardForge to support next?

The heat map uses literal observation states:

- 🟢 unchanged observed topology;
- 🔵 newly observed nodes/relationships;
- 🟡 changed semantic metadata;
- 🔴 previously observed nodes/relationships that disappeared;
- ⚪ newly unresolved observations;
- ✅ unresolved observations that became provable or disappeared.

A color is not a quality judgment. Added is not automatically good, removed is not automatically bad, and unknown is not automatically a defect.

The checkpoint diff runs twice around release:

1. **Preview checkpoint:** when the exact sealed candidate is moved to `vercel-preview`, the Product Reality Checkpoint workflow verifies the sealed graph and compares accepted `main` A → Preview B.
2. **Main checkpoint:** after an approved merge, the same workflow compares previous `main` A → new `main` B. The committed B then becomes the next accepted baseline.

The normal PR CI diff is different: it is a live development audit and does not create a durable checkpoint.

## Query before reading broadly

Prefer the smallest useful slice:

```bash
npm run product-reality:query -- --surface studio
npm run product-reality:query -- --feature project
npm run product-reality:query -- --kind mcp
npm run product-reality:query -- --node provider:stripe
npm run product-reality:query -- --node mcp:upsert_cards
npm run product-reality:query -- --match generate
npm run product-reality:query -- --unknown
```

Queries use a bounded neighborhood by default so an agent can reach the immediate owner/supporting relationships without loading the whole graph.

## Source of truth

- Source code remains authoritative implementation evidence.
- Accepted `main` checkpoints are rebuildable projections, not a second runtime owner.
- `docs/product-direction.md` owns desired/future product behavior.
- `docs/architecture.md` owns architectural rules and invariants.
- Git owns accepted change history.

Never hand-edit generated Product Reality outputs. Change source/semantic metadata or the scanner, then seal again when preparing a checkpoint.

## Parity and hygiene questions

Use the graph to answer questions such as:

- Where is this capability exposed?
- Which feature owns the action?
- Which APIs/providers are connected to that owner?
- Does a published MCP relationship exist for the same semantic action?
- Which workflows/scripts exercise the repository boundary?
- What tests are statically linked to the feature?
- Did a UI/backend/MCP relationship disappear or split during this change?

Treat apparent duplicates as **candidates** until native ownership and boundary semantics prove they are redundant. Backend-only routes, webhooks, provider callbacks, scheduled workflows, compatibility ingress, and agent-only tools are not dead merely because they lack a visible UI action.

## Scanner honesty

Do not fill gaps by hand-editing generated output. When an important relationship is `unknown`, either inspect the source directly for the current task or improve stable semantic metadata/scanning in a bounded tooling change.

Evidence labels must not claim more than they prove. Import evidence is dependency/use evidence, not automatically a runtime function call. Test references are evidence, not proof of complete behavioral coverage.

The scanner must prefer an explicit unknown over invented intent.
