import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  entitlement: {} as Record<string, unknown>,
  access: {} as Record<string, unknown>,
  accessHook: vi.fn(),
}));

vi.mock('@/features/account/client/entitlement', () => ({ useAccountEntitlement: () => state.entitlement }));
vi.mock('@/features/contributor-access/client', () => ({ useContributorAccess: (options: unknown) => { state.accessHook(options); return state.access; } }));
vi.mock('@/features/public-site/client/context', () => ({ useSiteContent: () => new Proxy({}, { get: (_, key) => String(key) }) }));
vi.mock('@clerk/nextjs', () => ({ useUser: () => ({ isLoaded: false, isSignedIn: true, user: null }) }));

import { ContributorProgramPage } from '@/features/contributor-program/components/ContributorProgramPage';

const renderPage = () => renderToStaticMarkup(createElement(ContributorProgramPage, { initialAuthConfigured: true }));

describe('Contributor program access handoff', () => {
  beforeEach(() => {
    state.entitlement = {
      isSignedIn: true, accountUserId: 'contributor', accountEmail: 'person@example.test', authConfigured: true,
      authorities: { contributor: true }, ownerAccess: { isOwner: false }, entitlementStatus: 'ready',
      entitlementError: null, refreshEntitlement: vi.fn(),
    };
    state.access = { active: true, scopes: ['assets.review'], isLoading: false, error: null, retry: vi.fn() };
    state.accessHook.mockClear();
  });

  it('offers the Pipeline to an active Contributor', () => {
    const page = renderPage();
    expect(page).toContain('Open contributor Library');
    expect(state.accessHook).toHaveBeenCalledWith(expect.objectContaining({ readOnly: true, sessionKey: 'contributor' }));
    expect(page).not.toContain('Your Contributor profile is not active');
  });

  it('does not promise access for an inactive profile and offers the request form', () => {
    state.access.active = false;
    const page = renderPage();
    expect(page).not.toContain('Open contributor Library');
    expect(page).toContain('Your Contributor profile is not active');
    expect(page).toContain('Request contributor access');
  });

  it('does not mistake loading or unavailable access for an inactive profile', () => {
    state.access = { ...state.access, active: false, isLoading: true };
    expect(renderPage()).toContain('Checking your account access');
    expect(renderPage()).not.toContain('Request contributor access');
    state.access = { ...state.access, isLoading: false, error: 'unavailable' };
    const page = renderPage();
    expect(page).toContain('Unable to verify your Contributor access');
    expect(page).toContain('Retry access');
    expect(page).not.toContain('Your Contributor profile is not active');
    expect(page).not.toContain('Request contributor access');
  });

  it('still offers a signed-in non-Contributor the request form', () => {
    state.entitlement.authorities = { contributor: false };
    state.access.active = false;
    const page = renderPage();
    expect(page).toContain('Request contributor access');
    expect(page).not.toContain('Your Contributor profile is not active');
  });

  it('does not present a missing account identity as an inactive profile', () => {
    state.entitlement.accountUserId = null;
    state.access.active = false;
    const page = renderPage();
    expect(page).toContain('Unable to verify your Contributor access');
    expect(page).not.toContain('Your Contributor profile is not active');
  });
});
