---
name: product-reality-audit
description: Use when auditing where CardForge capabilities, surfaces, actions, feature owners, APIs, providers, MCP tools, workflows, or verification evidence currently connect, or when checking parity/topology drift during development, Preview promotion, or merge to main.
---

# Product Reality Audit

## Purpose

Use CardForge's generated Product Reality Graph before manually reconstructing current product shape from scattered source files.

Product Reality is **descriptive evidence**, not Product Direction. It reports relationships and capabilities the repository can observe; it does not decide whether a placement is desirable, whether UX quality is good, or what CardForge should become.

Its primary job is future parity: make it difficult for a redesign to silently lose an existing capability merely because files, surfaces, or composition changed.

## Reality model

### A — accepted reality

`main` owns the last accepted checkpoint:

- `docs/generated/product-reality.ndjson` — complete record-oriented machine graph;
- `docs/product-surface-map.md` — compact generated human projection.

A is rebuildable evidence of the CardForge version already accepted into `main`.

### W — working reality

During development, inspect the current branch without changing durable generated truth:

```bash
npm run product-reality:audit -- --base origin/main
```

W is disposable. The audit writes a heat map and working NDJSON packet under the operating system temporary directory. Never commit W merely to keep normal development green.

### B — sealed candidate reality

Only at a coherent Preview/main promotion boundary:

```bash
npm run product-reality:seal
npm run product-reality:check
```

Commit the generated NDJSON and Surface Map for the exact candidate. After an approved merge, B becomes the new A.

### E — expected change

For objectives where topology or parity matters, Founder-to-Feature may produce an **ephemeral expected delta** describing what the current objective expects to preserve, add, retire, or intentionally leave unconstrained.

E is not a future Surface Map and is never a permanent documentation authority. It may change if product understanding changes during Resolve/Crystallize and it disappears when the objective is accepted or abandoned.

Use E to challenge W/B, not to freeze implementation geography:

- A → W: what actually changed while building?
- E ↔ W: does current work still express the accepted objective?
- A → B: what reality are we asking CardForge to accept?
- E ↔ B: did the exact candidate fulfill the objective without unexplained parity loss?

Unexpected does not automatically mean wrong. Investigate it.

## What counts as product reality

Do not reduce Product Reality to module dependencies or ActionDescriptors.

Parity-significant current behavior can include:

- surfaces and focused workbench modes;
- semantic actions and contextual tools;
- user-visible interaction capabilities such as spatial movement, selection, camera behavior, density/readability, organization, and responsive/touch paths;
- feature owners and durable object relationships;
- routes/APIs;
- providers;
- MCP/agent paths and human parity links;
- workflows and test evidence as supporting evidence;
- explicit unresolved observations.

Small `productRealityKind` metadata may live beside the implementation owner when static structure cannot express a durable current capability. Such metadata describes **what exists now**, never desired placement. Keep it source-adjacent and mechanically tied to the implementation it describes.

A new surface or capability should become observable because product/source semantics changed, not because someone remembered to add its name to a scanner geography list.

## Product signal versus supporting evidence

The primary topology fingerprint and heat map represent product-semantic reality. Tests, workflow nodes, scripts, file locations, and provenance remain valuable evidence, but their churn is a secondary signal.

A test addition or file move must not look equivalent to losing a capability, changing its native owner, splitting a semantic action, removing an MCP parity path, or changing a surface relationship.

When scanner/schema behavior itself changes, say so explicitly; do not present a better observation model as if CardForge suddenly gained or lost every newly observable capability.

## Query before reading broadly

Prefer the smallest useful slice:

```bash
npm run product-reality:query -- --surface studio
npm run product-reality:query -- --feature project
npm run product-reality:query -- --kind capability
npm run product-reality:query -- --kind mcp
npm run product-reality:query -- --node provider:stripe
npm run product-reality:query -- --match generate
npm run product-reality:query -- --unknown
```

Queries use a bounded neighborhood by default.

## Source of truth

- Source code remains authoritative implementation evidence.
- Live providers remain authoritative for provider state the repository cannot prove.
- Accepted Product Reality checkpoints are rebuildable projections, not runtime owners.
- `docs/product-direction.md` owns desired/future product meaning.
- `docs/architecture.md` owns architectural ownership and invariants.
- Git owns accepted change history.

Never hand-edit generated Product Reality outputs. Change native source/semantic metadata or the scanner, then seal again when preparing B.

## Parity questions

Use Product Reality to ask:

- Where is this capability exposed now?
- Which native feature owns it?
- Which user-visible capability disappeared or split in this change?
- Which APIs/providers connect to that owner?
- Does a published MCP relationship exist for the same semantic action?
- Which workflows/tests support the observation?
- Did an apparent duplicate actually preserve a distinct provider/backend/compatibility job?

Treat apparent duplicates as candidates until native ownership and boundary meaning prove redundancy. Backend-only routes, webhooks, callbacks, scheduled workflows, compatibility ingress, and agent-only tools are not dead merely because they lack visible UI.

## Scanner honesty

Prefer an explicit unknown over invented intent.

Import evidence is dependency/use evidence, not proof of runtime invocation. Test references are evidence, not complete behavioral coverage. Static repository analysis does not prove live provider configuration, production availability, or physical UX quality.

If an important relationship remains unknown, inspect the native source for the current task. Improve stable semantic observability only when the uncertainty is recurrent and worth carrying.
