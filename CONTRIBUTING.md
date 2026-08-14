# Contributing to CardForge

CardForge is a commercial product with a reviewed developer asset program. Public source visibility does not grant permission to reuse CardForge code or assets.

Before proposing a code change:

1. Open an issue describing the user-facing result and affected feature owner.
2. Keep one responsibility in one feature folder.
3. Add a focused persistent test only when the change touches a durable security, billing, access, destructive-data, migration, rendering/export, or known-regression boundary. Remove temporary development tests after the behavior is proven.
4. Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
5. Submit a focused pull request and disclose provider, persistence, access, billing, or migration impact.

Do not include secrets, customer data, unlicensed artwork, generated assets without clear rights, or changes that bypass Clerk, Stripe, Supabase, or owner authorization.

Code contributions are accepted only under terms explicitly agreed to by Cameron Locke. Developer asset submissions continue to use the in-product Forge Review process and its contributor terms.
