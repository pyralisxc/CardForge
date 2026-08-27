import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('unified account environment', () => {
  const accountPage = readSource('src/app/account/page.tsx');
  const homeBoundary = readSource('src/features/account/components/AccountHomeBoundary.tsx');
  const environmentNavigation = readSource('src/features/app-shell/environment/components/EnvironmentNavigation.tsx');
  const planManagement = readSource('src/features/account/components/AccountPlanManagementPanel.tsx');
  const planBillingUtility = readSource('src/features/account/components/AccountPlanBillingUtility.tsx');
  const planChoiceGrid = readSource('src/features/mcp-usage/components/PlanChoiceGrid.tsx');
  const profileEnvironment = readSource('src/app/account/_components/AccountProfileEnvironment.tsx');
  const profileManagement = readSource('src/features/account/components/ProfileManagementPage.tsx');
  const profileRoute = readSource('src/app/profile/page.tsx');
  const storageWorkspace = readSource('src/features/storage-management/components/AccountStorageWorkspace.tsx');
  const accountLibrary = readSource('src/features/storage-management/components/UnifiedAccountLibrary.tsx');
  const accountLibraryProjection = readSource('src/features/storage-management/hooks/useAccountLibraryProjection.ts');
  const accountLibraryRow = readSource('src/features/storage-management/components/AccountLibraryItemRow.tsx');
  const storageLibrary = readSource('src/features/storage-management/components/AccountStorageLibrary.tsx');

  it('makes Home, Library, and Profile direct zones instead of nested account pages', () => {
    expect(accountPage).toContain('<AccountHomeBoundary');
    expect(accountLibrary).toContain('Your CardForge home');
    expect(accountLibrary).toContain('<EnvironmentShell');
    expect(accountPage).toContain("activeSection === 'library' || activeSection === 'storage'");
    expect(accountPage).toContain("activeSection === 'profile' || activeSection === 'billing'");
    expect(accountPage).toContain('view="library"');
    expect(profileEnvironment).toContain('<EnvironmentShell');
    expect(homeBoundary).not.toContain('<AccountWorkspaceHeader');
  });

  it('keeps one responsive Environment navigation owner', () => {
    expect(environmentNavigation).toContain('EnvironmentNavigation');
    expect(environmentNavigation).toContain('zone.label');
    expect(environmentNavigation).toContain('zone.shortLabel');
    expect(environmentNavigation).toContain('styles.mobileNav');
    expect(homeBoundary).not.toContain('AccountMobileNavigation');
    expect(profileEnvironment).not.toContain('AccountUtilityPanel');
  });

  it('recomposes dense account content without horizontal card strips', () => {
    expect(planChoiceGrid).toContain('md:grid-cols-2');
    expect(planChoiceGrid).toContain('xl:grid-cols-4');
    expect(planChoiceGrid).not.toContain('grid-flow-col');
    expect(planChoiceGrid).not.toContain('overflow-x-auto');
    expect(accountLibraryRow).toContain('md:hidden');
    expect(accountPage).toContain('<LocalProjectFolderPanel');
    expect(accountPage).toContain('<GoogleDriveProjectStoragePanel');
    expect(accountPage).toContain('<ConnectedPersonalLibraryPanel');
  });

  it('keeps inventory separate from Library-owned location tools', () => {
    expect(accountPage).toContain('<UnifiedAccountLibrary');
    expect(accountPage).toContain('view="library"');
    expect(accountPage).toContain('view="home"');
    expect(accountPage).toContain('<LibraryStorageConnectionsTool');
    expect(accountPage).toContain("initialTool={activeSection === 'storage' ? 'locations' : null}");
    expect(storageWorkspace).toContain('<CompactSettingRow');
    expect(storageWorkspace).toContain('aria-label="Storage and connections"');
    expect(accountLibrary).toContain("activeTool === 'locations'");
    expect(accountLibraryProjection).toContain('buildAccountLibraryItems');
  });

  it('runs the live Library as a compact ledger with exact detail actions', () => {
    expect(accountLibrary).toContain('activeZone="library"');
    expect(accountLibrary).toContain('<CollectionLedgerRow');
    expect(accountLibrary).toContain('getAccountLibraryEnvironmentActions');
    expect(accountLibrary).toContain("action.id === 'library.view-source'");
    expect(accountLibrary).toContain("action.id === 'library.manage-location'");
    expect(accountLibrary).toContain('projection.failures.map');
    expect(accountLibrary).not.toContain('<AccountLibraryItemRow');
  });

  it('keeps account status and storage measurement semantics compact', () => {
    expect(accountLibrary).toContain('Account snapshot');
    expect(accountLibrary).toContain('homeAccessStatus');
    expect(accountLibrary).toContain('Connections');
    expect(accountLibraryRow).toContain('border-y border-[var(--cf-border)]');
    expect(storageLibrary).toContain('function StorageMetric');
    expect(storageLibrary).not.toContain('function StorageSummaryCard');
    expect(storageWorkspace).toContain('Owners & locations');
    expect(storageWorkspace).toContain('Temporary workspace');
    expect(storageWorkspace).not.toContain('Cloud space breakdown');
  });

  it('keeps Library search, filters, sorting, and refresh together', () => {
    expect(accountLibrary).toContain('Filter by source');
    expect(accountLibrary).toContain('Filter by type');
    expect(accountLibrary).toContain('Sort library');
    expect(accountLibrary).toContain('Refresh');
    expect(accountLibrary).not.toContain('cardforge-horizontal-strip');
  });

  it('keeps Stripe-owned billing inside the focused Profile utility', () => {
    expect(accountPage).toContain('getMcpAllowances()');
    expect(accountPage).toContain('plans={plans}');
    expect(accountPage).toContain("initialUtility={activeSection === 'billing' ? 'billing' : params.utility === 'identity' ? 'identity' : null}");
    expect(profileEnvironment).toContain('Manage access, billing, and usage');
    expect(profileEnvironment).toContain('<AccountPlanBillingUtility');
    expect(planBillingUtility).toContain('<AccountPlanManagementPanel');
    expect(planManagement).toContain('<PlanChoiceGrid');
    expect(planManagement).toContain('<AccountBillingActions');
    expect(profileEnvironment).toContain('Stripe continues to own checkout, invoices, payment details, plan changes, and cancellation.');
    expect(accountPage).toContain('checkoutStatus={checkoutStatus}');
    expect(accountPage).toContain('initialPlanIntent={initialPlanIntent}');
  });

  it('keeps native Clerk controls progressive inside Profile', () => {
    expect(accountPage).toContain('<AccountProfileEnvironment');
    expect(profileEnvironment).toContain('activeZone="profile"');
    expect(profileEnvironment).toContain("activeUtility === 'identity'");
    expect(profileEnvironment).toContain('<ProfileManagementPage authConfigured={entitlement.authConfigured} />');
    expect(profileManagement).toContain('<UserProfile');
    expect(profileManagement).not.toContain('elements:');
    expect(profileRoute).toContain("redirect('/account?section=profile')");
  });

  it('routes protected account entries to their real zones', () => {
    expect(profileEnvironment).toContain("router.push('/developer/cockpit')");
    expect(profileEnvironment).toContain("router.push('/owner')");
    expect(accountPage).toContain("redirect('/developer/cockpit')");
  });

  it('uses native Next navigation when opening Library work', () => {
    expect(accountLibraryProjection).toContain("import { useRouter } from 'next/navigation';");
    expect(accountLibraryProjection).toContain("router.push('/studio')");
    expect(accountLibraryProjection).not.toContain("window.location.assign('/studio')");
  });
});
