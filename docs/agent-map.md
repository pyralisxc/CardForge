# Agent map

Use this page after `AGENTS.md` to find the smallest trustworthy slice of CardForge. It routes work; it does not redefine product behavior. Read the listed source owner and linked document sections, then let the code and tests answer local details.

Run `npm run verify:focused` to derive the route from the current Git diff. For a proposed path before editing, run `npm run verify:focused -- <path>`; omit `--run` by calling `node scripts/report-affected-verification.mjs <path>` when only a report is wanted. Finish every coherent PR candidate with `npm run verify:full` once.

## Studio surfaces and navigation

- Owners: `src/features/app-shell`, `creator-workbench`, `desk`, `experience-settings`.
- Interfaces: each owner's `client.ts` or `server.ts`; routes compose them from `src/app`.
- Read: `docs/architecture.md#core-ownership`, `docs/product-direction.md#workbench-doctrine`, and `#spatial-model` when interaction geometry changes.
- Tests: direct owner consumers plus focused `desk`, `environment`, `focused-artifact`, `studio-navigation`, and `surface-return` tests; compact interaction also uses `tests/product/workflows/mobile-dropdowns.spec.ts` when the browser journey changes.
- Risk: Product. Preview browser evidence is expected for visible interaction changes.

## Template authoring and rendering

- Owners: `src/features/template-editor`, `card-generator`, `card-rendering`, `render-artifacts`.
- Interfaces: owner `client.ts`/`server.ts`; pure Card/Template policy remains in `src/domain`.
- Read: `docs/architecture.md#card-and-template-model` and `#canonical-rendering-doctrine`.
- Tests: directly importing `template`, `canvas`, `element`, `layer`, `field`, `rendering`, or generation tests.
- Risk: Product. Inspect real rendered output when pixels, export, fonts, or rich text change.

## Projects, storage, and Library

- Owners: `src/features/project`, `storage-management`, `personal-library`, `library-picker`.
- Interfaces: focused project `client/*` entry points; do not restore an aggregate barrel.
- Read: `docs/architecture.md#storage-lanes` and `docs/integrations.md#browser-workspace--zustand-and-indexeddb`.
- Tests: direct project/storage imports plus package, persistence, work-location, Library, and provider-boundary tests.
- Risk: Product; High risk for destructive persistence or provider permission changes. Google Drive paths require one real provider proof.

## MCP and agent authoring

- Owners: `src/features/studio-documents`, `mcp-usage`; `/mcp` is thin route composition.
- Interfaces: feature `server.ts` and the published MCP tool schemas.
- Read: `docs/architecture.md#mcp--agent-authoring` and `docs/integrations.md#mcp--agent-access-to-cardforge-studio`.
- Tests: direct owner imports plus `mcp-*`, `cardforge-plugin`, and `studio-agent-*` contract tests.
- Risk: Product; High risk when authorization or durable provider writes change. Verify published schemas and exact Studio revision handoff together.

## Identity, billing, and access

- Owners: `src/features/account`, `billing`, `contributor-access`.
- Interfaces: feature `client.ts`/`server.ts`; Clerk owns identity and Stripe owns billing lifecycle.
- Read: `docs/architecture.md#access-model` and the matching Clerk or Stripe section in `docs/integrations.md`.
- Tests: direct owner imports plus account, auth, entitlement, billing, and contributor-access tests.
- Risk: High. Use the provider-native path, preserve exact boundary failures, and require a signed-in/provider check when behavior changes.

## Pipeline and publication

- Owners: `src/features/pipeline`, `contributor-program`; shared catalog persistence stays with Pipeline.
- Interfaces: feature `client.ts`/`server.ts` and immutable revision contracts.
- Read: `docs/architecture.md#contributor-pipeline` and `docs/product-direction.md#pipeline-revisions-voting-and-publication`.
- Tests: direct owner imports plus pipeline, registry, publication, vote, and asset tests.
- Risk: High for permissions, publication, retirement, or destructive lineage. Supabase proof is required when shared state changes.

## Marketing and delivery

- Owners: `src/features/marketing`, `marketing-content`, `marketing-distribution`, `social-publishing`, `analytics`.
- Interfaces: each provider-facing feature owns its narrow server boundary.
- Read: `docs/architecture.md#campaign-and-publication-model` and the matching provider section in `docs/integrations.md`.
- Tests: direct owner imports plus marketing, analytics, email, native-Meta, and social-share tests.
- Risk: Product for local content; High for delivery, credentials, consent, or provider writes. Verify Resend, Meta, or analytics only when that seam changes.

## Public, owner, legal, and roadmap

- Owners: `src/features/public-site`, `brand-presentation`, `business-identity`, `contact`, `legal`, `roadmap`, `owner`.
- Interfaces: feature public entries; Owner composes controls but does not absorb their policies.
- Read: `docs/architecture.md#core-ownership`; use `docs/operations.md` for release/provider checks and `docs/risk-register.md` only when unresolved risk is relevant.
- Tests: direct owner imports plus public, site, legal, identity, contact, roadmap, and owner tests.
- Risk: Routine for copy/presentation, Product for behavior, High for legal identity, permissions, email, or destructive operations.

## Platform and repository tooling

- Owners: `src/infrastructure` for adapters, `src/shared` for framework-independent utilities, `src/components/ui` for generic primitives, `scripts` for repository checks, and `tests/infrastructure` for their guardrails.
- Read: `docs/architecture.md#dependency-rules`, `docs/testing.md`, and the affected provider section only for an external adapter.
- Tests: direct imports or the matching infrastructure fixture. `npm run architecture:report` is deliberately opt-in; `architecture:check` is the quiet enforcement path.
- Risk: Product by default; High when security, migration, secrets, auth, permissions, or provider behavior changes.

## Command ownership

- During implementation: `npm run verify:focused` or `npm run verify:focused -- <paths>`.
- Architecture enforcement: `npm run architecture:check`; changed-file signal: `npm run architecture:changed`; deep analysis: `npm run architecture:report`.
- Final candidate and CI: `npm run verify:full` only.
- Test inventory: `npm run test:inventory` only when coverage growth or cleanup is the question.
