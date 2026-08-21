import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('unified account dashboard', () => {
  const accountPage = readSource('src/app/account/page.tsx');
  const dashboard = readSource('src/features/account/components/AccountProfilePage.tsx');
  const planManagement = readSource('src/features/account/components/AccountPlanManagementPanel.tsx');
  const developerStatus = readSource('src/features/account/components/AccountDeveloperStatusSection.tsx');
  const storageLibrary = readSource('src/features/storage-management/components/AccountStorageLibrary.tsx');

  it('organizes the account around overview, creator work, account controls, and conditional developer tools', () => {
    expect(dashboard).toContain('Overview');
    expect(dashboard).toContain('My CardForge');
    expect(dashboard).toContain('Plan & billing');
    expect(dashboard).toContain("showDeveloper ? (");
    expect(dashboard).toContain('Developer surfaces appear only for accounts that actually have contributor or owner access.');
  });

  it('composes storage inside the account dashboard instead of stacking standalone account pages', () => {
    expect(accountPage).toContain('storageLibrary={(');
    expect(accountPage).toContain('cloudStorageDetails={(');
    expect(accountPage).toContain('<AccountStorageLibrary');
    expect(accountPage).toContain('embedded');
    expect(storageLibrary).toContain("embedded ? undefined : 'mx-auto max-w-4xl px-4 pb-8 md:px-6'");
  });

  it('makes plan value and storage boundaries visible without implying automatic cloud upload', () => {
    expect(dashboard).toContain('private cloud set slot');
    expect(dashboard).toContain('Local-first by default');
    expect(dashboard).toContain('Device-only work is not automatically uploaded or exposed to ChatGPT.');
    expect(dashboard).toContain('Only sets you explicitly back up use your account cloud slots');
  });

  it('keeps plan comparison and Stripe-owned subscription actions together', () => {
    expect(accountPage).toContain('getMcpAllowances()');
    expect(accountPage).toContain('plans={plans}');
    expect(dashboard).toContain('Choose, start, or manage your plan');
    expect(dashboard).toContain('<AccountPlanManagementPanel');
    expect(planManagement).toContain('<PlanChoiceGrid');
    expect(planManagement).toContain('id="account-actions"');
    expect(planManagement).toContain('<AccountBillingActions');
    expect(dashboard).toContain('New subscriptions use Stripe Checkout');
    expect(planManagement).toContain('Selected: {intendedPlanLabel}');
    expect(accountPage).toContain('checkoutStatus={checkoutStatus}');
    expect(accountPage).toContain('initialPlanIntent={initialPlanIntent}');
  });

  it('supports both contributor and owner account destinations', () => {
    expect(developerStatus).toContain('Developer Program access');
    expect(developerStatus).toContain('/developer/cockpit');
    expect(developerStatus).toContain('/owner');
    expect(developerStatus).toContain('if (!isOwner && !isDeveloper) return null;');
  });

  it('uses native Next navigation when opening a local set from account storage', () => {
    expect(storageLibrary).toContain("import { useRouter } from 'next/navigation';");
    expect(storageLibrary).toContain("router.push('/studio')");
    expect(storageLibrary).not.toContain("window.location.assign('/studio')");
  });
});
