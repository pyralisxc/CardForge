# CardForge Feature-Ownership Refactor

Status: approved for implementation

Started: July 16, 2026

Owner: configured repository owner

This document is the active design for the CardForge architecture refactor. It is temporary implementation guidance: once every milestone is complete, the durable rules move into `docs/architecture.md` and this file is removed.

## Objective

Turn the existing feature-oriented source tree into enforced feature modules with explicit ownership, one-way dependencies, focused coordinators, and no obsolete compatibility paths. Preserve all current product capabilities and provider behavior. Small UX corrections are allowed when they directly remove confusion exposed by the decomposition.

The refactor is delivered through incremental pull requests. Every pull request must leave `main` deployable and production-safe.

## Non-negotiable outcomes

- Every product workflow has one owning feature.
- Cross-feature imports use declared client or server entry points.
- Feature internals cannot be imported from another feature.
- The feature dependency graph is acyclic.
- Next.js routes adapt HTTP requests and delegate workflows.
- Domain modules contain pure CardForge rules and models.
- Infrastructure modules adapt Clerk, Resend, Stripe, Supabase, and runtime configuration without owning product policy.
- Generic UI and shared utilities cannot import product code.
- Mixed-responsibility coordinators are decomposed.
- Current IndexedDB is the only browser persistence system; legacy browser/project compatibility is removed.
- No deprecated re-export, compatibility alias, duplicate store, fallback catalog, or temporary migration wrapper remains.
- Live documentation describes only the final system. Git and merged pull requests retain implementation history.

Required operational data remains protected. This refactor does not delete Stripe history or subscriptions, Clerk users, Supabase billing and operational records, legal records, or other provider-owned state.

## Target source structure

```text
src/
  app/                   Next.js pages, layouts, and route adapters
  components/ui/         Generic design-system primitives
  domain/                Pure CardForge models and rules
  features/              Product workflows with explicit public interfaces
  infrastructure/        Provider and runtime adapters
  shared/                Small framework-neutral utilities
```

Each feature may use the following internal structure when needed:

```text
src/features/<feature>/
  client.ts              Browser-safe public interface
  server.ts              Server-only public interface
  components/            Feature-owned UI
  hooks/                 Browser orchestration
  model/                 Pure feature rules and contracts
  server/                Services and repositories
```

Folders are created only when they hold a real responsibility. Empty scaffolding and one-file abstraction layers are not allowed.

## Dependency rules

The primary direction is:

```text
app -> features -> domain -> shared
```

Server data paths are:

```text
app route -> feature server interface -> feature service -> infrastructure adapter
```

CI enforces these rules:

1. `shared` imports only `shared` or external packages.
2. `domain` imports only `domain`, `shared`, or external packages that do not bind it to React, Next.js, or a provider.
3. `components/ui` imports only `components/ui`, `shared`, or presentation dependencies.
4. `infrastructure` imports `domain` contracts only when adapting them; it cannot import features or product UI.
5. A feature may import its own internals, allowed domain/shared/UI foundations, and another feature's declared `client` or `server` interface.
6. Client code cannot import a server interface or server-only module.
7. Server code cannot import browser components or hooks.
8. Features cannot import `app` or app-shell composition.
9. Cross-feature dependencies cannot form cycles.
10. Deep imports into another feature fail CI.

An architecture check prints review warnings for production files above 500 lines. Size alone does not fail CI. A large file is acceptable only when it has one focused responsibility; mixed responsibilities or dependency violations fail the review standard. During the incremental migration, a checked-in architecture baseline may describe only violations that already exist on `main`; every milestone must shrink it, new violations fail immediately, and final convergence deletes it. The finished refactor retains no exception allowlist.

## Final ownership map

### Domain

- `cards`: card data, card sets, and card-face contracts.
- `templates`: template, element, field-contract, and appearance models.
- `rendering`: pure geometry, binding resolution, and render calculations.
- `entitlements`: pure access and presentation-policy contracts.

### Features

- `account`: profile, identity-facing account surfaces, Founder Beta access, and entitlement resolution.
- `billing`: checkout, portal, Stripe event processing, subscription state, reconciliation, and billing owner operations.
- `card-generator`: single/bulk generation and output/export workflows.
- `card-rendering`: React card preview, rich-text presentation, thumbnails, and visible watermark presentation.
- `contact`: contact requests, email workflow, delivery status, and owner contact operations.
- `developer-assets`: developer profiles, submissions, voting, pipeline decisions, publishing, and registry access.
- `owner`: owner authorization, readiness summary, and composition of feature-owned operations panels.
- `project`: browser workspace state, IndexedDB persistence, local assets, project import/export, and recovery.
- `public-content`: public site copy, mechanics, and legal documents.
- `roadmap`: public roadmap, suggestions, voting, and owner moderation.
- `template-editor`: template editing, canvas interaction, editor commands, history, variables, layers, and asset selection.

The current one-hook `template-library` feature is folded into Template Editor or Project according to responsibility.

### Infrastructure

- `clerk`: authentication and user metadata adapters.
- `resend`: email provider adapter.
- `stripe`: Stripe SDK construction and provider mapping.
- `supabase`: server client construction and database error helpers.
- `runtime`: environment and deployment configuration.

## Coordinator decomposition

### Template Editor

`CardTemplateMaker` becomes a composition component. Focused hooks own editor session lifecycle, viewport behavior, commands, variables, and asset loading. The existing editor controller remains the authoritative command/history layer. UI components issue commands rather than mutating template state through scattered callbacks.

### Project workspace

The root app store moves under Project and is composed from focused templates, card sets, appearance, workspace, and persistence slices. One project client interface exposes selectors and commands. Features cannot write raw persistence data or inspect another slice's implementation.

### Card rendering

Shared card preview, rich-text display, image/field override resolution, thumbnails, and visible watermark rendering move to Card Rendering. Template Editor and Generator depend on Card Rendering rather than on each other. Pure calculations live in Domain. Clean exports remain explicitly separate from entitled on-screen presentation.

### Owner console

`OwnerConsolePage` becomes navigation plus owner-access/readiness composition. Billing, Account, Roadmap, Public Content, Contact, and Developer Assets own their operations panels and data calls. The console stops loading and saving one cross-domain payload.

The catch-all `ownerConsoleStore` is deleted. Database row mapping and repositories move beside their owning feature tables.

### Developer asset pipeline

The developer asset store separates into contracts, validation, ranking, profile/submission/vote/settings repositories, pipeline service, and registry-publishing service. Repositories perform storage. Services own workflows. Pure model files own calculations and policy.

The hub separates submission, voting, published library, program status, and editing views from browser request orchestration.

### Roadmap and other large surfaces

Roadmap leaves Account and gains its own model, public service, moderation service, suggestion UI, list, voting controls, and owner panel. Remaining files above the review threshold are evaluated by responsibility. Large static catalogs may remain focused; mixed workflow coordinators do not.

## Data and error flow

Client flow:

```text
feature component -> feature hook/client operation -> HTTP route or project command
```

Server flow:

```text
route validation -> feature service -> repository/provider adapter -> typed result
```

- Domain and model functions return values or typed validation results.
- Repositories translate provider/database errors into feature-owned error categories without exposing secrets.
- Services decide whether an error is retryable, conflicting, unauthorized, unavailable, or invalid.
- Routes convert those categories through the shared API response primitives.
- Components display feature-owned user-facing messages and recovery actions.
- Unknown failures remain observable server-side and produce safe client messages.
- No component parses provider error shapes directly.
- No route duplicates feature business rules.

## CI enforcement

The repository gains a maintained architecture command that runs in normal CI. It validates:

- allowed source layers;
- feature public-interface usage;
- client/server boundaries;
- forbidden deep imports;
- feature dependency cycles;
- removed legacy paths and aliases;
- root catch-all folders/files that must not return;
- file-size review warnings.

Architecture tests use a small repository-owned scanner rather than a heavyweight framework unless the TypeScript parser already present cannot provide reliable results. Rules and the temporary migration baseline must be represented as code and tests. The baseline can only shrink: CI rejects any newly introduced violation, and final convergence removes the baseline entirely.

CI order remains install, lint, typecheck, unit tests, and build, with architecture validation before the build. Public smoke continues to gate browser workflows. Authenticated production smoke remains the scheduled and manually dispatchable provider check.

## Testing strategy

Every extraction follows characterization-first testing:

1. Preserve or add tests around current behavior.
2. Move one responsibility behind its target interface.
3. Update consumers without compatibility re-exports.
4. Run focused tests, architecture checks, typecheck, and lint.
5. Run the complete unit suite and production build before opening the pull request.
6. Require hosted CI and public smoke before merge.
7. Verify the exact production deployment and health routes after merge.

Critical behavior that must remain covered includes editor history and commands, template/card contracts, persistence, project import/export, watermark entitlements, rendering/export parity, API authorization, billing ledger/reconciliation, developer voting/publishing, roadmap abuse controls, legal/public content, and owner access.

## Delivery milestones

The implementation is split into production-safe pull requests:

1. **Architecture guardrails and foundations**
   - Add the architecture checker and dependency contract tests.
   - Create domain/shared/infrastructure foundations.
   - Define the initial public interfaces.
   - Record current violations as failing migration targets, not permanent exemptions.

2. **Card domain and rendering ownership**
   - Move root types and shared rendering primitives.
   - Establish Card Rendering.
   - Break Template Editor ↔ Generator cycles.
   - Remove old root card component and type locations.

3. **Project workspace clean cut**
   - Move/split the root store.
   - Make IndexedDB the only persistence system.
   - Remove legacy project/storage readers and compatibility tests.
   - Fold Template Library into its actual owners.

4. **Template Editor decomposition**
   - Extract session, viewport, command, variable, and asset responsibilities.
   - Reduce `CardTemplateMaker` to composition.
   - Preserve history, grouping, undo/redo, pointer, and rendering behavior.

5. **Public content, Roadmap, Contact, and Account ownership**
   - Split these workflows out of Owner and Account catch-alls.
   - Move repositories and panels beside their owners.
   - Remove the corresponding owner-store responsibilities.

6. **Billing and Owner composition**
   - Finish feature-owned billing operations.
   - Reduce Owner to authorization/readiness/navigation composition.
   - Delete `ownerConsoleStore` and the aggregate console payload.

7. **Developer asset pipeline decomposition**
   - Separate repositories, pure policy, pipeline services, and registry publishing.
   - Decompose the developer hub and owner program panel.

8. **Final convergence**
   - Resolve every remaining architecture violation and cycle.
   - Review all files above the size threshold.
   - Remove the temporary design/plan documents.
   - Rewrite live architecture, operations, risk, ownership, and contributor documentation.
   - Run the complete verification matrix, merge, deploy, and verify production.

Milestones may be subdivided when a smaller pull request creates a cleaner review boundary, but they cannot be combined into one risky cutover.

## Definition of done

- Architecture CI passes with no forbidden dependency, cycle, deep import, or legacy-path violation.
- No mixed-responsibility coordinator remains.
- No obsolete root `src/lib`, `src/store`, or catch-all `src/types/index.ts` remains.
- No temporary compatibility re-export or migration exception remains.
- Every feature has an accurate owner, public interface, and colocated tests.
- Full lint, typecheck, unit test, build, public smoke, and production health checks pass.
- Dependency audit has no undocumented finding.
- Production is deployed from the final exact `main` commit with no new runtime error group.
- Live documentation describes only the final architecture and current operational truth.
