import { describe, expect, it } from 'vitest';

import { requireDeveloperAssetRequestScope } from '@/features/developer-assets/server/developerAssetRequestAccess';

describe('developer asset request access', () => {
  it('requires the exact contribution scope at the Forge Review boundary', () => {
    const submitOnly = { scopes: ['assets.submit'] } as unknown as Parameters<typeof requireDeveloperAssetRequestScope>[0];
    expect(() => requireDeveloperAssetRequestScope(submitOnly, 'assets.submit')).not.toThrow();
    expect(() => requireDeveloperAssetRequestScope(submitOnly, 'assets.review')).toThrow(
      'does not have permission for this Forge Review action',
    );
  });
});
