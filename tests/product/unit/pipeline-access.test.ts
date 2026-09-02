import { describe, expect, it } from 'vitest';

import { requirePipelineRequestScope } from '@/features/pipeline/server/pipelineRequestAccess';

describe('contributor asset request access', () => {
  it('requires the exact contribution scope at the Forge Review boundary', () => {
    const submitOnly = { scopes: ['assets.submit'] } as unknown as Parameters<typeof requirePipelineRequestScope>[0];
    expect(() => requirePipelineRequestScope(submitOnly, 'assets.submit')).not.toThrow();
    expect(() => requirePipelineRequestScope(submitOnly, 'assets.review')).toThrow(
      'does not have permission for this Forge Review action',
    );
  });
});
