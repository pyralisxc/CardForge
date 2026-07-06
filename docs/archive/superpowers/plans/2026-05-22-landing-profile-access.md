# Landing Profile Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved soft-gated landing, studio, and account/profile surfaces for CardForge.

**Architecture:** Move the existing workspace into a reusable client shell consumed by `/studio`. Replace `/` with a public fantasy landing page that uses a generated CardForge hero asset. Add `/account` as a client profile/tools surface backed by existing entitlement logic and a safe billing-status API.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind/shadcn primitives, Clerk client controls, existing CardForge entitlement/billing helpers, Playwright smoke tests.

---

### Task 1: Preserve Current Workspace Under `/studio`

**Files:**
- Create: `src/features/app-shell/components/CardForgeStudioShell.tsx`
- Create: `src/app/studio/page.tsx`
- Modify: `src/app/page.tsx`

- [ ] Copy the current workspace implementation from `src/app/page.tsx` into `CardForgeStudioShell`.
- [ ] Export `CardForgeStudioShell` as a client component.
- [ ] Create `/studio` page that renders `CardForgeStudioShell`.
- [ ] Replace `/` with a landing page in Task 3.

### Task 2: Add Safe Account/Billing Status Support

**Files:**
- Create: `src/app/api/billing/status/route.ts`
- Test: `tests/unit/billing.test.ts`

- [ ] Add a safe `GET /api/billing/status` route using `getBillingConfigStatus`.
- [ ] Return `checkoutConfigured` and `missing`, but never secret values.
- [ ] Keep the response no-store.
- [ ] Add unit coverage for config status if needed.

### Task 3: Build Landing Page

**Files:**
- Modify: `src/app/page.tsx`
- Add asset under: `public/card-assets/landing/`

- [ ] Generate one production hero image with the Image Gen tool: fantasy card-forge workbench, ornate cards, premium frame texture, no embedded UI text.
- [ ] Save the chosen asset in `public/card-assets/landing/`.
- [ ] Implement landing page with CardForge fantasy styling, CTAs to `/studio` and `/account`, and sections for maker/generator, bulk data, premium assets, and export unlocks.
- [ ] Keep first screen useful and not corporate.

### Task 4: Build Account/Profile Page

**Files:**
- Create: `src/app/account/page.tsx`
- Create: `src/features/account/components/AccountProfilePage.tsx`

- [ ] Use `useAccountEntitlement` to show current access mode, auth state, sign-in state, export status, and entitlement source.
- [ ] Reuse Clerk sign-in/create-account/user controls through `AccountControls` or a small account-page variant.
- [ ] Add checkout CTA for non-export-enabled signed-in users.
- [ ] Add dev-only tools/status section when `capabilities.canWriteShippedLibrary` is true.
- [ ] Include Studio and Landing navigation.

### Task 5: Update Navigation and Tests

**Files:**
- Modify: `src/components/card-forge/Header.tsx`
- Modify: `tests/smoke/card-forge.spec.ts`
- Modify: docs if route expectations changed.

- [ ] Add header links for Landing, Studio, and Account.
- [ ] Update smoke tests to open `/studio` for workspace workflows.
- [ ] Add smoke coverage that `/` renders landing CTA and `/account` renders profile state.
- [ ] Run lint, typecheck, unit tests, build, and smoke.

### Self-Review

- Spec coverage: routes, soft gating, account/dev tools, safe billing status, and verification are covered.
- Placeholder scan: no placeholder implementation requirements remain.
- Type consistency: uses existing `AccountEntitlement`, `ProjectCapabilities`, and `BillingConfigStatus` names.
