import { describe, expect, it } from 'vitest';

import { toCampaignDeskItem, toPublishedDeskItem } from '@/features/desk/hooks/useDeskWorkDiscovery';
import type { MarketingContentPackage } from '@/features/marketing-content/client';
import type { PipelineSubmission } from '@/features/pipeline/client';

describe('Desk work preview projection', () => {
  it('uses the campaign owner’s attached media preview instead of a generic source link', () => {
    const campaign = {
      id: 'campaign-1', title: 'Launch cards', version: 3, updatedAt: '2026-09-07T00:00:00.000Z',
      status: 'draft', contentKind: 'social_post',
      variants: [{ attachments: [{ media: { previewUrl: '/api/marketing-content/media/media-1' } }] }],
    } as unknown as MarketingContentPackage;

    expect(toCampaignDeskItem(campaign).workPreview).toEqual({
      kind: 'image', url: '/api/marketing-content/media/media-1',
    });
  });

  it('keeps a campaign without media honest instead of promising a preview after opening', () => {
    const campaign = {
      id: 'campaign-2', title: 'Text post', version: 1, updatedAt: '2026-09-07T00:00:00.000Z',
      status: 'draft', contentKind: 'social_post', variants: [{ attachments: [] }],
    } as unknown as MarketingContentPackage;

    expect(toCampaignDeskItem(campaign).workPreview).toEqual({ kind: 'fallback', reason: 'no-media' });
  });

  it('admits only actual Pipeline image previews to the Desk', () => {
    const image = {
      id: 'submission-image', lineageId: 'lineage-image', assetType: 'imageAssets', name: 'Moon art',
      previewUrl: 'https://storage.example.test/moon.webp', sourceMimeType: 'image/webp',
      sourceFileSizeBytes: 22, revisionNumber: 2, publishedAt: '2026-09-07T00:00:00.000Z',
    } as PipelineSubmission;
    const packageUrl = {
      ...image, id: 'submission-package', lineageId: 'lineage-package', previewUrl: 'https://storage.example.test/set.cardforge', sourceMimeType: 'application/vnd.cardforge.project+zip',
    } as PipelineSubmission;

    expect(toPublishedDeskItem(image).workPreview).toEqual({ kind: 'image', url: 'https://storage.example.test/moon.webp' });
    expect(toPublishedDeskItem(packageUrl).workPreview).toEqual({ kind: 'fallback', reason: 'no-media' });
    expect(toPublishedDeskItem(packageUrl).webViewLink).toBe('https://storage.example.test/set.cardforge');
  });
});
