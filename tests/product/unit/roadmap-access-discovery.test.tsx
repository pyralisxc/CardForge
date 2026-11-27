import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  accessHook: vi.fn(), panel: vi.fn(),
  scopes: [] as string[], error: null as string | null,
}));
vi.mock('@/features/account/client/entitlement', () => ({ useAccountEntitlement: () => ({
  isSignedIn: true, accountUserId: 'user', accountEmail: null, authConfigured: true,
  authorities: { contributor: true }, ownerAccess: { isOwner: false }, accessMode: 'paid',
}) }));
vi.mock('@/features/contributor-access/client', () => ({
  useContributorAccess: (options: unknown) => { state.accessHook(options); return { scopes: state.scopes, error: state.error, retry: vi.fn() }; },
  hasContributionScope: (scopes: string[], scope: string) => scopes.includes(scope),
}));
vi.mock('@/features/roadmap/components/RoadmapPanel', () => ({ RoadmapPanel: (props: unknown) => { state.panel(props); return null; } }));
vi.mock('@/features/public-site/client/context', () => ({ useSiteContent: () => ({}) }));
vi.mock('@clerk/nextjs', () => ({ useUser: () => ({ isLoaded: true, isSignedIn: true, user: null }) }));
import { RoadmapPage } from '@/features/roadmap/components/RoadmapPage';

beforeEach(() => { state.accessHook.mockClear(); state.panel.mockClear(); state.scopes = []; state.error = null; });
it('discovers Contributor access without enrolling and reveals editing only for the narrow scope', () => {
  renderToStaticMarkup(createElement(RoadmapPage, { initialAuthConfigured: true }));
  expect(state.accessHook).toHaveBeenCalledWith(expect.objectContaining({ readOnly: true, eligible: true, sessionKey: 'user' }));
  expect(state.panel).toHaveBeenCalledWith(expect.objectContaining({ canEditRoadmap: false }));
  state.scopes = ['roadmap.edit'];
  renderToStaticMarkup(createElement(RoadmapPage, { initialAuthConfigured: true }));
  expect(state.panel).toHaveBeenCalledWith(expect.objectContaining({ canEditRoadmap: true }));
});
it('shows access failure without representing it as inactive access', () => {
  state.error = 'Contributor access is temporarily unavailable. Retry to verify access.';
  expect(renderToStaticMarkup(createElement(RoadmapPage, { initialAuthConfigured: true }))).toContain('Contributor access is temporarily unavailable');
});
