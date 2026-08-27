# Testing principles

CardForge tests should make changes safer without making healthy refactors artificially expensive.

## Prefer behavior and public contracts

Tests should normally exercise exported functions, stores, parsers, policies, API contracts, persistence behavior, security behavior, or rendered outcomes. A refactor that preserves the same observable behavior should usually keep the same tests green.

Good permanent regression tests answer questions such as:

- Does a Free account receive the correct entitlement?
- Does a temporary working-document or connected-project write reject invalid, oversized, or stale data without altering authored work?
- Does an import preserve the editable CardForge document contract?
- Does a security boundary fail closed?
- Does bulk generation produce the expected card data?

## Avoid source-text snapshots

Do not add a permanent test just to assert an exact import statement, exact component location, exact wording inside source, or a retired file path unless that literal shape is itself a security, legal, or published compatibility contract.

If moving a component or renaming an internal helper breaks a test while user-visible behavior and public interfaces remain valid, the test is probably protecting implementation rather than behavior.

## Architecture has one owner

Feature-layering, public-interface, client/server, dependency-cycle, and legacy-root rules belong in `scripts/check-architecture.mjs` and its focused fixture tests in `tests/unit/architecture-boundaries.test.ts`.

Do not create feature-specific `*-ownership.test.ts` files that duplicate those generic rules. If CardForge needs a new architecture invariant, add it to the architecture checker so every feature receives the same protection.

## Migration history has one owner

Committed Supabase migrations are immutable. `scripts/check-migration-safety.mjs` and `tests/unit/migration-safety.test.ts` protect that rule.

Do not keep a permanent unit test whose only purpose is to reopen one historical migration and assert its literal SQL. Such a test cannot protect future schema evolution; it only duplicates the immutability guard. Test current server behavior or a cross-migration security invariant instead.

## Keep high-value safety tests

Do keep tests for:

- authentication, authorization, entitlements, and billing behavior;
- destructive-action and webhook safety;
- privacy and abuse-protection behavior;
- serialization/import/export and persistence contracts;
- CardForge rendering and generation behavior;
- MCP/plugin published contracts;
- temporary working-document and connected-project behavior;
- architecture and migration-safety tooling itself.

## Regression-test lifecycle

When fixing a bug, add the smallest regression test that reproduces the broken behavior at the strongest stable boundary available. If a later generic guard fully subsumes that regression, retire the narrower test instead of keeping both forever.

Test count is not a quality metric. CardForge should prefer fewer tests with broad, stable value over many tests that freeze implementation details.
