# Premium CardForge Asset Kit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a premium fantasy asset kit and use it to upgrade three current default templates plus the existing Obsidian Neon card back.

**Architecture:** Keep the premium art reusable through the existing asset discovery system: browser-served art under `public/card-assets`, optional metadata under `data/assets`, style presets under `data/styles`, and template usage inside existing default template JSON. Avoid a new rendering engine; strengthen the current one with better materials, borders, dividers, and template composition.

**Tech Stack:** Next.js App Router, static SVG/JSON assets, existing CardForge template model, Vitest, Playwright smoke tests.

---

### Task 1: Add Asset Discovery Tests

**Files:**
- Modify: `tests/unit/api-validation.test.ts`
- Modify: `tests/unit/appearance.test.ts`
- Modify: `tests/unit/template-model.test.ts`

- [ ] Add tests that prove new premium metadata values stay valid and that upgraded templates can reconstruct without legacy fields.
- [ ] Run: `npm run test -- tests/unit/api-validation.test.ts tests/unit/appearance.test.ts tests/unit/template-model.test.ts`
- [ ] Expected before implementation: fail if metadata or template references are missing/invalid.

### Task 2: Add Premium Static Assets

**Files:**
- Create: `public/card-assets/textures/arcane-forge/*`
- Create: `public/card-assets/dividers/arcane-forge/*`
- Create: `data/assets/textures/arcane-forge/*.json`
- Create: `data/assets/dividers/arcane-forge/*.json`

- [ ] Add reusable SVG textures: forged parchment, obsidian vellum, rune-metal, ember leather, astral paper, and guild slate.
- [ ] Add reusable SVG dividers and ornaments: title plate, rule separator, corner flourish, mana gem rule, stat rail, and neon sigil divider.
- [ ] Add metadata sidecars with display names, target hints, opacity, scale, blend mode, and tile behavior.

### Task 3: Add Premium Style Presets

**Files:**
- Create: `data/styles/material-arcane-forge-parchment.json`
- Create: `data/styles/material-obsidian-neon-premium.json`

- [ ] Add style presets that expose the new visual language inside Appearance Studio.
- [ ] Keep names user-facing and not implementation-coded.

### Task 4: Upgrade Existing Default Templates

**Files:**
- Modify: `data/default-templates/default-mtg-theme.json`
- Modify: `data/default-templates/default-ttrpg-stat-sheet.json`
- Modify: `data/default-templates/default-playing-card-theme.json`
- Modify: `data/default-templates/default-obsidian-neon-card-back.json`

- [ ] Upgrade the three existing defaults with premium asset-backed backgrounds, title plates, borders, dividers, and stronger example styling.
- [ ] Keep all variable contracts intact so existing generator and bulk tests continue to pass.
- [ ] Keep exactly one card back template and make it visually strong enough to support landing-page promises.

### Task 5: Update Durable Docs

**Files:**
- Modify: `README.md`
- Modify: `docs/blueprint.md`
- Modify: `docs/release-checklist.md`

- [ ] Update asset inventory counts and describe the premium kit as a launch art layer.
- [ ] Keep release notes honest about the upgraded bundle snapshot after verification.

### Task 6: Verify

**Commands:**
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run smoke`

- [ ] Run all commands fresh.
- [ ] Open the app in a browser and visually inspect the upgraded default templates and asset library.
- [ ] Remove temporary QA artifacts before handoff.
