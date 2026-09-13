---
name: product-reality-audit
description: Use when auditing where CardForge capabilities, surfaces, actions, feature owners, APIs, providers, MCP tools, workflows, or verification evidence currently connect, or when checking topology drift across a proposed change.
---

# Product Reality Audit

## Purpose

Use CardForge's generated Product Reality Graph before manually reconstructing product topology from scattered source files.

The graph is **descriptive evidence**, not Product Direction. It reports relationships the repository can observe; it does not decide whether a placement is desirable, whether UI quality is good, or whether an implementation should exist.

## Source of truth

- Source code remains authoritative.
- `docs/generated/product-reality.json` is a rebuildable machine projection.
- `docs/product-surface-map.md` is the compact generated human projection.
- `docs/product-direction.md` owns desired/future product behavior.
- `docs/architecture.md` owns architectural rules and invariants.
- Git owns change history.

Never edit generated Product Reality outputs by hand. Change the source/semantic metadata or the scanner, then regenerate.

## Query before reading broadly

Prefer the smallest useful slice:

```bash
npm run product-reality:query -- --surface studio
npm run product-reality:query -- --feature project
npm run product-reality:query -- --kind mcp
npm run product-reality:query -- --unknown
```

Use the full machine graph only for whole-system audits or scanner work.

## Change audit

For a feature branch, compare current observed topology with the accepted base:

```bash
npm run product-reality:diff -- --base origin/main
```

Interpret the delta literally:

- added means newly observed;
- removed means previously observed and no longer observed;
- changed means semantic metadata changed;
- unknown means static evidence is insufficient.

None of those states is automatically a product defect. Investigate the evidence before proposing a fix.

## Parity and hygiene questions

Use the graph to answer questions such as:

- Where is this capability exposed?
- Which feature owns the action?
- Which APIs/providers are connected to that owner?
- Does a published MCP relationship exist for the same semantic action?
- What tests are statically linked to the feature?
- Did a UI/backend/MCP relationship disappear or split in this PR?

Treat apparent duplicates as **candidates** until the native owner and boundary semantics prove they are redundant. Backend-only routes, webhooks, provider callbacks, scheduled workflows, compatibility ingress, and agent-only tools are not dead merely because they lack a visible UI action.

## Scanner honesty

Do not fill gaps by manually editing generated output. When an important relationship is `unknown`, either:

1. inspect the source directly for the current task; or
2. if the ambiguity is recurrent and worth making machine-readable, improve stable semantic metadata or the scanner in a bounded repository-tooling change.

The scanner must prefer an explicit unknown over invented intent.

## Freshness

Run `npm run product-reality:generate` after topology-affecting changes. CI runs `product-reality:check` on the final candidate so generated truth cannot silently drift from code.
