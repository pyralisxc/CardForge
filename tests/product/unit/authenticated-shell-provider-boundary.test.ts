import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  identity: vi.fn(),
  media: vi.fn(),
  configuration: vi.fn(),
  founder: vi.fn(),
  content: vi.fn(),
}));

vi.mock('@/features/business-identity/server', () => ({
  getCachedBusinessIdentity: state.identity,
}));

vi.mock('@/features/public-site/server', () => ({
  createSiteContentMap: vi.fn(() => ({})),
  getCachedAllSiteContentBlocks: state.content,
  getCachedFounderProfile: state.founder,
  getCachedPublicSiteConfiguration: state.configuration,
  getCachedSiteContentBlocks: state.content,
  getCachedSiteMedia: state.media,
  getDefaultSiteMedia: (slot: string) => ({
    slot,
    storagePath: null,
    alt: slot,
    width: 1000,
    height: 260,
    updatedAt: null,
  }),
  getSiteMediaDisplaySrc: () => null,
}));

vi.mock('@/features/brand-presentation/client', () => ({
  BrandPresentationProvider: ({ children }: { children: unknown }) => children,
}));

vi.mock('@/features/public-site/client', () => ({
  FounderProfileProvider: ({ children }: { children: unknown }) => children,
  SiteContentProvider: ({ children }: { children: unknown }) => children,
}));

vi.mock('@/features/card-generator/client', () => ({
  createPublicShareSettings: vi.fn(() => ({})),
  PublicShareSettingsProvider: ({ children }: { children: unknown }) => children,
}));

vi.mock('@/components/ui/toaster', () => ({
  Toaster: () => null,
}));

vi.mock('@/infrastructure/http/publicUrl', () => ({
  getPublicAppUrl: () => 'https://cardforges.com',
}));

import { CardForgeAppProviders } from '@/features/app-shell/server/CardForgeAppProviders';

describe('authenticated CardForge shell providers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.identity.mockResolvedValue({ brandName: 'CardForge' });
    state.media.mockResolvedValue([]);
    state.configuration.mockResolvedValue({
      watermarkPreviewOpacity: 24,
      watermarkShareOpacity: 28,
      watermarkWidthPercent: 68,
    });
    state.founder.mockResolvedValue({ heroHeadline: 'Founder' });
    state.content.mockResolvedValue([]);
  });

  it('loads only brand presentation state for the authenticated shell', async () => {
    await CardForgeAppProviders({
      scope: 'shell',
      children: createElement('div', null, 'Desk'),
    });

    expect(state.identity).toHaveBeenCalledOnce();
    expect(state.media).toHaveBeenCalledOnce();
    expect(state.configuration).toHaveBeenCalledOnce();
    expect(state.founder).not.toHaveBeenCalled();
    expect(state.content).not.toHaveBeenCalled();
  });

  it('keeps public marketing providers on the public scope', async () => {
    await CardForgeAppProviders({
      scope: 'public',
      children: createElement('div', null, 'Public site'),
    });

    expect(state.founder).toHaveBeenCalledOnce();
    expect(state.content).toHaveBeenCalledOnce();
  });
});
