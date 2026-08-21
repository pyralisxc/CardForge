# CardForge tests

See [`docs/testing.md`](../docs/testing.md) for the permanent test philosophy and ownership rules.

The short version: prefer behavioral and public-contract tests; keep architecture rules in the architecture checker and migration immutability in the migration-safety checker; avoid permanent source-string snapshots unless the literal text or shape is itself the contract.
