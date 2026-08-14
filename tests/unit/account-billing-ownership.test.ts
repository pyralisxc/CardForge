import { access, readFile, readdir } from 'node:fs/promises';
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

const collectTypeScriptFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectTypeScriptFiles(entryPath));
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) files.push(entryPath);
  }
  return files;
};

describe('Account and Billing ownership', () => {
  it('gives Account focused identity and administration owners', async () => {
    const requiredPaths = [
      ['src', 'features', 'account', 'components', 'AccountIdentitySection.tsx'],
      ['src', 'features', 'account', 'components', 'AccountDeveloperStatusSection.tsx'],
      ['src', 'features', 'account', 'server', 'accountAdministration.ts'],
    ];

    await Promise.all(requiredPaths.map(async (parts) => {
      await expect(pathExists(...parts), parts.join('/')).resolves.toBe(true);
    }));

    for (const retiredPath of [
      ['src', 'features', 'account', 'components', 'AccountFounderBetaSection.tsx'],
      ['src', 'features', 'account', 'model', 'founderBeta.ts'],
      ['src', 'features', 'account', 'server', 'founderBetaStore.ts'],
      ['src', 'app', 'api', 'founder-beta', 'claim', 'route.ts'],
    ]) {
      await expect(pathExists(...retiredPath), retiredPath.join('/')).resolves.toBe(false);
    }
  });

  it('keeps the Account page independent of Owner and App Shell internals', async () => {
    const source = await readFile(
      rootPath('src', 'features', 'account', 'components', 'AccountProfilePage.tsx'),
      'utf8',
    );
    expect(source).not.toContain('@/features/owner');
    expect(source).not.toContain('@/features/app-shell');
  });

  it('makes Billing own every customer and owner billing concern', async () => {
    const requiredPaths = [
      ['src', 'features', 'billing', 'components', 'AccountBillingActions.tsx'],
      ['src', 'features', 'billing', 'components', 'OwnerBillingPanel.tsx'],
      ['src', 'features', 'billing', 'model', 'ownerBilling.ts'],
      ['src', 'features', 'billing', 'server', 'ownerBillingSettingsStore.ts'],
    ];
    await Promise.all(requiredPaths.map(async (parts) => {
      await expect(pathExists(...parts), parts.join('/')).resolves.toBe(true);
    }));

    for (const retiredPath of [
      ['src', 'features', 'owner', 'components', 'OwnerBillingPanel.tsx'],
      ['src', 'features', 'owner', 'lib', 'ownerBillingOperations.ts'],
      ['src', 'features', 'owner', 'lib', 'ownerBillingPresentation.ts'],
      ['src', 'features', 'owner', 'lib', 'ownerBillingSettingsStore.ts'],
      ['src', 'features', 'owner', 'lib', 'ownerAccountOperations.ts'],
    ]) {
      await expect(pathExists(...retiredPath), retiredPath.join('/')).resolves.toBe(false);
    }
  });

  it('keeps Billing independent of Account and Owner internals', async () => {
    const billingFiles = await collectTypeScriptFiles(rootPath('src', 'features', 'billing'));
    for (const file of billingFiles) {
      const source = await readFile(file, 'utf8');
      expect(source, path.relative(process.cwd(), file)).not.toContain('@/features/account');
      expect(source, path.relative(process.cwd(), file)).not.toContain('@/features/owner');
    }
  });

  it('keeps the retired demo-seat program out of runtime source', async () => {
    const runtimeFiles = await collectTypeScriptFiles(rootPath('src'));
    for (const file of runtimeFiles) {
      const source = await readFile(file, 'utf8');
      const sourceWithoutRetiredMetadataCleanup = source.replaceAll('cardforgeFounderBetaClaimedAt', '');
      expect(sourceWithoutRetiredMetadataCleanup, path.relative(process.cwd(), file)).not.toMatch(/founder[ _-]?beta/iu);
      expect(source, path.relative(process.cwd(), file)).not.toContain('landing.demo');
    }
  });

  it('routes account and billing APIs through their owning server interfaces', async () => {
    const routeExpectations = [
      ['src/app/api/owner/people/route.ts', '@/features/account/server'],
      ['src/app/api/owner/billing/summary/route.ts', '@/features/billing/server'],
      ['src/app/api/owner/billing/reconcile/route.ts', '@/features/billing/server'],
      ['src/app/api/billing/status/route.ts', '@/features/account/server'],
    ] as const;

    for (const [routePath, ownerInterface] of routeExpectations) {
      const source = await readFile(rootPath(...routePath.split('/')), 'utf8');
      expect(source, routePath).toContain(ownerInterface);
    }
  });
});
