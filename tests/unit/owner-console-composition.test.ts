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
      ['src', 'features', 'owner', 'components', 'OwnerOperationsPanel.tsx'],
      ['src', 'features', 'owner', 'components', 'OwnerPublicContentPanel.tsx'],
      ['src', 'features', 'owner', 'components', 'OwnerAccessPanel.tsx'],
      ['src', 'features', 'owner', 'components', 'OwnerLegalPanel.tsx'],
    ];
    await Promise.all(requiredPaths.map(async (parts) => {
      await expect(pathExists(...parts), parts.join('/')).resolves.toBe(true);
    }));
  });

  it('keeps the page as a small loading, navigation, and panel coordinator', async () => {
    const source = await readFile(rootPath('src/features/owner/components/OwnerConsolePage.tsx'), 'utf8');
    expect(source.split(/\r?\n/u).length).toBeLessThanOrEqual(300);
    expect(source).not.toContain('@/features/app-shell');
    expect(source).toContain('dynamic(');
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

  it('keeps shared site headers in App composition', async () => {
    for (const featurePath of [
      'src/features/owner/components/OwnerConsolePage.tsx',
      'src/features/developer-assets/components/DeveloperProgramPage.tsx',
      'src/features/roadmap/components/RoadmapPage.tsx',
    ]) {
      const source = await readFile(rootPath(featurePath), 'utf8');
      expect(source, featurePath).not.toContain('@/features/app-shell');
    }
    for (const appPath of [
      'src/app/owner/page.tsx',
      'src/app/developer/page.tsx',
      'src/app/roadmap/page.tsx',
    ]) {
      const source = await readFile(rootPath(appPath), 'utf8');
      expect(source, appPath).toContain('@/features/app-shell/client/publicSite');
    }
  });
});
