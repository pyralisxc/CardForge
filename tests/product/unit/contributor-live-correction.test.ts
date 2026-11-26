import { beforeEach, expect, it, vi } from 'vitest';
import type { TCGCardTemplate } from '@/domain/templates';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { createTemplatePipelineDraft } from '@/features/pipeline/lib/pipelineRegistryCommands';

vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: vi.fn() }));
const externalize = vi.fn();
vi.mock('@/features/pipeline/lib/pipelineTemplateAssets', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/features/pipeline/lib/pipelineTemplateAssets')>();
  return { ...original, externalizePipelineTemplateAssets: (...args: unknown[]) => externalize(...args) };
});
const base = { assetId: 'native-template', parentSubmissionId: '63300e01-8d07-4f22-8221-a56de17221e5',
  lineageId: '0ba353d7-5deb-4dbe-8c9a-159ddb509155', baseRevisionNumber: 1, revisionHighWater: 2,
  parentContentVersion: 'a'.repeat(32), registryContentVersion: 'b'.repeat(32) };
const parent = { id: base.assetId, name: 'Original', aspectRatio: '63:88', templateContributorName: 'Original creator',
  freeformCanvas: { width: 630, height: 880, elements: [] },
  fieldContracts: [{ key: 'Artwork', type: 'image', example: 'original.png' }],
  templatePreviewData: { Artwork: '/api/public/site-media/original' } } as TCGCardTemplate;
const revisionBase = { parentSubmissionId: 'a2100e01-8d07-4f22-8221-a56de17221e5', assetId: base.assetId,
  reviewedAt: '2026-11-26T12:00:00Z', parentContentVersion: 'c'.repeat(32) };
const rpc = vi.fn();
beforeEach(() => {
  externalize.mockReset(); rpc.mockReset();
  rpc.mockImplementation(async (name: string) => {
    if (name === 'cardforge_read_template_author_revision_attempt') return { data: null, error: null };
    if (name === 'cardforge_read_template_review_base') return { data: { expectedBase: base, template: parent }, error: null };
    if (name === 'cardforge_create_template_author_revision_draft') return { data: 'draft-id', error: null };
    throw new Error(`Unexpected RPC ${name}`);
  });
  const from = vi.fn((table: string) => ({ select: () => ({ eq: () => table === 'cardforge_asset_registry'
    ? { maybeSingle: async () => ({ data: { asset_id: base.assetId }, error: null }) }
    : { limit: async () => ({ data: [{ id: 'draft-id', status: 'draft', base_revision_number: 1,
      revision_number: 3, target_registry_asset_id: base.assetId }], error: null }) } }) }));
  vi.mocked(getSupabaseServerClient).mockReturnValue({ rpc, from } as never);
});
const draft = (template: TCGCardTemplate) => createTemplatePipelineDraft({ template, contributorId: 'author', contributorEmail: '',
  submissionKey: 'author_live_attempt_123', revisionBase });
it('uses the governed published-base lease without externalizing existing sources', async () => {
  await expect(draft({ ...parent, name: 'Correction', templateContributorName: 'Forged' })).resolves.toMatchObject({ status: 'draft', assetId: base.assetId });
  expect(externalize).not.toHaveBeenCalled();
  expect(rpc).toHaveBeenCalledWith('cardforge_create_template_author_revision_draft', expect.objectContaining({ p_published_base: base,
    p_template_payload: expect.objectContaining({ name: 'Correction', templateContributorName: 'Original creator' }) }));
});
it('rejects replaced artwork before the native candidate write', async () => {
  await expect(draft({ ...parent, templatePreviewData: { Artwork: '/new-art.png' } })).rejects.toMatchObject({ status: 400 });
  expect(rpc).not.toHaveBeenCalledWith('cardforge_create_template_author_revision_draft', expect.anything());
  expect(externalize).not.toHaveBeenCalled();
});
