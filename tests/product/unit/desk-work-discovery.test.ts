import { describe, expect, it } from 'vitest';

import { toCampaignDeskItem, toPublishedDeskItem, toPublishedDeskItems } from '@/features/desk/hooks/useDeskWorkDiscovery';
import type { MarketingContentPackage } from '@/features/marketing-content/client';
import type { CardForgeCatalogManifest, PipelineSubmission } from '@/features/pipeline/client';

describe('Desk work preview projection', () => {
  const old = {
    id: 'old', lineageId: 'bridge', registryAssetId: 'bridge-asset', targetRegistryAssetId: 'bridge-asset',
    revisionNumber: 1, assetType: 'templates', name: 'Bridge Back', status: 'published', previewUrl: '',
    publishedAt: '2026-01-01T00:00:00Z', submittedAt: '2026-01-01T00:00:00Z',
  } as PipelineSubmission;
  const current = { ...old, id: 'current', revisionNumber: 2 };
  const catalog = { pipeline: { items: [{ id: 'bridge-asset', lineageId: 'bridge', submissionId: 'current', updatedAt: 'epoch' }] } } as CardForgeCatalogManifest;

  it('projects one spatial identity per lineage and pins its actual current publication, independent of input order', () => {
    const newerRetained = { ...old, id: 'retained', revisionNumber: 3 };
    const other = { ...old, id: 'vellum', lineageId: 'vellum', registryAssetId: 'vellum-asset', name: 'Rules Vellum' };
    for (const rows of [[old, current, newerRetained, other], [other, newerRetained, current, old, old]]) {
      const items = toPublishedDeskItems(rows, catalog);
      expect(items).toHaveLength(2);
      expect(new Set(items.map(item => item.id)).size).toBe(2);
      expect(items.find(item => item.id === 'pipeline:bridge')).toMatchObject({
        revision: '2', references: { pipelineReviewTarget: { submissionId: 'current', catalogPublication: { submissionId: 'current', updatedAt: 'epoch' } } },
      });
    }
  });

  it('retains one known publication without inventing current governance when the catalog is unavailable', () => {
    const [item] = toPublishedDeskItems([old, current], null);
    expect(item).toMatchObject({ id: 'pipeline:bridge', revision: '2' });
    expect(item.references.pipelineReviewTarget).toBeUndefined();
    expect(toPublishedDeskItems([current, old], null)).toEqual([item]);
  });

  it('preserves an own historical publication when the current pointer is outside the own projection', () => {
    const [item] = toPublishedDeskItems([old], catalog);
    expect(item.references.pipelineReviewTarget).toMatchObject({ submissionId: 'old', revisionNumber: 1,
      catalogPublication: { submissionId: 'current', updatedAt: 'epoch' } });
    expect(item.id).toBe('pipeline:bridge');
    expect(old.revisionNumber).toBe(1);
  });
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
