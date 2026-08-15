import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const rootPath = (...parts: string[]) => path.join(process.cwd(), ...parts);

const pathExists = async (...parts: string[]) => {
  try {
    await access(rootPath(...parts));
    return true;
  } catch {
    return false;
  }
};

describe('Owner Console composition', () => {
  it('splits the console into focused client state and panels', async () => {
    const requiredPaths = [
      ['src', 'features', 'owner', 'hooks', 'useOwnerConsole.ts'],
      ['src', 'features', 'owner', 'components', 'OwnerReadinessPanel.tsx'],
      ['src', 'features', 'owner', 'components', 'OwnerPeoplePanel.tsx'],
      ['src', 'features', 'owner', 'components', 'OwnerInboxPanel.tsx'],
      ['src', 'features', 'owner', 'components', 'OwnerSiteConfigurationPanel.tsx'],
      ['src', 'features', 'owner', 'components', 'OwnerProductionPanel.tsx'],
      ['src', 'features', 'owner', 'components', 'OwnerGovernancePanels.tsx'],
      ['src', 'features', 'owner', 'components', 'OwnerPublicContentPanel.tsx'],
      ['src', 'features', 'owner', 'components', 'OwnerSiteMediaPanel.tsx'],
      ['src', 'features', 'owner', 'components', 'OwnerLegalPanel.tsx'],
      ['src', 'features', 'analytics', 'components', 'OwnerAnalyticsPanel.tsx'],
      ['src', 'features', 'experience-settings', 'components', 'OwnerExperienceControlsPanel.tsx'],
      ['src', 'features', 'developer-assets', 'components', 'OwnerAssetLibraryPanel.tsx'],
    ];
    await Promise.all(requiredPaths.map(async (parts) => {
      await expect(pathExists(...parts), parts.join('/')).resolves.toBe(true);
    }));
    await expect(pathExists('src', 'features', 'owner', 'components', 'OwnerAccessPanel.tsx')).resolves.toBe(false);
  });

  it('composes site controls without taking ownership from experience settings', async () => {
    const page = await readFile(rootPath('src/features/owner/components/OwnerConsolePage.tsx'), 'utf8');
    const model = await readFile(rootPath('src/features/owner/lib/ownerConsole.ts'), 'utf8');
    const panel = await readFile(
      rootPath('src/features/experience-settings/components/OwnerExperienceControlsPanel.tsx'),
      'utf8',
    );

    expect(page).toContain("@/features/experience-settings/client/owner");
    expect(page).toContain('>Site Controls</TabsTrigger>');
    expect(page).toContain('>Experience &amp; Access</TabsTrigger>');
    expect(model).toContain('experienceSettings: ExperienceSettings');
    expect(panel).not.toContain('@/features/owner');
    expect(panel).toContain('/api/owner/experience-settings');
  });

  it('composes analytics as an owner-only workspace without taking over measurement ownership', async () => {
    const page = await readFile(rootPath('src/features/owner/components/OwnerConsolePage.tsx'), 'utf8');
    const analyticsPanel = await readFile(rootPath('src/features/analytics/components/OwnerAnalyticsPanel.tsx'), 'utf8');
    const analyticsHook = await readFile(rootPath('src/features/analytics/hooks/useOwnerAnalytics.ts'), 'utf8');

    expect(page).toContain("@/features/analytics/client/owner");
    expect(page).toContain('>Analytics</TabsTrigger>');
    expect(analyticsHook).toContain('/api/owner/analytics');
    expect(analyticsPanel).not.toContain('CARDFORGE_GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
  });

  it('gives all public images one dedicated responsive owner workspace', async () => {
    const page = await readFile(rootPath('src/features/owner/components/OwnerConsolePage.tsx'), 'utf8');
    const copy = await readFile(rootPath('src/features/owner/components/OwnerPublicContentPanel.tsx'), 'utf8');
    const founder = await readFile(rootPath('src/features/owner/components/OwnerFounderProfilePanel.tsx'), 'utf8');

    expect(page).toContain('OwnerSiteMediaPanel');
    expect(page).toContain('>Media</TabsTrigger>');
    expect(copy).not.toContain('OwnerHomepageMediaPanel');
    expect(founder).not.toContain('Upload portrait');
  });

  it('keeps the page as a loading, navigation, and panel coordinator', async () => {
    const source = await readFile(rootPath('src/features/owner/components/OwnerConsolePage.tsx'), 'utf8');
    expect(source).not.toContain('@/features/app-shell');
    expect(source).toContain('dynamic(');
  });

  it('keeps the owner pipeline complete, filterable, and paged in a focused component', async () => {
    const parent = await readFile(rootPath('src/features/developer-assets/components/OwnerDeveloperProgramPanel.tsx'), 'utf8');
    const library = await readFile(rootPath('src/features/developer-assets/components/OwnerAssetLibraryPanel.tsx'), 'utf8');

    expect(parent).toContain('<OwnerAssetLibraryPanel');
    expect(parent).not.toContain('.slice(0, 12)');
    expect(library).toContain('program.submissionPage');
    expect(library).toContain('Asset type');
    expect(library).toContain('Pipeline status');
    expect(library).toContain('Search library');
    expect(library).toContain('Previous');
    expect(library).toContain('Next');
    expect(library).toContain('Delete permanently');
    expect(library).toContain('Retire');
  });

  it('splits owner integration and database operations from payload composition', async () => {
    await expect(pathExists('src/features/owner/server/ownerIntegrationStatus.ts')).resolves.toBe(true);
    await expect(pathExists('src/features/owner/server/ownerDatabaseMetrics.ts')).resolves.toBe(true);
    const store = await readFile(rootPath('src/features/owner/lib/ownerConsoleStore.ts'), 'utf8');
    expect(store).not.toContain('DatabaseMetricsRow');
    expect(store).not.toContain('getPublicAppUrl');
    expect(store).toContain("getBusinessIdentity");
    expect(store).not.toContain('getSiteOperatorSettings');
  });

  it('composes the business-identity-owned editor without reclaiming its domain', async () => {
    const ownerModel = await readFile(rootPath('src/features/owner/lib/ownerConsole.ts'), 'utf8');
    const readiness = await readFile(rootPath('src/features/owner/components/OwnerReadinessPanel.tsx'), 'utf8');
    const businessClient = await readFile(rootPath('src/features/business-identity/client.ts'), 'utf8');
    const businessPanel = await readFile(
      rootPath('src/features/business-identity/components/OwnerBusinessIdentityPanel.tsx'),
      'utf8',
    );

    expect(ownerModel).toContain('businessIdentity: BusinessIdentity');
    expect(ownerModel).not.toContain('settings: SiteOperatorSettings');
    expect(readiness).toContain("from '@/features/business-identity/client'");
    expect(readiness).toContain('<OwnerBusinessIdentityPanel');
    expect(businessClient).toContain("from './components/OwnerBusinessIdentityPanel'");
    expect(businessPanel).not.toContain('@/features/owner');
    expect(businessPanel).toContain('expectedIdentityVersion');
    expect(businessPanel).not.toContain('identityVersion: draft');
  });

  it('keeps the one shared public-site header in App composition', async () => {
    for (const featurePath of [
      'src/features/owner/components/OwnerConsolePage.tsx',
      'src/features/developer-program/components/DeveloperProgramPage.tsx',
      'src/features/roadmap/components/RoadmapPage.tsx',
    ]) {
      const source = await readFile(rootPath(featurePath), 'utf8');
      expect(source, featurePath).not.toContain('@/features/app-shell');
    }
    const ownerPage = await readFile(rootPath('src/app/owner/page.tsx'), 'utf8');
    expect(ownerPage).toContain('@/features/public-site/client/shell');
    expect(ownerPage).toContain('<PublicSiteHeader');
    expect(ownerPage).not.toContain('StudioHeader');

    for (const appPath of [
      'src/app/developer/page.tsx',
      'src/app/roadmap/page.tsx',
    ]) {
      const source = await readFile(rootPath(appPath), 'utf8');
      expect(source, appPath).toContain('@/features/public-site/server');
      expect(source, appPath).toContain('<ConfiguredPublicSiteShell');
    }
  });
});
