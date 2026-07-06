# Forge Chronicle Account Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform `/account` from an entitlement profile into a fantasy-branded Forge Chronicle with a 3-year ROI timeline, developer-managed roadmap controls, and sortable public feature voting.

**Architecture:** Keep Clerk as the identity and dev-role source, Supabase as lightweight shared roadmap storage, and browser storage as the user project source of truth. Expand the current `cardforge_roadmap_items` table into a timeline model while preserving one vote per Clerk user. Expose mutations only through Next.js API routes.

**Tech Stack:** Next.js App Router, Clerk, Supabase Postgres, React client components, Vitest, Playwright smoke tests.

---

### Task 1: Timeline Domain Rules

**Files:**
- Modify: `src/lib/roadmap.ts`
- Test: `tests/unit/roadmap.test.ts`

- [ ] Add `RoadmapItemType`, `RoadmapSortMode`, ROI target helpers, and feature sorting helpers.
- [ ] Add tests for monthly target calculation, 3-year ordering, and feature sort modes: most votes, least votes, newest, oldest.
- [ ] Run `npx vitest run tests/unit/roadmap.test.ts` and confirm the new tests fail before implementation, then pass after implementation.

### Task 2: Supabase Timeline Schema

**Files:**
- Create: `supabase/migrations/202605220002_forge_chronicle_timeline.sql`
- Modify: `README.md`
- Modify: `docs/blueprint.md`

- [ ] Add nullable timeline columns to `cardforge_roadmap_items`: `item_type`, `description`, `visible_month`, `target_mrr_cents`, `monthly_cost_cents`, and `shipped_at`.
- [ ] Seed official 3-year ROI checkpoints using realistic growth-curve MRR targets.
- [ ] Document that both migrations must be run in order for a fresh Supabase project.

### Task 3: Server Store and API Mutations

**Files:**
- Modify: `src/lib/roadmapStore.ts`
- Modify: `src/app/api/roadmap/route.ts`
- Create: `src/app/api/roadmap/items/[itemId]/route.ts`
- Modify: `src/lib/apiResponses.ts`

- [ ] Read and return timeline fields from Supabase.
- [ ] Allow normal signed-in users to submit only compact public feature suggestions.
- [ ] Allow dev accounts to create official ROI checkpoints or feature goals.
- [ ] Allow dev accounts to delete/archive roadmap goals through a protected API route.
- [ ] Keep the negative-vote auto-archive behavior for user-created items.

### Task 4: Forge Chronicle Account UI

**Files:**
- Modify: `src/features/account/components/AccountProfilePage.tsx`
- Modify: `src/features/account/components/RoadmapPanel.tsx`

- [ ] Remove user-facing "source: Clerk" language from normal account cards.
- [ ] Rework the account page copy into personal Forge language.
- [ ] Render the roadmap as present-first timeline sections: Current, Future, Past.
- [ ] Add feature-board sorting controls for most votes, least votes, newest, and oldest.
- [ ] Add developer-only controls to create ROI checkpoints/features and delete/archive official goals.

### Task 5: Verification

**Files:**
- Existing test and smoke files as needed.

- [ ] Run `npm test`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build` after stopping dev servers and clearing `.next`.
- [ ] Run `npm run smoke`.
- [ ] Restart the dev server on `http://localhost:9002` and verify `/account` renders the Chronicle setup-pending state when the migration is not yet run.
