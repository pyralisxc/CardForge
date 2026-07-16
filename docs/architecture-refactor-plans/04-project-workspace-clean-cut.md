# Project Workspace Clean-Cut Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and superpowers:test-driven-development. This milestone is intentionally delivered as more than one production-safe PR when review or deployment risk warrants it.

**Goal:** Give browser workspace state, persistence, local assets, recovery, and portable project files one owner; make IndexedDB the only browser persistence system; delete the root store and legacy storage compatibility; and expose Project only through explicit client/server interfaces.

**Architecture:** Project owns a Zustand workspace composed from focused template, card/output, appearance, settings, and persistence slices. `client.ts` is the only browser interface used by App Shell, Generator, Template Editor, Account, and Developer Assets. Pure export-setting, asset, and entitlement contracts move to Domain so Project does not depend on product features. IndexedDB namespaces store workspace state, assets, editor drafts, and small browser preferences. Provider-owned billing/auth/database records are untouched.

**Tech Stack:** Next.js 15, React 18, TypeScript 5, Zustand 5, IndexedDB, fake-indexeddb, Vitest 4, Playwright.

## Global constraints

- Preserve every current workspace command and selector behavior.
- Preserve the current project-document schema and its strict version check; do not accept legacy app-store or generated-card-only JSON as a project.
- Project workspace state, assets, recovery, and project files do not read, migrate, write, or clear localStorage. Existing development/local browser workspace state is intentionally abandoned. PR B removes the remaining feature-owned preference/draft uses.
- Do not leave `useAppStore`, `AppState`, root store re-exports, old Project `lib` paths, or deprecated storage aliases.
- Other features and `app` consume Project only through `@/features/project/client` or `server`.
- Project client code cannot import Account, Card Generator, Developer Assets, Template Editor, or root catch-all modules.
- Stripe, Clerk, Supabase, legal, and operational records remain unchanged.
- Update the architecture baseline only after every new violation is removed.

---

## PR A — Workspace owner and IndexedDB-only persistence

### Task 1: Define the clean-cut ownership contract

- [x] Add a failing repository test that requires Project client/store/slices/persistence/model paths, forbids `src/store`, Project `lib`, `createMigratingBrowserStorage`, `useAppStore`, and Project `localStorage` calls, and enforces Project client imports.
- [x] Run the focused test and record RED: all five assertions failed against the former structure.
- [x] Commit the failing contract (`5051715`).

### Task 2: Move shared contracts to Domain

- [x] Move `ExportMode` into Rendering.
- [x] Move the card-asset contract into Templates while leaving registry discovery in Developer Assets.
- [x] Move access/capability and owner-access policy into Entitlements.
- [x] Move pure template reconstruction/factory rules into Templates and split presentation-only appearance CSS from normalization.
- [x] Update tests and consumers; delete old locations without compatibility exports.

### Task 3: Compose the Project workspace store

- [x] Create focused template, output/card, appearance, settings, and lifecycle slices.
- [x] Create Project-owned selectors and `useProjectStore`.
- [x] Persist only the durable state subset through direct IndexedDB with recovery snapshots.
- [x] Update all store consumers to the Project client interface and delete `src/store`.
- [x] Keep transient dialog state out of persisted state.

### Task 4: Establish Project client/server interfaces

- [x] Move project document, local assets, IndexedDB, project-file hook, and storage alerts into owned folders.
- [x] Export browser-safe operations through `client.ts`.
- [x] Move shipped-library server authorization to the feature that owns registry writes and expose it through a server interface.
- [x] Update app routes and features to use declared interfaces only.

### Task 5: Replace storage compatibility and tests

- [x] Delete legacy localStorage migration/fallback behavior and its tests.
- [x] Update workspace, project-asset, quota, recovery, and persistence tests for direct IndexedDB.
- [x] Update Playwright state seeding/clearing to write the current IndexedDB namespace.
- [x] Preserve paid export/import/refresh proof in the hosted authenticated smoke specification.

### Task 6: Verify and publish PR A

- [x] Confirm the architecture checker reports only stale resolved baseline entries before regeneration.
- [x] Regenerate a smaller baseline: 358 to 288 tracked violations, with 17 size warnings.
- [x] Run lint, typecheck, architecture, all unit tests (58 files / 382 tests), production build, diff check, and dependency audit.
- [x] Self-review state transitions, persisted fields, import/export parity, and server/client boundaries.
- [x] Open [PR #32](https://github.com/pyralisxc/CardForge/pull/32), require CI/Public smoke, squash merge, and verify production deployment `dpl_B6orKzrVf5KzZyKYk9QYFRMSdAcV` on exact main commit `26c8d5e4bd0d2fe73da47afe5d0d657ae99c239e`; five routes passed and no runtime errors were present.

Local browser execution was attempted after rewriting the smoke seed helpers. The environment could not download the Playwright Chromium archive (the provider returned a zero-byte payload); hosted Public smoke run [29514986129](https://github.com/pyralisxc/CardForge/actions/runs/29514986129) supplied the required executable browser proof before merge.

---

## PR B — Browser persistence convergence and Template Library fold

### Task 7: Move all remaining browser preferences/drafts to Project persistence

- [x] Replace template-editor draft, command recents/favorites, first-run guide, backup reminder, and developer asset local reads with typed IndexedDB preference/document operations.
- [x] Make async hydration explicit and non-blocking; preserve save-failure reporting.
- [x] Assert production source contains no localStorage persistence.

### Task 8: Fold Template Library into its actual owner

- [x] Move template-library commands into Template Editor while leaving workspace collection state in Project.
- [x] Delete the one-hook `template-library` feature and update App Shell through Template Editor's declared client interface.
- [x] Remove the corresponding baseline entries, shrinking the active baseline from 288 to 286.

### Task 9: Verify and publish PR B

- [x] Run focused persistence/editor tests; hosted Public smoke is the PR browser gate because the local Chromium provider is unavailable. Paid project import/recovery remains covered by the authenticated production suite last proven in run 29469266134.
- [x] Run the complete local release matrix (60 Vitest files / 386 tests) and audit; only the accepted nested Next/PostCSS advisory remains.
- [x] Require hosted CI run 29516377028 and Public smoke run 29516377023, squash merge [PR #33](https://github.com/pyralisxc/CardForge/pull/33), and verify production deployment `dpl_4KDXWeip7cvhDpaEgyXSeUtnMBfh` on exact main commit `e55394947b8a5f93d3567d928fb91be00cf42e7a`; all five health routes passed and no runtime error cluster was present.
