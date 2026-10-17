import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reconstructMinimalTemplateObject, type TCGCardTemplate } from '@/domain/templates';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { createTemplateReviewRevision, readTemplateReviewReceipt } from '@/features/pipeline/server/templateReviewRevision';
import { templateReviewRequestText } from '@/features/pipeline/lib/templateReview';

vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: vi.fn() }));
const expectedBase = {
  assetId: 'native-template', parentSubmissionId: '63300e01-8d07-4f22-8221-a56de17221e5',
  lineageId: '0ba353d7-5deb-4dbe-8c9a-159ddb509155', baseRevisionNumber: 1, revisionHighWater: 1,
  parentContentVersion: 'a'.repeat(32), registryContentVersion: 'b'.repeat(32),
};
const parent = {
  id: expectedBase.assetId, name: 'Original', aspectRatio: '63:88', templateContributorName: 'Original creator',
  freeformCanvas: { width: 630, height: 880, elements: [] },
  fieldContracts: [{ key: 'Artwork', type: 'image', example: 'original.png' }],
  templatePreviewData: { Artwork: '/api/public/site-media/original' },
  appearance: { material: { baseColor: '#fff' } },
} as TCGCardTemplate;
let submitted: Record<string, unknown> | null;
const rpc = vi.fn();
const receipt = (fingerprint: string) => ({
  id: 'bc615bd7-07b1-460c-9e25-9d3b13b65ed1', assetId: parent.id, revisionNumber: 2,
  status: 'submitted', editorialReviewStatus: 'pending', requestFingerprint: fingerprint,
});
const submit = (template = structuredClone(parent)) => createTemplateReviewRevision({ template, expectedBase, submissionKey: 'review_key_1234567890' }, 'acting-owner');

beforeEach(() => {
  submitted = null;
  rpc.mockReset().mockImplementation(async (name: string, args: Record<string, unknown>) => {
    if (name === 'cardforge_read_template_review_receipt') return { data: submitted ? receipt(String(submitted.p_request_fingerprint)) : null, error: null };
    if (name === 'cardforge_read_template_review_base') return { data: { expectedBase, template: parent }, error: null };
    if (name === 'cardforge_create_template_review_revision') { submitted = args; return { data: receipt('').id, error: null }; }
    throw new Error(`Unexpected RPC ${name}`);
  });
  vi.mocked(getSupabaseServerClient).mockReturnValue({ rpc } as never);
});

describe('same-lineage unpublished Template review boundary', () => {
  it('submits authored corrections while preserving creator projection and removing working context', async () => {
    const template = { ...parent, name: 'Corrected name', templateContributorName: 'Forged label',
      templateSource: 'user' as const, templatePipelineContext: { schemaVersion: 1 as const, expectedBase } };
    expect(await submit(template)).toMatchObject({ status: 'submitted', editorialReviewStatus: 'pending' });
    expect(submitted).toMatchObject({ p_actor_id: 'acting-owner', p_expected_base: expectedBase,
      p_template_payload: { name: 'Corrected name', templateContributorName: 'Original creator' } });
    const payload = submitted!.p_template_payload as TCGCardTemplate;
    expect(payload).not.toHaveProperty('templatePipelineContext');
    expect(payload).not.toHaveProperty('templateSource');
  });

  it.each([
    (t: TCGCardTemplate) => { t.appearance!.assetSource = '/new-art.png'; },
    (t: TCGCardTemplate) => { t.appearance!.dividerAsset = 'new-art.png'; },
    (t: TCGCardTemplate) => { t.templatePreviewData!.Artwork = '/new-art.png'; },
    (t: TCGCardTemplate) => { t.templatePreviewData!.Artwork = '//external.invalid/new-art.png'; },
    (t: TCGCardTemplate) => { t.fieldContracts![0].example = 'new-art.png'; },
    (t: TCGCardTemplate) => { t.appearance!.rawCss = { backgroundImage: 'linear-gradient(red,blue),url(new-art.png)' }; },
  ])('rejects new or replaced source references before a provider write', async (change) => {
    const template = structuredClone(parent); change(template);
    await expect(submit(template)).rejects.toMatchObject({ status: 400 });
    expect(submitted).toBeNull();
  });

  it('accepts a native normalized alias of the same legacy background without adding artwork', async () => {
    const legacy = { ...parent, appearance: undefined, cardBackgroundImageUrl: '/existing-published-bg.webp' };
    rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
      if (name === 'cardforge_read_template_review_receipt') return { data: submitted ? receipt(String(submitted.p_request_fingerprint)) : null, error: null };
      if (name === 'cardforge_read_template_review_base') return { data: { expectedBase, template: legacy }, error: null };
      submitted = args; return { data: receipt('').id, error: null };
    });
    expect(await submit(reconstructMinimalTemplateObject(legacy))).toMatchObject({ status: 'submitted' });
    expect(submitted).not.toBeNull();
  });

  it('recovers an identical saved attempt without reading a newer published base or creating again', async () => {
    const fingerprint = createHash('sha256').update(templateReviewRequestText({ ...parent,
      templatePipelineContext: { schemaVersion: 1, expectedBase } })).digest('hex');
    rpc.mockResolvedValue({ data: receipt(fingerprint), error: null });
    expect(await submit()).toEqual(receipt(fingerprint));
    expect(rpc).toHaveBeenCalledTimes(1);
    await expect(submit({ ...parent, name: 'Different snapshot' })).rejects.toMatchObject({ status: 409 });
    expect(submitted).toBeNull();
  });

  it('fails closed on stale exact content even when the displayed revision number matches', async () => {
    rpc.mockImplementation(async (name: string) => ({ data: name === 'cardforge_read_template_review_receipt' ? null
      : { expectedBase: { ...expectedBase, parentContentVersion: 'c'.repeat(32) }, template: parent }, error: null }));
    await expect(submit()).rejects.toMatchObject({ status: 409 });
    expect(submitted).toBeNull();
  });

  it('does not turn a provider failure or malformed receipt into an absent attempt', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'transport timeout' } });
    await expect(readTemplateReviewReceipt(expectedBase.assetId, 'review_key_1234567890', 'acting-owner')).rejects.toMatchObject({ status: 503 });
    rpc.mockResolvedValueOnce({ data: {}, error: null });
    await expect(readTemplateReviewReceipt(expectedBase.assetId, 'review_key_1234567890', 'acting-owner')).rejects.toMatchObject({ status: 503 });
  });
});
