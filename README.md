# CardForge

CardForge helps creators turn card ideas into full, export-ready sets. The Studio combines reusable templates, structured data, bulk generation, and clean PNG, ZIP, PDF, or Tabletop Simulator exports, while approved developers help shape the shared library that powers the product. The fantasy forge is the doorway; underneath is a serious production workflow for creators building real card systems. User project work stays in browser storage or downloaded project files for the MVP.

## MVP State

- Public site: `/`
- Studio: `/studio`
- Account and Founder Beta status: `/account`
- Profile management: `/profile`
- Public roadmap and feature voting: `/roadmap`
- Developer application and asset pipeline: `/developer`
- Owner console: `/owner`

The current MVP is suitable for internal/demo QA. Public launch status is tracked in [docs/release-checklist.md](docs/release-checklist.md), including the accepted Next/PostCSS audit exception and the remaining paid entitlement operations.

## Quick Start

Requirements:

- Node.js 20 or newer
- npm

```bash
npm install
npm run dev
```

Open [http://localhost:9002](http://localhost:9002).

If the visible local site looks stale, stop any old server on port `9002` and restart `npm run dev`. Playwright smoke tests also use `localhost:9002`, so avoid running multiple dev/prod servers against the same checkout.

## Core Commands

```bash
npm run dev        # Next dev server on http://localhost:9002
npm run build      # Production build
npm run lint       # ESLint
npm run typecheck  # next typegen + TypeScript no-emit check
npm run test       # Vitest unit suite
npm run test:watch # Vitest watch mode
npm run smoke      # Playwright smoke suite
```

## Source Map

- `src/app/`: Next.js routes and API routes.
- `src/features/app-shell/`: Studio shell, workspace state, and route-level composition.
- `src/features/template-editor/`: Layout Studio panels, inspector tools, canvas commands, and editor controller hooks.
- `src/features/card-generator/`: Single output entry, bulk data import, generated gallery, export controls, and paper/export settings.
- `src/features/account/`: Account overview, roadmap panels, and profile surface.
- `src/features/developer-assets/`: Developer Asset Hub, owner asset program controls, voting/review UI.
- `src/features/owner/`: Owner console for launch, account, legal, promo, and pipeline command surfaces.
- `src/lib/`: Shared model, rendering, export, auth, Supabase, pipeline, and validation helpers.
- `src/store/`: Zustand persisted local app state and derived selectors.
- `data/default-templates/`, `data/styles/`, and `public/card-assets/`: Historical starter/import material for the Forge Pipeline sync, not runtime fallback catalogs.
- `supabase/migrations/`: Ordered database migrations for shared roadmap, owner, Founder Beta, asset registry, and developer pipeline state.
- `tests/unit/`: Vitest coverage for pure helpers and model behavior.
- `tests/smoke/`: Playwright workflow and authenticated QA coverage.

## Product Architecture

CardForge has three storage lanes:

- Browser-local workspace state for user templates, generated cards, custom local assets, and project files.
- Supabase-backed Forge Pipeline state for roadmap voting, Founder Beta claims, owner settings, asset registry metadata, developer submissions, votes, and published shared-library assets.
- Repo starter/import files that can seed the pipeline with `npm run pipeline:sync-defaults`, but should not silently replace a missing database catalog at runtime.

The app should keep those lanes visibly distinct. Normal free/paid user uploads stay local until a developer intentionally submits a source asset into Forge Review. Developer and owner-submitted assets move through one shared voting, publishing, archive, and recovery pipeline.

## Environment

Copy `.env.example` to `.env.local` for local account/database testing.

Common local variables:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_ID=price_...
NEXT_PUBLIC_APP_URL=http://localhost:9002
```

Reusable authenticated QA accounts are preferred over disposable user creation. Set the `CARDFORGE_E2E_*` values documented in `.env.example` when running the authenticated smoke suite.

## Documentation

- [docs/development-guide.md](docs/development-guide.md): front end and back end development map.
- [docs/blueprint.md](docs/blueprint.md): product architecture and source-of-truth behavior.
- [docs/release-checklist.md](docs/release-checklist.md): MVP readiness, verification, risk, and launch decisions.
- [docs/preset-quality-audit.md](docs/preset-quality-audit.md): Layout Studio preset/tool quality audit.
- [docs/site-tooling-walkthrough-audit.md](docs/site-tooling-walkthrough-audit.md): live site walkthrough findings.
- [docs/print-export-handoff.md](docs/print-export-handoff.md): print, prepress, and Tabletop Simulator export expectations.

Keep the README short. Durable architecture and launch decisions belong in `docs/`.
