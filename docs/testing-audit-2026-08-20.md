# Test-suite audit — 2026-08-20

## Starting point

Before this maintenance pass, the CardForge unit suite contained 149 test files and 827 tests. The Vitest run itself completed in roughly 25 seconds, so raw runtime was not the primary concern.

The larger maintenance risk was implementation coupling: roughly one third of the test files inspected implementation source directly and asserted source strings, file placement, import paths, or historical SQL text.

## First-pass findings

Two duplicate-protection patterns stood out:

1. Feature-specific ownership snapshots duplicated the repository-wide architecture checker.
2. Tests that reopened immutable historical Supabase migrations duplicated the migration-safety guard.

Both patterns make refactors noisier without materially increasing protection of current behavior.

## First-pass cleanup

This pass removes 22 permanent test files:

- four feature-specific ownership snapshot suites already covered by the generic architecture checker;
- eighteen historical migration snapshot suites whose migration files are already protected from modification by `migrations:check`.

Behavioral tests for authentication, entitlements, billing, security, cloud saves, persistence, rendering, generation, MCP contracts, and destructive actions are intentionally retained.

## Follow-up candidates

A later pass should review the remaining source-inspection tests individually. The goal is not to delete them by category, but to replace exact source-string assertions with behavioral or public-contract tests where practical. Security/legal/published compatibility literals can remain when the literal requirement is the contract.

Do not add a CI test-count cap. Test count should be an observation, not a gate.
