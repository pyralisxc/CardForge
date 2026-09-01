import { describe, expect, it, vi } from 'vitest';

import {
  BROWSER_PROJECT_ASSET_REFERENCE_PREFIX,
  createProjectBinaryAssetResolver,
} from '@/features/project/client';
import { resolveFreeformImageUrl } from '@/features/card-rendering/model/elementStyles';

describe('Project binary asset resolver', () => {
  it('keeps durable references lazy and revokes object URLs after the final consumer', async () => {
    const loadBlob = vi.fn(async () => new Blob(['asset-bytes'], { type: 'image/png' }));
    const createObjectURL = vi.fn(() => 'blob:cardforge/asset-1');
    const revokeObjectURL = vi.fn();
    const resolver = createProjectBinaryAssetResolver({
      loadBlob,
      urlApi: { createObjectURL, revokeObjectURL },
    });
    const reference = `${BROWSER_PROJECT_ASSET_REFERENCE_PREFIX}${'a'.repeat(64)}`;

    const first = await resolver.acquire(reference);
    const second = await resolver.acquire(reference);

    expect(first.url).toBe('blob:cardforge/asset-1');
    expect(second.url).toBe(first.url);
    expect(loadBlob).toHaveBeenCalledOnce();
    first.release();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    second.release();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:cardforge/asset-1');
  });

  it('loads a scoped browser Blob without exposing Base64 to the consumer', async () => {
    const { createScopedProjectBinaryAssetResolver } = await import('@/features/project/client');
    const readBlob = vi.fn(async () => new Blob(['scoped-bytes'], { type: 'image/webp' }));
    const createObjectURL = vi.fn(() => 'blob:cardforge/scoped');
    const resolver = createScopedProjectBinaryAssetResolver(
      'account:user/a',
      readBlob,
      { createObjectURL, revokeObjectURL: vi.fn() },
    );
    const reference = `${BROWSER_PROJECT_ASSET_REFERENCE_PREFIX}${'b'.repeat(64)}`;

    const handle = await resolver.acquire(reference);

    expect(handle.url).toBe('blob:cardforge/scoped');
    expect(readBlob).toHaveBeenCalledWith(`project-content-asset:account%3Auser%2Fa:${'b'.repeat(64)}`);
    expect(readBlob.mock.results[0]?.value).toBeInstanceOf(Promise);
    handle.release();
  });

  it('passes provider and legacy URLs through without allocating object URLs', async () => {
    const loadBlob = vi.fn();
    const resolver = createProjectBinaryAssetResolver({
      loadBlob,
      urlApi: { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() },
    });

    const handle = await resolver.acquire('https://cdn.example/card.png');
    expect(handle.url).toBe('https://cdn.example/card.png');
    handle.release();
    expect(loadBlob).not.toHaveBeenCalled();
  });

  it('preserves a durable reference until the mounted rendering boundary resolves it', () => {
    const reference = `${BROWSER_PROJECT_ASSET_REFERENCE_PREFIX}${'c'.repeat(64)}`;

    expect(resolveFreeformImageUrl({
      id: 'artwork',
      name: 'Artwork',
      type: 'image',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      zIndex: 1,
      imageSource: reference,
    }, {}, 'Artwork')).toBe(reference);
  });
});
