# Developer Asset Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the MVP developer asset program framework: owner-configurable roster/voting rules, developer submissions, peer votes, lifecycle evaluation, Supabase persistence, and lightweight account/owner UI surfaces.

**Architecture:** Keep the rules engine pure in `src/lib/developerAssets.ts`, put Supabase persistence in `src/lib/developerAssetStore.ts`, expose developer/owner actions through `/api/developer-assets`, and render focused panels inside the existing account and owner pages. The MVP stores submission metadata and preview URLs/data URLs as records; promotion into file-backed site defaults remains an owner decision and future publishing step.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase, Clerk trusted private metadata/owner access, Vitest, Tailwind/shadcn primitives.

---

### Task 1: Pure Developer Asset Rules

**Files:**
- Create: `src/lib/developerAssets.ts`
- Test: `tests/unit/developer-assets.test.ts`

- [ ] **Step 1: Write failing tests for defaults, settings normalization, vote evaluation, archive trim, and monthly stats**

```ts
import {
  DEFAULT_DEVELOPER_PROGRAM_SETTINGS,
  countDeveloperMonthlyStats,
  evaluateDeveloperAssetDecision,
  getVisibleArchivedSubmissions,
  normalizeDeveloperProgramSettingsInput,
} from '@/lib/developerAssets';

describe('developer asset program rules', () => {
  it('normalizes owner settings with launch defaults and guardrails', () => {
    const settings = normalizeDeveloperProgramSettingsInput({
      maxActiveDevelopers: '200',
      monthlySubmissionLimit: '-2',
      monthlyPublishedRequirement: '7',
      minimumVotesForGrading: '3',
      minimumPositiveVotePercent: '88',
      archiveVisibleLimit: '1000',
      profitSharePoolPercent: '15',
      publishCapsByType: { templates: '4', icons: -1 },
    });

    expect(settings.maxActiveDevelopers).toBe(100);
    expect(settings.monthlySubmissionLimit).toBe(DEFAULT_DEVELOPER_PROGRAM_SETTINGS.monthlySubmissionLimit);
    expect(settings.monthlyPublishedRequirement).toBe(7);
    expect(settings.minimumVotesForGrading).toBe(3);
    expect(settings.minimumPositiveVotePercent).toBe(88);
    expect(settings.archiveVisibleLimit).toBe(500);
    expect(settings.profitSharePoolPercent).toBe(15);
    expect(settings.publishCapsByType.templates).toBe(4);
    expect(settings.publishCapsByType.icons).toBe(DEFAULT_DEVELOPER_PROGRAM_SETTINGS.publishCapsByType.icons);
  });

  it('keeps assets in voting until the minimum vote count is reached', () => {
    expect(evaluateDeveloperAssetDecision({
      settings: DEFAULT_DEVELOPER_PROGRAM_SETTINGS,
      positiveVotes: 4,
      negativeVotes: 0,
      publishedThisPeriodForType: 0,
      ownerFinalReviewRequired: false,
    })).toMatchObject({ nextStatus: 'voting', reason: 'needs_more_votes' });
  });

  it('archives assets with enough votes and more negative than positive votes', () => {
    expect(evaluateDeveloperAssetDecision({
      settings: DEFAULT_DEVELOPER_PROGRAM_SETTINGS,
      positiveVotes: 2,
      negativeVotes: 4,
      publishedThisPeriodForType: 0,
      ownerFinalReviewRequired: false,
    })).toMatchObject({ nextStatus: 'archived', reason: 'negative_vote_balance' });
  });

  it('promotes strong assets to publish candidates until type caps are reached', () => {
    expect(evaluateDeveloperAssetDecision({
      settings: { ...DEFAULT_DEVELOPER_PROGRAM_SETTINGS, minimumPositiveVotePercent: 70, publishCapsByType: { ...DEFAULT_DEVELOPER_PROGRAM_SETTINGS.publishCapsByType, icons: 2 } },
      positiveVotes: 7,
      negativeVotes: 1,
      publishedThisPeriodForType: 1,
      ownerFinalReviewRequired: false,
    })).toMatchObject({ nextStatus: 'publish_candidate', reason: 'passes_vote_threshold' });
  });

  it('keeps otherwise passing assets in voting when the type cap is full', () => {
    expect(evaluateDeveloperAssetDecision({
      settings: { ...DEFAULT_DEVELOPER_PROGRAM_SETTINGS, minimumPositiveVotePercent: 70, publishCapsByType: { ...DEFAULT_DEVELOPER_PROGRAM_SETTINGS.publishCapsByType, icons: 2 } },
      positiveVotes: 7,
      negativeVotes: 1,
      publishedThisPeriodForType: 2,
      ownerFinalReviewRequired: false,
    })).toMatchObject({ nextStatus: 'voting', reason: 'publish_cap_full' });
  });

  it('shows only the latest archive window by timeline', () => {
    const archived = Array.from({ length: 103 }, (_, index) => ({
      id: `asset-${index}`,
      status: 'archived' as const,
      submittedAt: `2026-05-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
      updatedAt: `2026-06-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
    }));

    expect(getVisibleArchivedSubmissions(archived, 100)).toHaveLength(100);
  });

  it('counts monthly developer stats by submitted, published, archived, and rejected states', () => {
    const stats = countDeveloperMonthlyStats([
      { status: 'submitted', submittedAt: '2026-05-01T00:00:00.000Z' },
      { status: 'published', submittedAt: '2026-05-02T00:00:00.000Z' },
      { status: 'archived', submittedAt: '2026-05-03T00:00:00.000Z' },
      { status: 'rejected', submittedAt: '2026-05-04T00:00:00.000Z' },
      { status: 'published', submittedAt: '2026-04-04T00:00:00.000Z' },
    ], new Date('2026-05-23T00:00:00.000Z'));

    expect(stats).toEqual({ submitted: 4, published: 1, archived: 1, rejected: 1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/developer-assets.test.ts`
Expected: FAIL because `src/lib/developerAssets.ts` does not exist.

- [ ] **Step 3: Implement `src/lib/developerAssets.ts`**

Create exported types, defaults, normalization helpers, decision evaluator, archive trimming, and monthly stats helpers.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/unit/developer-assets.test.ts`
Expected: PASS.

### Task 2: Persistence and API

**Files:**
- Create: `src/lib/developerAssetStore.ts`
- Create: `src/app/api/developer-assets/route.ts`
- Create: `src/app/api/developer-assets/[submissionId]/route.ts`
- Create: `src/app/api/developer-assets/[submissionId]/vote/route.ts`
- Modify: `src/lib/apiResponses.ts`
- Create: `supabase/migrations/202605230001_developer_asset_pipeline.sql`
- Test: `tests/unit/developer-asset-store.test.ts`

- [ ] **Step 1: Write failing tests for row mapping and owner/dev guard-friendly payloads**

Create tests around pure mapping/summary helpers exported from `developerAssetStore.ts`, without requiring a live Supabase client.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/developer-asset-store.test.ts`
Expected: FAIL because the store module does not exist.

- [ ] **Step 3: Implement store helpers and API routes**

The store should return fallback default settings when Supabase is not configured, write owner settings when available, create developer submissions, submit votes, and update owner statuses. API routes must require trusted `dev` or `owner` access from server-side Clerk/private metadata helpers.

- [ ] **Step 4: Add Supabase migration**

Create tables for program settings, developer profiles, submissions, and votes. Add uniqueness for one vote per developer per submission and updated timestamp triggers.

- [ ] **Step 5: Run tests**

Run: `npm run test -- tests/unit/developer-asset-store.test.ts tests/unit/developer-assets.test.ts`
Expected: PASS.

### Task 3: Account and Owner UI

**Files:**
- Create: `src/features/developer-assets/components/DeveloperAssetHubPanel.tsx`
- Create: `src/features/developer-assets/components/OwnerDeveloperProgramPanel.tsx`
- Modify: `src/features/account/components/AccountProfilePage.tsx`
- Modify: `src/features/owner/components/OwnerConsolePage.tsx`

- [ ] **Step 1: Add developer hub panel**

The panel should load `/api/developer-assets`, show monthly progress, remaining submissions, source/status clarity, a submission form for metadata/preview URL, a submission list, and a peer voting queue.

- [ ] **Step 2: Add owner program panel**

The panel should load owner scope, edit roster/voting/publish-cap settings, show submissions, and allow owner status changes.

- [ ] **Step 3: Wire panels**

Render the developer panel on `/account` for development users and the owner panel on `/owner`.

### Task 4: Docs and Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/blueprint.md`
- Modify: `docs/release-checklist.md`

- [ ] **Step 1: Document the developer asset pipeline**

Add concise notes for defaults, local uploads, developer submissions, owner rules, and the Supabase migration.

- [ ] **Step 2: Run focused and full verification**

Run:
- `npm run test -- tests/unit/developer-assets.test.ts tests/unit/developer-asset-store.test.ts`
- `npm run lint`
- `npm run typecheck`

Expected: all exit 0, or any existing unrelated blocker is documented with command output.
