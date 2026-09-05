import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PipelineContentHealthPanel } from '@/features/pipeline/components/PipelineContentHealthPanel';
import { buildPipelineContentReview } from '@/features/pipeline/lib/pipelineContentReview';
import type { CardForgeCatalogManifest } from '@/features/pipeline/lib/catalogManifest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { classifyPublishedPipelineAsset } from '@/features/pipeline/server/classifyPublishedAsset';
import { PipelineRegistryCommandError } from '@/features/pipeline/lib/pipelineRegistryCommandsError';

const boundary = vi.hoisted(() => ({ rpc: vi.fn(), owner: vi.fn(), classify: vi.fn(), read: vi.fn(), refresh: vi.fn() }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: () => ({ rpc: boundary.rpc }) }));
vi.mock('@/features/owner/server', () => ({ getCurrentOwnerAccess: boundary.owner }));
vi.mock('@/features/pipeline/server', () => ({ classifyPublishedPipelineAsset: boundary.classify, readPublishedPipelineClassification: boundary.read, PipelineRegistryCommandError, revalidateCardForgeCatalog: boundary.refresh }));
import { GET, POST } from '@/app/api/owner/pipeline/classification/route';

const classification = {
  assetId: 'worn-paper',
  expectedSubmissionId: '63300e01-8d07-4f22-8221-a56de17221e5',
  expectedLineageId: '0ba353d7-5deb-4dbe-8c9a-159ddb509155',
  expectedRevision: 0,
  expectedSpecialtyTags: [], expectedUseCaseTags: [], specialtyTags: ['general'], useCaseTags: [],
};
beforeEach(() => { vi.clearAllMocks(); boundary.rpc.mockResolvedValue({ error: null }); boundary.owner.mockResolvedValue({ isOwner: true, userId: 'owner' }); boundary.classify.mockResolvedValue(undefined); });

describe('published classification command', () => {
  it('passes exact compare-and-set identity and tags to the atomic owner without authored fields', async () => {
    await classifyPublishedPipelineAsset(classification);
    expect(boundary.rpc).toHaveBeenCalledWith('cardforge_classify_published_pipeline_asset', {
      p_asset_id: 'worn-paper', p_expected_submission_id: classification.expectedSubmissionId,
      p_expected_lineage_id: classification.expectedLineageId, p_expected_revision: 0,
      p_expected_specialty_tags: [], p_expected_use_case_tags: [], p_specialty_tags: ['general'], p_use_case_tags: [],
    });
  });
  it('rejects invented tags before a write', async () => {
    await expect(classifyPublishedPipelineAsset({ ...classification, useCaseTags: ['fantasy-vibes'] })).rejects.toMatchObject({ status: 400 });
    expect(boundary.rpc).not.toHaveBeenCalled();
  });
  it.each([['pipeline_classification_conflict', 409], ['pipeline_classification_not_found', 404], ['provider timeout', 503]] as const)('preserves %s boundary meaning', async (message, status) => {
    boundary.rpc.mockResolvedValue({ error: { message } });
    await expect(classifyPublishedPipelineAsset(classification)).rejects.toMatchObject({ status });
  });
});

describe('owner classification API', () => {
  it('distinguishes signed-out from signed-in non-owner access', async () => {
    boundary.owner.mockResolvedValue({ isOwner: false, userId: null });
    expect((await POST(new Request('https://cardforges.com/api/owner/pipeline/classification', { method: 'POST', body: '{}' }))).status).toBe(401);
    expect(boundary.classify).not.toHaveBeenCalled();
  });
  it('rejects a non-owner before parsing or invoking the command', async () => {
    boundary.owner.mockResolvedValue({ isOwner: false, userId: 'contributor' });
    expect((await POST(new Request('https://cardforges.com/api/owner/pipeline/classification', { method: 'POST', body: '{}' }))).status).toBe(403);
    expect(boundary.classify).not.toHaveBeenCalled();
  });
  it('reports conflict without invalidating catalogs or claiming success', async () => {
    boundary.classify.mockRejectedValue(new PipelineRegistryCommandError('Reload changed revision', 409, 'pipeline_classification_conflict'));
    const response = await POST(new Request('https://cardforges.com/api/owner/pipeline/classification', { method: 'POST', body: JSON.stringify(classification) }));
    expect(response.status).toBe(409);
    expect(boundary.refresh).not.toHaveBeenCalled();
  });
  it('refreshes the shared catalog only after owner classification succeeds', async () => {
    const response = await POST(new Request('https://cardforges.com/api/owner/pipeline/classification', { method: 'POST', body: JSON.stringify(classification) }));
    expect(response.status).toBe(200);
    expect(boundary.refresh).toHaveBeenCalledOnce();
  });
});

it('loads exact classification only after the owner gate', async () => {
  boundary.owner.mockResolvedValue({ isOwner: false, userId: 'contributor' });
  expect((await GET(new Request('https://cardforges.com/api/owner/pipeline/classification?assetId=worn-paper'))).status).toBe(403);
  expect(boundary.read).not.toHaveBeenCalled();
  boundary.owner.mockResolvedValue({ isOwner: true, userId: 'owner' });
  boundary.read.mockResolvedValue(classification);
  const response = await GET(new Request('https://cardforges.com/api/owner/pipeline/classification?assetId=worn-paper'));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(classification);
  expect(boundary.read).toHaveBeenCalledWith('worn-paper');
  expect(response.headers.get('Cache-Control')).toContain('no-store');
});

it('keeps owner classification reachable after all health warnings are resolved', () => {
  const props = { health: { checkedCount: 1, errors: 0, warnings: 0, issues: [], review: buildPipelineContentReview(null) }, onOpenObject: vi.fn(), onClassified: vi.fn(),
    catalog: { pipeline: { items: [{ id: 'worn-paper', name: 'Worn Paper', lineageId: 'lineage' }] } } as CardForgeCatalogManifest };
  expect(renderToStaticMarkup(createElement(PipelineContentHealthPanel, { ...props, canRepair: true }))).toContain('Edit published classification');
  expect(renderToStaticMarkup(createElement(PipelineContentHealthPanel, { ...props, canRepair: false }))).not.toContain('Edit published classification');
});
