# Codespace Bottleneck Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make CardForge easier to develop, test, and trust by turning vague route stalls into measurable bottlenecks, then splitting heavy owner/developer/studio surfaces into fast first-paint shells with clear progressive loading.

**Architecture:** Add lightweight timing instrumentation around API routes, a reusable route-audit script for local/dev checks, and UI loading contracts that render meaningful shells before heavy data resolves. Then split the heaviest command surfaces so owner/developer/studio data loads by active section instead of one broad request where practical.

**Tech Stack:** Next.js 15 App Router, React 18, TypeScript, Playwright, Vitest, Clerk, Supabase, TailwindCSS.

---

## Current Bottleneck Map

- `/owner` can appear stuck on `Loading owner console...` during broad audits even though `/api/owner/console` usually responds in about 2-3 seconds in a focused probe.
- `/developer` signed-in pages pull settings, profiles, submissions, votes, queues, and caps together, which makes the page feel slower than the amount of visible content requires.
- `/studio` has a good real preview path, but the first skeleton can linger and make the app feel heavier than it is.
- Authenticated pages can trigger repeated entitlement/status calls while Clerk finishes loading.
- Existing tests verify behavior, but we need a repeatable local "site health pulse" that reports route readiness, stuck loaders, API timing, console warnings, and screenshots.

## File Structure

- Create `src/lib/serverTiming.ts`: server-side request timing helpers and `Server-Timing` header formatting.
- Modify `src/lib/apiResponses.ts`: allow API helpers to attach timing headers without changing every route manually.
- Modify `src/app/api/owner/console/route.ts`: add timing segments for owner access, settings/legal/roadmap/database metrics.
- Modify `src/app/api/developer-assets/route.ts`: add timing segments for settings, submissions, votes, registry summaries, and profile rules.
- Modify `src/features/owner/components/OwnerConsolePage.tsx`: replace blank loading with section skeletons, slow-load copy, and recoverable error state.
- Modify `src/features/developer-assets/components/DeveloperAssetHubPanel.tsx`: add summary-first layout, queue loading boundaries, and clearer status for delayed review data.
- Modify `src/features/account/hooks/useAccountEntitlement.ts`: prevent duplicate entitlement refreshes during Clerk handoff.
- Modify `src/features/app-shell/components/CardForgeStudioShell.tsx` and nearby studio shell components: make Studio readiness states explicit and testable.
- Create `scripts/audit-site-health.mjs`: Playwright local audit that signs in reusable QA accounts, captures route readiness, API timing, stuck loaders, console warnings, and screenshots.
- Create `tests/unit/server-timing.test.ts`: timing helper tests.
- Create or modify `tests/smoke/site-health.spec.ts`: route readiness smoke that fails on stuck loaders and unlabeled controls.
- Update `docs/development-guide.md`: add the new health-audit workflow.
- Update `docs/demo-capacity.md`: record current performance budgets and bottleneck expectations.

---

### Task 1: Add Server Timing Utilities

**Files:**
- Create: `src/lib/serverTiming.ts`
- Test: `tests/unit/server-timing.test.ts`

- [ ] **Step 1: Write the failing timing helper tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { createServerTimingTracker, formatServerTimingHeader } from '@/lib/serverTiming';

describe('server timing helpers', () => {
  it('formats safe Server-Timing header values', () => {
    expect(formatServerTimingHeader([
      { name: 'owner access', durationMs: 12.345 },
      { name: 'db.metrics', durationMs: 2 },
    ])).toBe('owner_access;dur=12.3, db.metrics;dur=2.0');
  });

  it('tracks async segments and keeps successful return values', async () => {
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(27);

    const timing = createServerTimingTracker();
    const result = await timing.track('ownerAccess', async () => 'ok');

    expect(result).toBe('ok');
    expect(timing.header()).toBe('ownerAccess;dur=17.0');
  });
});
```

- [ ] **Step 2: Run the failing test**

Run: `npm.cmd test -- --run tests/unit/server-timing.test.ts`

Expected: fail because `src/lib/serverTiming.ts` does not exist.

- [ ] **Step 3: Implement `src/lib/serverTiming.ts`**

```ts
export interface ServerTimingSegment {
  name: string;
  durationMs: number;
}

const normalizeTimingName = (name: string) => (
  name.trim().replace(/[^a-zA-Z0-9_.-]+/g, '_').slice(0, 64) || 'segment'
);

export function formatServerTimingHeader(segments: ServerTimingSegment[]): string {
  return segments
    .filter((segment) => Number.isFinite(segment.durationMs))
    .map((segment) => `${normalizeTimingName(segment.name)};dur=${Math.max(0, segment.durationMs).toFixed(1)}`)
    .join(', ');
}

export function createServerTimingTracker() {
  const segments: ServerTimingSegment[] = [];

  return {
    async track<T>(name: string, task: () => Promise<T>): Promise<T> {
      const startedAt = performance.now();
      try {
        return await task();
      } finally {
        segments.push({ name, durationMs: performance.now() - startedAt });
      }
    },
    add(name: string, durationMs: number) {
      segments.push({ name, durationMs });
    },
    segments() {
      return [...segments];
    },
    header() {
      return formatServerTimingHeader(segments);
    },
  };
}
```

- [ ] **Step 4: Run the timing tests**

Run: `npm.cmd test -- --run tests/unit/server-timing.test.ts`

Expected: pass.

---

### Task 2: Surface API Timing In Owner And Developer Routes

**Files:**
- Modify: `src/app/api/owner/console/route.ts`
- Modify: `src/app/api/developer-assets/route.ts`
- Modify only if needed: `src/lib/apiResponses.ts`

- [ ] **Step 1: Inspect existing response helpers**

Run: `rg "createApi|NextResponse|Response.json" src/app/api/owner/console src/app/api/developer-assets src/lib/apiResponses.ts -n`

Expected: identify the exact JSON response path for owner console and developer assets.

- [ ] **Step 2: Add timing tracker to owner console GET**

Implementation pattern:

```ts
const timing = createServerTimingTracker();
const ownerAccess = await timing.track('owner_access', () => getCurrentOwnerAccess());
const consolePayload = await timing.track('owner_payload', () => getOwnerConsolePayload());
const response = NextResponse.json({ ownerAccess, integrationStatus, console: consolePayload });
response.headers.set('Server-Timing', timing.header());
return response;
```

Use existing route function names and keep existing error handling intact.

- [ ] **Step 3: Add timing tracker to developer assets GET**

Implementation pattern:

```ts
const timing = createServerTimingTracker();
const access = await timing.track('access', () => getDeveloperAssetAccess());
const program = await timing.track('program_view', () => getDeveloperAssetProgramViewForAccess(access));
const response = NextResponse.json({ program });
response.headers.set('Server-Timing', timing.header());
return response;
```

Use the actual local helper names found in Step 1.

- [ ] **Step 4: Verify timing headers manually**

Run:

```powershell
Invoke-WebRequest -Uri 'http://localhost:9002/api/developer-assets' -UseBasicParsing
```

Expected: unauthenticated response may be `401`/`403`, but when authenticated smoke runs, captured responses include a `Server-Timing` header.

- [ ] **Step 5: Run core verification**

Run:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test -- --run tests/unit/developer-assets.test.ts tests/unit/developer-asset-store.test.ts
```

Expected: all pass.

---

### Task 3: Replace Blank Owner Console Loading With A Useful Shell

**Files:**
- Modify: `src/features/owner/components/OwnerConsolePage.tsx`

- [ ] **Step 1: Add a slow-load state**

Add state near `isLoading`:

```ts
const [isSlowLoad, setIsSlowLoad] = useState(false);
```

Inside the existing loading effect:

```ts
const slowLoadTimer = window.setTimeout(() => setIsSlowLoad(true), 2500);
...
window.clearTimeout(slowLoadTimer);
```

- [ ] **Step 2: Replace `Loading owner console...` with shell markup**

Use the existing owner page styling and show:

```tsx
<main className="min-h-screen bg-[#0c0b09] text-[#f7ead0]">
  <PublicSiteHeader currentPath="/owner" showOwnerLink title="Owner Forge" />
  <section className="mx-auto max-w-7xl px-4 py-8 md:px-6">
    <div className="border border-[#5f4526] bg-[#15100a] p-6">
      <p className="text-xs uppercase tracking-[0.18em] text-[#a98a55]">Owner Console</p>
      <h1 className="mt-3 font-serif text-3xl text-[#fff1c7]">Preparing command center</h1>
      <p className="mt-2 text-sm leading-6 text-[#c7b288]">
        Loading business settings, integration health, roadmap controls, developer rules, and legal drafts.
      </p>
      {isSlowLoad ? (
        <p className="mt-3 text-sm text-[#f0bd75]">
          This is taking longer than expected. The console should recover automatically; if it does not, refresh after the current request finishes.
        </p>
      ) : null}
    </div>
  </section>
</main>
```

- [ ] **Step 3: Add an error panel instead of only toast**

Add state:

```ts
const [loadError, setLoadError] = useState<string | null>(null);
```

In catch:

```ts
const message = error instanceof Error ? error.message : 'Unable to load owner console.';
setLoadError(message);
toast({ title: 'Owner console unavailable', description: message, variant: 'destructive' });
```

Render retry button when `loadError` exists.

- [ ] **Step 4: Verify owner route**

Run focused Playwright or browser check:

```powershell
npm.cmd run lint
npm.cmd run typecheck
```

Then sign in owner and navigate to `/owner`.

Expected: no blank loading screen; page either renders owner console or a useful slow-load shell within the first paint.

---

### Task 4: Add Local Site Health Audit Script

**Files:**
- Create: `scripts/audit-site-health.mjs`
- Modify: `package.json`
- Update: `docs/development-guide.md`

- [ ] **Step 1: Create `scripts/audit-site-health.mjs`**

The script should:

- load `.env.local`
- visit `/`, `/studio`, `/roadmap`, `/developer`, `/account`, `/owner`
- use reusable QA emails when present
- capture status, route time, stuck loader text, console warnings/errors, request failures, and screenshot path
- write JSON to `test-results/site-health/summary.json`
- exit non-zero only for hard failures: route crash, stuck owner loading after 30 seconds, unlabeled visible controls, or horizontal overflow

- [ ] **Step 2: Add package script**

In `package.json`:

```json
"audit:site": "node scripts/audit-site-health.mjs"
```

- [ ] **Step 3: Document the workflow**

Add to `docs/development-guide.md`:

```md
### Local Site Health Audit

Run `npm.cmd run audit:site` while the local dev server is active on `http://localhost:9002`.
The audit checks public, studio, account, developer, and owner routes, captures screenshots, and reports stuck loaders, horizontal overflow, console errors, request failures, and rough route timings.
Use this before large UI/pipeline handoffs and after changing auth, owner, developer, or studio shell loading behavior.
```

- [ ] **Step 4: Verify**

Run:

```powershell
npm.cmd run audit:site
```

Expected: writes `test-results/site-health/summary.json` and screenshots.

---

### Task 5: Reduce Duplicate Entitlement And Billing Calls

**Files:**
- Modify: `src/features/account/hooks/useAccountEntitlement.ts`
- Modify if needed: `src/features/account/components/AccountProfilePage.tsx`
- Modify if needed: `src/features/developer-assets/components/DeveloperProgramPage.tsx`
- Test: existing account entitlement tests or new hook-adjacent test if available

- [ ] **Step 1: Inspect hook behavior**

Run: `Get-Content -LiteralPath 'src\features\account\hooks\useAccountEntitlement.ts'`

Find where entitlement fetches happen during Clerk load and route navigation.

- [ ] **Step 2: Add in-flight request protection**

Implementation pattern:

```ts
const inFlightRefreshRef = useRef<Promise<void> | null>(null);

const refreshEntitlement = useCallback(() => {
  if (inFlightRefreshRef.current) return inFlightRefreshRef.current;

  const refresh = (async () => {
    try {
      const response = await fetch('/api/account/entitlement', { cache: 'no-store' });
      ...
    } finally {
      inFlightRefreshRef.current = null;
    }
  })();

  inFlightRefreshRef.current = refresh;
  return refresh;
}, []);
```

Keep the existing public API shape stable.

- [ ] **Step 3: Verify signed-in account/dev surfaces**

Run:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run audit:site
```

Expected: fewer repeated `/api/account/entitlement` calls in the audit output, same visible account behavior.

---

### Task 6: Split Heavy Developer Hub Perceived Load

**Files:**
- Modify: `src/features/developer-assets/components/DeveloperAssetHubPanel.tsx`
- Modify later if needed: `src/app/api/developer-assets/route.ts`

- [ ] **Step 1: Add section-level loading states**

Keep the initial read for correctness, but render the summary metrics as soon as `program` exists and make the review queue/archive panels independently skeletonized.

Use copy:

```tsx
<p className="text-sm text-[#c7b288]">
  Loading review rows and vote state. Summary rules are ready.
</p>
```

- [ ] **Step 2: Add a queue-size warning**

When queue rows exceed 100:

```tsx
<p className="text-xs text-[#f0bd75]">
  Large review queue detected. Use filters before expanding previews.
</p>
```

- [ ] **Step 3: Future API split decision**

If timing shows `/api/developer-assets` regularly exceeds 3 seconds, split into:

- `/api/developer-assets/summary`
- `/api/developer-assets/submissions?status=&type=&page=&pageSize=`
- `/api/developer-assets/program-settings`

Do not split until timing data proves the current route is the bottleneck.

- [ ] **Step 4: Verify**

Run signed-in developer and owner audit.

Expected: Developer Hub feels useful before every queue row is fully inspected.

---

### Task 7: Make Studio Readiness Testable

**Files:**
- Modify: `src/features/app-shell/components/CardForgeStudioShell.tsx`
- Modify nearby studio shell/loading component if readiness lives elsewhere
- Modify: `tests/smoke/studio.spec.ts` or create `tests/smoke/site-health.spec.ts`

- [ ] **Step 1: Add stable readiness marker**

Once templates/assets/store hydration are complete, render:

```tsx
<div data-testid="studio-ready" className="sr-only">Studio ready</div>
```

While loading, render:

```tsx
<div data-testid="studio-loading">Preparing studio</div>
```

- [ ] **Step 2: Add smoke assertion**

```ts
test('studio reaches ready state without getting stuck in skeleton', async ({ page }) => {
  await page.goto('/studio', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(page.getByTestId('studio-ready')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('PREPARING STUDIO')).toHaveCount(0);
});
```

- [ ] **Step 3: Verify**

Run:

```powershell
npm.cmd run smoke -- --grep "studio reaches ready"
```

Expected: pass.

---

### Task 8: Document Performance Budgets And Operating Rules

**Files:**
- Update: `docs/demo-capacity.md`
- Update: `docs/development-guide.md`
- Update if needed: `docs/release-checklist.md`

- [ ] **Step 1: Add route readiness budgets**

Use:

```md
## Local Route Readiness Budgets

- Public landing/account/roadmap: first usable content within 3 seconds locally.
- Studio shell: visible first-run guide immediately, editor ready marker within 30 seconds.
- Developer Hub: summary visible within 5 seconds, queue rows within 10 seconds for demo data.
- Owner Console: useful loading shell immediately, command content within 10 seconds for demo data.
```

- [ ] **Step 2: Add release checklist item**

Use:

```md
- [ ] Run `npm.cmd run audit:site` and confirm no stuck loaders, unlabeled visible controls, horizontal overflow, or unexpected request failures.
```

- [ ] **Step 3: Verify docs are linked**

Run: `rg "audit:site|Route Readiness|site health" README.md docs -n`

Expected: workflow is discoverable from docs.

---

## Execution Order

1. Task 1: Timing utilities.
2. Task 2: Owner/developer timing headers.
3. Task 3: Owner console loading shell.
4. Task 4: Site health audit script.
5. Task 5: Entitlement call dedupe.
6. Task 7: Studio readiness marker.
7. Task 6: Developer perceived-load polish.
8. Task 8: Docs and release checklist.

This order gives us measurement first, fixes the scariest perceived stall second, then adds reusable testing so future UI work cannot quietly regress.

## Completion Definition

The codespace enhancement is complete when:

- `npm.cmd run lint` passes.
- `npm.cmd run typecheck` passes.
- `npm.cmd test` passes for timing/developer/account affected tests.
- `npm.cmd run audit:site` produces a summary with no stuck loaders or horizontal overflow.
- Owner console shows useful shell content immediately and real content after the owner API resolves.
- Developer Hub makes rules/summary understandable before queue-heavy content dominates perception.
- Studio has a stable `studio-ready` marker for automation.
- Docs explain how future agents should run the site health audit.
