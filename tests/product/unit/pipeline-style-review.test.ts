import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { createStyleReviewRevision, readStyleReviewBase } from '@/features/pipeline/server/styleReviewRevision';
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: vi.fn() }));
const base = { assetId: 'style-fixture', parentSubmissionId: '63300e01-8d07-4f22-8221-a56de17221e5',
  lineageId: '0ba353d7-5deb-4dbe-8c9a-159ddb509155', baseRevisionNumber: 1, revisionHighWater: 1,
  parentContentVersion: 'a'.repeat(32), registryContentVersion: 'b'.repeat(32) };
const style = { id: base.assetId, name: 'Synthetic parchment', kind: 'material', targets: ['shape'],
  librarySource: 'developer', accessTier: 'free', registryStatus: 'published', contributorName: 'Original creator',
  appearance: { material: { baseColor: '#eee', texture: { kind: 'parchment', intensity: 55 } } } };
let saved: Record<string, unknown> | null;
const rpc = vi.fn();
const submit = (value: unknown = style, expectedBase = base) => createStyleReviewRevision({ style: value, expectedBase, submissionKey: 'style_key_1234567890' }, 'acting-owner');
beforeEach(() => {
  saved = null;
  rpc.mockReset().mockImplementation(async (name: string, args: Record<string, unknown>) => {
    if (name === 'cardforge_read_style_review_receipt') return { data: saved ? {
      id: 'bc615bd7-07b1-460c-9e25-9d3b13b65ed1', assetId: style.id, revisionNumber: 2,
      status: 'submitted', editorialReviewStatus: 'pending', requestFingerprint: saved.p_request_fingerprint,
    } : null, error: null };
    if (name === 'cardforge_read_style_review_base') return { data: { expectedBase: base, style }, error: null };
    if (name === 'cardforge_create_style_review_revision') { saved = args; return { data: 'candidate', error: null }; }
    throw new Error(name);
  });
  vi.mocked(getSupabaseServerClient).mockReturnValue({ rpc } as never);
});
describe('governed style correction service', () => {
  it('submits the full native style and exact pins, then recovers the same attempt without writing again', async () => {
    const candidate = { ...style, appearance: { material: { baseColor: '#fff' } } };
    expect(await submit(candidate)).toMatchObject({ status: 'submitted', editorialReviewStatus: 'pending' });
    expect(saved).toMatchObject({ p_style_payload: candidate, p_expected_base: base, p_actor_id: 'acting-owner' });
    expect(await submit(candidate)).toMatchObject({ revisionNumber: 2 });
    expect(rpc.mock.calls.filter(([name]) => name === 'cardforge_create_style_review_revision')).toHaveLength(1);
    await expect(submit({ ...candidate, name: 'Different' })).rejects.toMatchObject({ status: 409 });
  });
  it.each(['assetId', 'parentSubmissionId', 'lineageId', 'baseRevisionNumber', 'revisionHighWater', 'parentContentVersion', 'registryContentVersion'] as const)(
    'rejects a changed %s before creation', async (key) => {
      const value = key === 'assetId' ? 'other' : key.endsWith('Id') ? 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
        : key.includes('Version') ? 'c'.repeat(32) : 3;
      await expect(submit(style, { ...base, [key]: value })).rejects.toMatchObject({ status: key === 'assetId' ? 400 : 409 });
      expect(saved).toBeNull();
    });
  it.each([
    { ...style, kind: 'unknown' }, { ...style, targets: [] }, { ...style, appearance: [] },
    { ...style, appearance: { material: { texture: { kind: 'invented' } } } },
    { ...style, appearance: { effects: { bevel: Infinity } } },
    { ...style, updates: { shapeKind: 'invented' } },
    { ...style, contributorName: 'Forged' }, { ...style, accessTier: 'paid' },
  ])('rejects invalid style/provenance without creating', async (candidate) => {
    await expect(submit(candidate)).rejects.toMatchObject({ status: 400 });
    expect(saved).toBeNull();
  });
  it('does not turn unreadable canonical source into a conflict or success', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'connection unavailable' } });
    await expect(readStyleReviewBase(style.id)).rejects.toMatchObject({ status: 503 });
    expect(saved).toBeNull();
  });
  it('preserves retry semantics after a committed write with unreadable receipt', async () => {
    rpc.mockImplementationOnce(async () => ({ data: null, error: null }))
      .mockImplementationOnce(async () => ({ data: { expectedBase: base, style }, error: null }))
      .mockImplementationOnce(async (_name, args) => { saved = args; return { data: 'candidate', error: null }; })
      .mockImplementationOnce(async () => ({ data: null, error: { message: 'network' } }));
    await expect(submit()).rejects.toMatchObject({ status: 503 });
    expect(saved).not.toBeNull();
    expect(await submit()).toMatchObject({ revisionNumber: 2 });
  });
});
