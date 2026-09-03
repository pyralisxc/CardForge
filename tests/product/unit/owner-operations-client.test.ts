import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  loadOwnerSiteControls,
  updateOwnerOperations,
} from '@/features/owner/model/ownerOperationsClient';

describe('Owner operations client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads contextual site controls from the Owner operations endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      siteControls: { siteConfiguration: { homeViewMode: 'default' } },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadOwnerSiteControls()).resolves.toMatchObject({
      siteConfiguration: { homeViewMode: 'default' },
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/owner/operations?scope=site', { cache: 'no-store' });
  });

  it('updates through the operations response contract without a legacy console envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      operations: { configured: true },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(updateOwnerOperations({
      kind: 'roadmapStatus',
      roadmapItem: { itemId: 'roadmap-1', status: 'testing' },
    }, 'Unable to update roadmap item.')).resolves.toMatchObject({ configured: true });
    expect(fetchMock).toHaveBeenCalledWith('/api/owner/operations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'roadmapStatus',
        roadmapItem: { itemId: 'roadmap-1', status: 'testing' },
      }),
    });
  });
});
