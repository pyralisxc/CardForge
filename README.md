# CardForge

CardForge is a live local-first card production studio for creating reusable front/back layouts, generating complete card sets, and exporting PNG, ZIP, PDF, or Tabletop Simulator output. The browser workspace is the normal working copy; durable user-owned copies can live in downloaded project files, authorized local folders, or connected Google Drive, while shared product state and reviewed Library content live in Supabase.

CardForge Studio is created and operated by Cameron Locke, an independent sole proprietor based in Oregon.

## Live product

- Public site: `/`, `/about`, `/cameron`, `/roadmap`, `/contributors`, `/contact`, and legal pages.
- Desk: `/account`; Set focus replaces the surrounding Desk, and Artifact focus replaces the Set field with one zoomed-in Artifact. Design, Generate, Output, Pipeline, and location controls open as contextual tools over Desk or Library. `/studio` is a compatibility translator into contextual Desk Design, including exact temporary Studio-document handoffs.
- Account, Creator Pass, Designer Pass, and Profile: `/account`.
- Contributor work is capability-gated inside Desk, Library, and Profile; site-proposal scope is retired.
- Owner operations compose inside Profile; `/owner` is protected compatibility ingress for older callbacks and deep links.
- Agent/MCP entry: `/mcp` with OAuth discovery under `/.well-known/`.

Production runs at [cardforges.com](https://cardforges.com).

## Repository authority

A fresh maintainer or agent should be able to work from the repository without prior chat history. Treat `main` plus live provider state as authoritative. Start with:

1. `AGENTS.md` for working rules.
2. `docs/architecture.md` for current product ownership and invariants.
3. `docs/product-direction.md` for the intended product model and next delivery sequence; it does not override shipped behavior.
4. `docs/integrations.md` for provider-native ownership and human trace paths.
5. `docs/operations.md` for the current release/provider runbook.
6. `docs/risk-register.md` for unresolved or explicitly accepted risk only.

PRs, commits, old migrations, and provider history are historical evidence, not current product instructions. `docs/product-direction.md` owns the durable intended model and sequence; the live `/roadmap` and its Supabase records own publicly presented future/completed status and votes. Shipped work must be marked `shipped` rather than left looking planned.

## Quick start

Requirements: Node.js 22+ and npm.

```bash
npm install
npm run dev
```

Local development runs at `http://localhost:9002`.

Core verification:

```bash
npm run lint
npm run typecheck
npm run architecture:check
npm run migrations:check
npm run test
npm run build
```

Maintained operational commands:

```bash
npm run health:production
npm run smoke:ui
npm run smoke:scale
npm run pipeline:sync-defaults
npm run brand:export
```

`smoke:ui` includes generated 100/500/1,000-Artifact browser fixtures, culling and interaction-latency evidence, a repeated Desk/Design cleanup soak, and lazy contextual-bundle observation. `smoke:scale` runs only that generated scale lane. Chromium heap/long-task readings are practical guardrails rather than cross-browser memory certification; browser-loaded chunk markers plus the source-owned `next/dynamic` boundaries prove that Design, Output, Pipeline, and Owner implementations are absent from the initial Desk script set.

## Source map

- `src/app/`: Next.js routes and HTTP composition.
- `src/domain/`: pure Artifact, Card, Template, Rendering, and Entitlements policy.
- `src/features/app-shell/`: reusable contextual-tool composition, interaction/action runtime, compatibility Studio ingress, and workspace bootstrap.
- `src/features/home/`: the spatial Desk owner over Sets and their generalized Artifact projection; cards remain the first shipped specialized Artifact type.
- `src/features/template-editor/`: Template Studio editing, layers, inspector, and template-library commands.
- `src/features/card-generator/`: single/bulk card creation, generated-card editing, validation, and output tools consumed by Studio and Desk.
- `src/features/card-rendering/`: shared card rendering, authored-object previews, and rich-text/vector presentation.
- `src/features/project/`: local workspace state, IndexedDB persistence, recovery, assets, canonical one-Set packages, published-package installation, and provider/local-folder adapters.
- `src/features/storage-management/`: the Library collection surface over personal work, the published catalog, protected Forge Review projections, and source-owned location/default/transfer tools; it does not own those underlying stores.
- `src/features/account/` and `src/features/billing/`: Clerk-backed account access and Stripe-backed product/support billing.
- `src/features/contributor-access/` and `src/features/pipeline/`: Contributor identity/scopes plus Forge Review, voting, publication, attribution, and the shared Library.
- `src/features/studio-documents/`: private account Studio documents and MCP authoring bridge.
- `src/features/marketing/`, `marketing-content/`, `marketing-distribution/`, `social-publishing/`: strategy, content, distribution state, and stateless provider publishing.
- `src/features/public-site/`, `business-identity/`, `legal/`, `contact/`, `roadmap/`, `analytics/`, `experience-settings/`: public/control-plane product owners.
- `src/features/owner/`: owner authorization and lazy composition of feature-owned operational controls.
- `src/infrastructure/`: Clerk, Supabase, HTTP, public URL, and abuse-protection infrastructure.
- `src/shared/`: framework-independent utilities.
- `src/components/ui/`: generic UI primitives.
- `supabase/migrations/`: immutable, forward-only shared-state migrations.
- `data/pipeline-bootstrap/`: importer input only; never a runtime Studio catalog.
- `public/site-fallbacks/`: safe public-page fallback art only.
- `tests/unit/`: durable contract/security/regression tests.
- `tests/smoke/`: focused browser regression coverage; not a substitute for real signed-in provider checks.

Retired root ownership lanes `src/lib/`, `src/store/`, and `src/types/` must not return.

## Storage and publication model

CardForge has three deliberate storage lanes:

- **Browser workspace:** user templates, cards, uploaded project assets, preferences, and portable project files; persisted JSON points to content-addressed IndexedDB Blobs rather than repeating Base64 bytes.
- **Supabase shared state:** owner settings, roadmap/votes, legal/public content, billing ledgers, contributor profiles/submissions/votes, campaign content/media/delivery history, and the shared asset registry.
- **Repository bootstrap/fallback material:** import seeds and public fallback art only.

`cardforge_asset_registry` is the single runtime shared catalog index. Template Studio publishes one immutable structured revision owned by the linked Forge Review submission, with content-addressed WebP media stored once. Published Sets reuse the same Pipeline and registry, pointing at the validated immutable `.cardforge` submission package that also serves import/export and provider transfer; installation creates independent browser identities through the normal project importer. Package v2 has one bounded archive writer: authorized device-file saves stream directly, while browser downloads and complete-body provider boundaries use a size-bounded Blob; the compatibility reader still accepts v1. The registry stores only active revision pointers and routing/discovery metadata rather than cloning authored documents. Generic binary uploads cover media, fonts, and canonical Set packages rather than introducing parallel authoring schemas. Owner deletion removes active registry/submission/vote/storage lineage and keeps a private tombstone so bootstrap cannot recreate it.

## Agent authoring

ChatGPT/Codex use authenticated `/mcp` tools to create and revise private Studio documents, preview exact CardForge renders, and hand the same document into normal Studio installation or Forge Review. MCP does not own a second template format, renderer, asset store, or publication authority. Clerk owns linked identity; CardForge owns Studio-document authorization and product semantics.

## Environment

Copy `.env.example` to `.env.local` for local provider testing. Core examples:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=http://localhost:9002
```

Use `.env.example` as the complete variable catalog. `SUPABASE_SERVICE_ROLE_KEY` remains a temporary compatibility fallback for deployments not yet rotated to the modern server secret; new setup should use `SUPABASE_SECRET_KEY`.

## Verification posture

GitHub CI is the deterministic code-health gate. Vercel Preview proves a coherent branch can deploy and supports browser-level inspection. Provider-backed auth, owner, billing, email, and protected workflows require a real signed-in production check on `cardforges.com` when affected.

Persistent tests protect durable security/access/billing/destructive-data/migration/rendering/export contracts and known regressions. Do not accumulate tests or abstractions merely to preserve development history.

Extended contributor lanes and native Meta publishing remain separate release gates and default off until their live operating checks in `docs/operations.md` pass.

## Documentation

- `docs/architecture.md`: current architecture and source-of-truth behavior.
- `docs/product-direction.md`: intended product model, boundaries, and delivery sequence.
- `docs/product-surface-map.md`: canonical zones, feature placement, and shipped-versus-direction inventory.
- `docs/integrations.md`: provider-native ownership and human journey traces.
- `docs/operations.md`: current operations, release, provider, roadmap, and recovery procedures.
- `docs/risk-register.md`: unresolved or explicitly accepted risks only.

Keep these documents current and focused. Completed rollout instructions belong in Git/provider history, not in the live docs.
