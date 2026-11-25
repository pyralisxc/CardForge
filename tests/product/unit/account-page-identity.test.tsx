import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement, ReactNode } from 'react';

const state = vi.hoisted(() => ({ identity: vi.fn(), entitlement: vi.fn() }));
vi.mock('next/navigation', () => ({ unstable_rethrow: () => undefined }));
vi.mock('@/features/account/client/profile', () => ({ AccountDeskBoundary: 'desk-boundary' }));
vi.mock('@/features/account/server', async () => {
  const entitlement = await import('@/features/account/lib/accountEntitlement');
  const experience = await import('@/features/account/lib/accountExperience');
  return {
    ...entitlement, ...experience,
    getCurrentCardforgeUserAccess: state.identity,
    resolveCardforgeEntitlementForAccess: state.entitlement,
    getAccountAccessLabel: () => 'Access',
    getAccountDeskKey: () => 'desk',
    resolveAccountSection: ({ requestedSection }: { requestedSection?: string }) => requestedSection ?? 'desk',
  };
});
vi.mock('@/features/app-shell/server', () => ({ CardForgeAppProviders: 'app-providers' }));
vi.mock('@/features/billing/server/productAccessPricePresentation', () => ({ getCurrentProductAccessPricePresentation: vi.fn() }));
vi.mock('@/features/business-identity/server', () => ({ DEFAULT_BUSINESS_IDENTITY: {}, getCachedBusinessIdentity: async () => ({ brandName: 'CardForge', copyrightHolder: 'CardForge' }) }));
vi.mock('@/features/contributor-access/server', () => ({ EMPTY_CONTRIBUTOR_ACCESS_SESSION_STATE: { projection: { active: false, scopes: [] } }, getCurrentContributorAccessSessionState: vi.fn(), hasContributionScope: () => false }));
vi.mock('@/features/desk/client', () => ({ Desk: 'desk' }));
vi.mock('@/features/experience-settings/server', () => ({ getCachedExperienceSettings: async () => ({ studioAutosaveDelaySeconds: 5 }) }));
vi.mock('@/features/mcp-usage/server', () => ({ applyProductAccessPricePresentation: vi.fn(), getMcpAllowances: vi.fn() }));
vi.mock('@/features/project/client', () => ({ AccountProjectWorkspaceBoundary: 'workspace-boundary' }));
vi.mock('@/features/public-site/client', () => ({ SiteContentProvider: 'site-provider' }));
vi.mock('@/features/public-site/server', () => ({ createSiteContentMap: () => ({}), getCachedSiteContentBlocks: async () => [] }));
vi.mock('@/features/storage-management/client', () => ({ AccountStorageLibrary: 'storage', ConnectedPersonalLibraryPanel: 'assets', GoogleDrivePreviewWarmupBoundary: 'drive-boundary', GoogleDriveProjectStoragePanel: 'drive', LibraryStorageConnectionsTool: 'connections', LocalProjectFolderPanel: 'folder', UnifiedAccountLibrary: 'library' }));
vi.mock('@/features/creator-workbench/client', () => ({ WorkspaceUpdatesBoundary: 'updates-boundary' }));
vi.mock('./../../../src/app/account/_components/AccountProfileEnvironment', () => ({ AccountProfileEnvironment: 'profile' }));

import AccountPage from '@/app/account/page';
import { resolveAccountEntitlement } from '@/features/account/lib/accountEntitlement';

const find = (node: ReactNode, type: string): ReactElement | undefined => {
  if (!node || typeof node !== 'object' || !('type' in node)) return undefined;
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (element.type === type) return element;
  return (Array.isArray(element.props.children) ? element.props.children : [element.props.children])
    .map((child) => find(child, type)).find(Boolean);
};
const page = (section?: string) => AccountPage({ searchParams: Promise.resolve({ section }) });
const identity = (id: string | null, authConfigured = true) => ({ authConfigured, user: id ? { id } : null, ownerAccess: { isOwner: false, source: 'none' } });

describe('account workspace identity failure and recovery', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => vi.restoreAllMocks());

  it.each(['desk', 'library', 'profile'])('does not mount a workspace or profile in %s while identity is unavailable', async (section) => {
    state.identity.mockRejectedValueOnce(new Error('identity unavailable'));
    const result = await page(section);
    expect(find(result, 'workspace-boundary')).toBeUndefined();
    expect(find(result, 'profile')).toBeUndefined();
    expect(state.entitlement).not.toHaveBeenCalled();
  });

  it('recovers into the verified account and keeps that scope if only access resolution fails', async () => {
    state.identity.mockRejectedValueOnce(new Error('identity unavailable')).mockResolvedValue(identity('one'));
    expect(find(await page(), 'workspace-boundary')).toBeUndefined();
    state.entitlement.mockRejectedValueOnce(new Error('access unavailable'));
    const degraded = await page();
    expect(find(degraded, 'workspace-boundary')?.props).toMatchObject({ persistenceScope: 'account:one' });
    expect(find(degraded, 'desk')?.props).toMatchObject({ accessStatus: { value: 'Access unavailable' }, experience: { signedIn: true, owner: false } });
    state.entitlement.mockResolvedValueOnce(resolveAccountEntitlement({ authConfigured: true, accountUserId: 'one', isSignedIn: true }));
    expect(find(await page(), 'workspace-boundary')?.props).toMatchObject({ persistenceScope: 'account:one' });
  });

  it('uses only the newly verified identity, while preserving genuine guest and local scopes', async () => {
    for (const [user, configured, scope] of [['one', true, 'account:one'], ['two', true, 'account:two'], [null, true, 'guest'], [null, false, 'local']] as const) {
      state.identity.mockResolvedValueOnce(identity(user, configured));
      state.entitlement.mockResolvedValueOnce(resolveAccountEntitlement({ authConfigured: configured, accountUserId: user, isSignedIn: Boolean(user) }));
      expect(find(await page(), 'workspace-boundary')?.props).toMatchObject({ persistenceScope: scope });
    }
  });

  it('does not select another scope when identity fails after an account was open', async () => {
    state.identity.mockResolvedValueOnce(identity('one')).mockRejectedValueOnce(new Error('identity unavailable')).mockResolvedValueOnce(identity('two'));
    state.entitlement.mockResolvedValueOnce(resolveAccountEntitlement({ authConfigured: true, accountUserId: 'one', isSignedIn: true }))
      .mockResolvedValueOnce(resolveAccountEntitlement({ authConfigured: true, accountUserId: 'two', isSignedIn: true }));
    expect(find(await page(), 'workspace-boundary')?.props).toMatchObject({ persistenceScope: 'account:one' });
    expect(find(await page(), 'workspace-boundary')).toBeUndefined();
    expect(find(await page(), 'workspace-boundary')?.props).toMatchObject({ persistenceScope: 'account:two' });
  });
});
