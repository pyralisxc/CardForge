import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('unified account dashboard', () => {
  const accountPage = readSource('src/app/account/page.tsx');
  const dashboard = readSource('src/features/account/components/AccountProfilePage.tsx');
  const accountUtilities = readSource('src/features/account/components/AccountUtilityPanel.tsx');
  const planManagement = readSource('src/features/account/components/AccountPlanManagementPanel.tsx');
  const developerStatus = readSource('src/features/account/components/AccountDeveloperStatusSection.tsx');
  const accountLibrary = readSource('src/features/storage-management/components/UnifiedAccountLibrary.tsx');

  it('keeps the library as one part of the wider account control center', () => {
    expect(dashboard).toContain('<AccountWorkspaceHeader');
    expect(dashboard).toContain('<AccountUtilityPanel');
    expect(dashboard).toContain('Good to see you');
    expect(dashboard).toContain('Plan & billing');
    expect(dashboard).toContain('Developer surfaces appear only for accounts that actually have contributor or owner access.');
  });

  it('behaves like an account app instead of one anchored document', () => {
    expect(accountPage).toContain('resolveAccountSection');
    expect(accountPage).toContain('activeSection={activeSection}');
    expect(dashboard).toContain("activeSection === 'home'");
    expect(dashboard).toContain("activeSection === 'library'");
    expect(dashboard).toContain("activeSection === 'storage'");
    expect(dashboard).toContain("activeSection === 'billing'");
    expect(dashboard).not.toContain('DashboardNav');
    expect(dashboard).not.toContain('AccountShortcut');
    expect(dashboard).not.toContain("href: '#library'");
    expect(dashboard).not.toContain('id="storage-and-connections"');
  });

  it('separates the unified content library from provider and location management', () => {
    expect(accountPage).toContain('library={(');
    expect(accountPage).toContain('storageManagement={(');
    expect(accountPage).toContain('<UnifiedAccountLibrary');
    expect(accountPage).toContain("view={activeSection === 'home' || activeSection === 'developer' ? 'home' : 'library'}");
    expect(accountPage).toContain('<AccountStorageLibrary');
    expect(accountPage).toContain('embedded');
    expect(accountLibrary).toContain('buildAccountLibraryItems');
    expect(accountLibrary).toContain('Storage remains with the source named on each item.');
  });

  it('makes plan value and storage boundaries visible without implying automatic cloud upload', () => {
    expect(dashboard).toContain('private cloud set slot');
    expect(accountLibrary).toContain('Continue where you left off');
    expect(accountLibrary).toContain('Recent work');
    expect(dashboard).toContain('Storage & connections');
    expect(accountUtilities).toContain('CardForge Cloud');
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

  it('uses native Next navigation when opening work from the account library', () => {
    expect(accountLibrary).toContain("import { useRouter } from 'next/navigation';");
    expect(accountLibrary).toContain("router.push('/studio')");
    expect(accountLibrary).not.toContain("window.location.assign('/studio')");
  });
});
