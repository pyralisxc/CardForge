import { describe, expect, it } from 'vitest';

import {
  getEmbeddedRegistryContent,
  readRegistryContentAsset,
} from '@/lib/registryContentAssets';

const isContent = (value: unknown): value is { id: string; name: string } => (
  Boolean(value)
  && typeof value === 'object'
  && typeof (value as { id?: unknown }).id === 'string'
  && typeof (value as { name?: unknown }).name === 'string'
);

describe('registry content assets', () => {
  it('reads embedded JSON payloads from registry metadata keys', () => {
    expect(getEmbeddedRegistryContent(
      {
        developerId: 'dev-1',
        template: { id: 'template-1', name: 'Template One' },
      },
      ['template', 'payload'],
      isContent,
    )).toEqual({ id: 'template-1', name: 'Template One' });
  });

  it('ignores invalid embedded payloads and non-http source URLs', async () => {
    await expect(readRegistryContentAsset(
      {
        asset_id: 'template-1',
        name: 'Template One',
        url: '/not-public-json/template.json',
        metadata: { template: { id: 1, name: 'Template One' } },
      },
      ['template'],
      isContent,
    )).resolves.toBeNull();
  });
});
