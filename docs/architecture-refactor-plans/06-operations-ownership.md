# Operations Ownership Refactor Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and superpowers:test-driven-development. Publish each phase as its own production-safe PR and require hosted CI/Public smoke before continuing.

**Goal:** Give provider infrastructure, public content, accounts, billing, roadmap, and owner operations one clear owner each; remove all remaining root catch-alls; decompose oversized operational coordinators; and make every cross-feature or App Router dependency pass through a declared interface.

**Architecture:** Provider adapters live in Infrastructure, framework-agnostic helpers live in Shared, and product behavior stays in a feature. Public Site, Legal, Contact, Roadmap, Account, Billing, Developer Assets, and Owner expose explicit `client.ts` and/or `server.ts` entry points. Owner becomes an authorization and composition shell that consumes those interfaces rather than owning every operational record. App Router files compose feature interfaces only.

**Compatibility:** This is an immediate clean cut. Do not leave compatibility exports under `src/lib`, retired feature internals, or duplicate stores. Preserve live Clerk, Stripe, Supabase, Resend, and Vercel data and APIs.

---

## PR A — Provider infrastructure and public interfaces

### Task 1: Define the provider boundary

- [x] Add a failing structural test requiring owned infrastructure/shared paths and forbidding `src/lib`.
- [x] Record RED against the current root catch-all structure.
- [x] Move Clerk, Supabase, public URL, API response/validation, server timing, throttling, timeout, and feature error copy to their owners.
- [x] Classify the required Next middleware entry as App composition while keeping its implementation in Infrastructure.
- [x] Add Account, Billing, App Shell, Card Generator, Contact, Legal, Developer Assets, and Owner public entry points and route App consumers through them.
- [x] Regenerate a smaller architecture baseline: 221 to 21 tracked violations, with no new violation accepted.
- [x] Run lint, typecheck, architecture check, the full unit suite (64 files / 402 tests), production build, diff check, and dependency audit. Narrow client subpaths avoid barrel-driven bundle growth; Studio remains 15.6 kB / 557 kB first load. Only the accepted nested Next/PostCSS advisory remains.
- [x] Publish as PR #35, require hosted CI/Public smoke, merge, and verify exact production deployment `dpl_BymqfLthhiqW9j57Bqbz78T15hMx` for main commit `4e49e2906ac9f68391c08de3bb770665d1a4a059`. The deployment is READY on `cardforges.com`, all five production health routes passed, and the post-deploy runtime window contained no error groups.

## PR B — Public content, legal, contact, and roadmap ownership

- [x] Move public site content/contracts/store into Public Site.
- [x] Move legal contracts/defaults/store into Legal.
- [x] Move contact request persistence into Contact.
- [x] Move roadmap models, store, page, panel, and owner mechanics into Roadmap.
- [x] Replace Owner-owned public-content imports with declared client/server interfaces.
- [x] Split the aggregate server payload by owned records without changing live provider data. Owner now composes dedicated stores, and `ownerConsoleStore` is 326 lines instead of 813.
- [ ] Verify public pages, roadmap mutation gates, contact delivery, and owner editing.

## PR C — Account and Billing ownership

- [ ] Decompose `AccountProfilePage` into account identity, access, billing, Founder Beta, and developer-status sections.
- [ ] Make Account own current-user resolution while Domain owns pure entitlement policy.
- [ ] Make Billing own customer and owner billing panels, Stripe event storage, reconciliation, and billing settings.
- [ ] Remove Account/Billing/Owner internal cross-imports and route all App API consumers through server interfaces.
- [ ] Verify free, paid, developer, Founder Beta, owner, checkout, portal, webhook, and reconciliation behavior.

## PR D — Owner console composition

- [ ] Reduce `OwnerConsolePage` to loading, navigation, and owned panel composition.
- [ ] Replace `ownerConsoleStore` with focused owner access, integration health, and database-operations modules.
- [ ] Lazy-load operational panels that are not part of the initial owner overview.
- [ ] Keep every focused coordinator near the 500-line review threshold or document why a cohesive leaf exceeds it.
- [ ] Remove resolved baseline entries and verify owner smoke against production.

## Completion gate

- [ ] No `src/lib`, compatibility export, or duplicate operational model remains.
- [ ] App Router imports features only through `client.ts` or `server.ts`.
- [ ] Cross-feature imports use declared interfaces and the feature graph is acyclic.
- [ ] Live documentation describes only the final ownership model and current operational exceptions.
