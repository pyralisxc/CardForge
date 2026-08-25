import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('unified account dashboard', () => {
  const accountPage = readSource('src/app/account/page.tsx');
  const dashboard = readSource('src/features/account/components/AccountProfilePage.tsx');
  const accountUtilities = readSource('src/features/account/components/AccountUtilityPanel.tsx');
  const mobileNavigation = readSource('src/features/account/components/AccountMobileNavigation.tsx');
  const planManagement = readSource('src/features/account/components/AccountPlanManagementPanel.tsx');
  const planChoiceGrid = readSource('src/features/mcp-usage/components/PlanChoiceGrid.tsx');
  const developerStatus = readSource('src/features/account/components/AccountDeveloperStatusSection.tsx');
  const profileManagement = readSource('src/features/account/components/ProfileManagementPage.tsx');
  const profileRoute = readSource('src/app/profile/page.tsx');
  const storageWorkspace = readSource('src/features/storage-management/components/AccountStorageWorkspace.tsx');
  const accountLibrary = readSource('src/features/storage-management/components/UnifiedAccountLibrary.tsx');
  const accountLibraryProjection = readSource('src/features/storage-management/hooks/useAccountLibraryProjection.ts');
  const accountLibraryRow = readSource('src/features/storage-management/components/AccountLibraryItemRow.tsx');
  const storageLibrary = readSource('src/features/storage-management/components/AccountStorageLibrary.tsx');

  it('keeps the library as one part of the wider account control center', () => {
    expect(dashboard).toContain('<AccountWorkspaceHeader');
    expect(dashboard).toContain('<AccountUtilityPanel');
    expect(accountLibrary).toContain('Your CardForge home');
    expect(accountLibrary).toContain('<EnvironmentShell');
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
    expect(dashboard).toContain("activeSection === 'profile'");
    expect(dashboard).not.toContain('DashboardNav');
    expect(dashboard).not.toContain('AccountShortcut');
    expect(dashboard).not.toContain("href: '#library'");
    expect(dashboard).not.toContain('id="storage-and-connections"');
  });

  it('gives phone users persistent labeled destinations without duplicating the desktop header', () => {
    expect(dashboard).toContain('<AccountMobileNavigation');
    expect(mobileNavigation).toContain('Home');
    expect(mobileNavigation).toContain('Library');
    expect(mobileNavigation).toContain('Storage');
    expect(mobileNavigation).toContain('Profile');
    expect(mobileNavigation).toContain('More');
    expect(mobileNavigation).toContain('sm:hidden');
  });

  it('recomposes dense account content instead of clipping desktop layouts on phones', () => {
    expect(planChoiceGrid).toContain('md:grid-cols-2');
    expect(planChoiceGrid).toContain('xl:grid-cols-4');
    expect(planChoiceGrid).not.toContain('grid-flow-col');
    expect(planChoiceGrid).not.toContain('overflow-x-auto');
    expect(accountLibraryRow).toContain('md:hidden');
    expect(accountLibraryRow).toContain("grid-cols-[minmax(0,1fr)_auto]");
    expect(accountPage).toContain('<LocalProjectFolderPanel\n                embedded');
    expect(accountPage).toContain('<GoogleDriveProjectStoragePanel\n                embedded');
    expect(accountPage).toContain('<ConnectedPersonalLibraryPanel\n                embedded');
  });

  it('separates the unified content library from provider and location management', () => {
    expect(accountPage).toContain('library={(');
    expect(accountPage).toContain('storageManagement={(');
    expect(accountPage).toContain('<UnifiedAccountLibrary');
    expect(accountPage).toContain("view={activeSection === 'home' || activeSection === 'developer' ? 'home' : 'library'}");
    expect(accountPage).toContain('<AccountStorageWorkspace');
    expect(storageWorkspace).toContain('<details');
    expect(storageWorkspace).toContain('Storage locations');
    expect(accountLibraryProjection).toContain('buildAccountLibraryItems');
    expect(accountLibrary).toContain('useAccountLibraryProjection');
    expect(accountLibrary).toContain('Storage remains with the source named on each item.');
  });

  it('makes plan value and storage boundaries visible without implying automatic cloud upload', () => {
    expect(dashboard).toContain('private cloud set slot');
    expect(accountLibrary).toContain('Current work');
    expect(accountLibrary).toContain('More work');
    expect(dashboard).toContain('Storage & connections');
    expect(storageWorkspace).toContain('CardForge Cloud space');
  });

  it('uses a compact home command band and one account status snapshot', () => {
    expect(accountLibrary).toContain('Account snapshot');
    expect(accountLibrary).toContain('homeAccessStatus');
    expect(accountLibrary).toContain('Connections');
    expect(accountLibraryRow).toContain('border-y border-[var(--cf-border)]');
    expect(accountLibraryRow).not.toContain('grid-cols-[3.5rem_minmax(0,1fr)]');
  });

  it('keeps library controls in one responsive toolbar', () => {
    expect(accountLibrary).toContain('Filter by source');
    expect(accountLibrary).toContain('Filter by type');
    expect(accountLibrary).toContain('Sort library');
    expect(accountLibrary).not.toContain('aria-label="Library sources"');
    expect(accountLibrary).not.toContain('cardforge-horizontal-strip');
  });

  it('presents storage measurements and records as flat information rows', () => {
    expect(storageLibrary).toContain('function StorageMetric');
    expect(storageLibrary).not.toContain('function StorageSummaryCard');
    expect(storageLibrary).not.toContain('space-y-2');
  });

  it('keeps plan comparison and Stripe-owned subscription actions together', () => {
    expect(accountPage).toContain('getMcpAllowances()');
    expect(accountPage).toContain('plans={plans}');
    expect(dashboard).toContain('Manage access, billing, and usage');
    expect(dashboard).toContain('<AccountPlanManagementPanel');
    expect(planManagement).toContain('<PlanChoiceGrid');
    expect(planManagement).toContain('<details');
    expect(planManagement).toContain('Compare available plans');
    expect(planManagement).toContain('id="account-actions"');
    expect(planManagement).toContain('<AccountBillingActions');
    expect(dashboard).toContain('Stripe continues to own checkout, invoices, payment details, plan changes, and cancellation.');
    expect(planManagement).toContain('Selected: {intendedPlanLabel}');
    expect(accountPage).toContain('checkoutStatus={checkoutStatus}');
    expect(accountPage).toContain('initialPlanIntent={initialPlanIntent}');
  });

  it('keeps provider-native profile controls inside the account workspace', () => {
    expect(accountUtilities).toContain('href="/account?section=profile"');
    expect(profileManagement).toContain('<UserProfile');
    expect(profileManagement).not.toContain('elements:');
    expect(profileManagement).not.toContain('ProfileShell');
    expect(profileRoute).toContain("redirect('/account?section=profile')");
    expect(profileRoute).not.toContain('<PublicSiteHeader');
  });

  it('supports both contributor and owner account destinations', () => {
    expect(developerStatus).toContain('Developer Program access');
    expect(developerStatus).toContain('/developer/cockpit');
    expect(developerStatus).toContain('/owner');
    expect(developerStatus).toContain('if (!isOwner && !isDeveloper) return null;');
    expect(developerStatus).toContain('divide-y');
  });

  it('uses native Next navigation when opening work from the account library', () => {
    expect(accountLibraryProjection).toContain("import { useRouter } from 'next/navigation';");
    expect(accountLibraryProjection).toContain("router.push('/studio')");
    expect(accountLibraryProjection).not.toContain("window.location.assign('/studio')");
  });
});
