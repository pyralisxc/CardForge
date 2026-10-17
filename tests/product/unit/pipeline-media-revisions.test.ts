import { createHash } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { createMediaPresentationRevision, readMediaPresentationRevision } from '@/features/pipeline/server/mediaPresentationRevision';
import { mediaPresentationSchema, mediaRevisionInputSchema, parsePipelineMediaPresentation } from '@/features/pipeline/lib/pipelineMediaPresentation';
import { updatePipelineSubmissionDetails } from '@/features/pipeline/lib/pipelineStore';
import { MediaPresentationPreview } from '@/features/pipeline/components/MediaPresentationRevision';

vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: vi.fn() }));
const parent = '63300e01-8d07-4f22-8221-a56de17221e5';
const lineage = '0ba353d7-5deb-4dbe-8c9a-159ddb509155';
const candidate = 'bc615bd7-07b1-460c-9e25-9d3b13b65ed1';
const source = '<svg viewBox="0 0 20 20"><path d="M0 0h20v20H0z"/></svg>';
const sha = createHash('sha256').update(source).digest('hex');
const base = {
  assetId: 'native-texture', name: 'Original source', parentSubmissionId: parent, lineageId: lineage,
  baseRevisionNumber: 1, baseVersion: 'a'.repeat(32), registryVersion: 'b'.repeat(32), intendedAccessTier: 'free',
  baseline: { tileMode: 'repeat', seamless: true }, sourceBucket: 'pipeline', sourcePath: 'original.svg',
  sourceUrl: 'https://example.invalid/original.svg', sourceMimeType: 'image/svg+xml', sourceSize: Buffer.byteLength(source),
};
const presentation = () => mediaPresentationSchema.parse({
  schemaVersion: 1, parentSubmissionId: parent, lineageId: lineage, baseRevisionNumber: 1,
  baseVersion: base.baseVersion, registryVersion: base.registryVersion, intendedAccessTier: 'free', sourceSha256: sha,
  baseline: base.baseline, proposed: { tileMode: 'contain', seamless: false },
});
const input = () => ({ assetId: base.assetId, submissionKey: '95d641b4-8c9d-4bf3-8292-17319118be1e', presentation: presentation() });
const saved = (path: string, p = presentation()) => ({ id: candidate, revision_number: 8, status: 'submitted', editorial_review_status: 'pending', media_presentation: p, source_storage_bucket: 'pipeline', source_storage_path: path, trashed_at: null, purge_state: null });
let receipts: Array<{ data: unknown; error: unknown }>;
let references: { data: unknown; error: unknown };
let rpc: ReturnType<typeof vi.fn>;
let copy: ReturnType<typeof vi.fn>;
let download: ReturnType<typeof vi.fn>;
let remove: ReturnType<typeof vi.fn>;
let paths: string[];
beforeEach(() => {
  receipts = [{ data: null, error: null }]; references = { data: [], error: null }; paths = [];
  copy = vi.fn(async (_from: string, to: string) => { paths.push(to); return { error: null }; });
  download = vi.fn(async () => ({ data: new Blob([source], { type: 'image/svg+xml' }), error: null }));
  remove = vi.fn(async () => ({ error: null }));
  rpc = vi.fn(async (name: string, _input?: unknown) => name === 'cardforge_read_media_revision_base'
    ? { data: base, error: null } : { data: candidate, error: null });
  const from = () => {
    const chain = { select: () => chain, eq: () => chain, not: () => chain,
      maybeSingle: async () => receipts.shift() ?? { data: saved(paths[0]), error: null },
      limit: async () => references };
    return chain;
  };
  vi.mocked(getSupabaseServerClient).mockReturnValue({ rpc, from, storage: { from: () => ({ copy, download, remove, getPublicUrl: (path: string) => ({ data: { publicUrl: `https://example.invalid/${path}` } }) }) } } as never);
});

describe('native pending media presentation revisions', () => {
  it('never silently replaces an unreadable persisted snapshot with registry defaults', () => {
    expect(parsePipelineMediaPresentation(null)).toBeNull();
    expect(() => parsePipelineMediaPresentation({ schemaVersion: 99 })).toThrow();
  });
  it.each([false, true])('rejects generic inherited-content edits for creator/Owner access=%s', async (allowOwnerEdit) => {
    const update = vi.fn();
    const chain = { select: () => chain, eq: () => chain, limit: async () => ({ data: [{ contributor_id: 'creator', status: 'submitted', editorial_review_status: 'pending', media_presentation: presentation() }], error: null }), update };
    vi.mocked(getSupabaseServerClient).mockReturnValue({ from: () => chain } as never);
    await expect(updatePipelineSubmissionDetails({ submissionId: candidate, contributorId: 'creator', input: { name: 'Changed', sourceNotes: 'New claim' }, allowOwnerEdit })).rejects.toMatchObject({ status: 409 });
    expect(update).not.toHaveBeenCalled();
  });
  it('reads the exact managed bytes and gives no rights or approval defaults', async () => {
    const snapshot = await readMediaPresentationRevision(base.assetId);
    expect(snapshot.presentation.sourceSha256).toBe(sha);
    expect(snapshot.presentation.proposed).toEqual(base.baseline);
    expect(Object.keys(snapshot)).toEqual(['assetId', 'name', 'sourceUrl', 'presentation']);
    expect(copy).not.toHaveBeenCalled();
  });
  it('copies exact bytes to independent candidate ownership before committing only typed presentation', async () => {
    const result = await createMediaPresentationRevision(input());
    expect(result).toMatchObject({ id: candidate, revisionNumber: 8, status: 'submitted', cleanupPending: false });
    expect(copy).toHaveBeenCalledWith(base.sourcePath, expect.stringMatching(new RegExp(`^media-revisions/[a-f0-9-]+/${sha}\\.svg$`)));
    expect(download).toHaveBeenCalledWith(base.sourcePath);
    expect(download).toHaveBeenCalledWith(paths[0]);
    const args = rpc.mock.calls.find(([name]) => name === 'cardforge_create_media_presentation_revision')?.[1];
    expect(args).toEqual({ p_asset_id: base.assetId, p_submission_key: input().submissionKey, p_candidate_id: expect.any(String), p_presentation: presentation(), p_source_url: `https://example.invalid/${paths[0]}`, p_source_path: paths[0] });
    expect(remove).not.toHaveBeenCalled();
  });
  it('returns the committed same-content receipt without copying even if the base has since changed', async () => {
    receipts = [{ data: saved('prior-copy.svg'), error: null }];
    await expect(createMediaPresentationRevision(input())).resolves.toMatchObject({ reused: true, id: candidate });
    expect(rpc).not.toHaveBeenCalled(); expect(copy).not.toHaveBeenCalled();
  });
  it('rejects changed payload under the same key before creating another file', async () => {
    receipts = [{ data: saved('prior.svg', { ...presentation(), proposed: { tileMode: 'stretch', seamless: false } }), error: null }];
    await expect(createMediaPresentationRevision(input())).rejects.toMatchObject({ status: 409 });
    expect(copy).not.toHaveBeenCalled();
  });
  it.each(['baseVersion', 'registryVersion', 'lineageId', 'sourceSha256'] as const)('rejects stale %s before copy', async (field) => {
    const request = input();
    request.presentation[field] = field === 'lineageId' ? candidate : 'c'.repeat(field === 'sourceSha256' ? 64 : 32);
    await expect(createMediaPresentationRevision(request)).rejects.toMatchObject({ status: 409 });
    expect(copy).not.toHaveBeenCalled();
  });
  it('never deletes a referenced extra copy, even after a resolved concurrent receipt', async () => {
    receipts.push({ data: saved('another.svg'), error: null });
    references = { data: [{ id: 'referencing-row' }], error: null };
    await expect(createMediaPresentationRevision(input())).resolves.toMatchObject({ cleanupPending: true });
    expect(remove).not.toHaveBeenCalled();
  });
  it('compensates only the new path after byte mismatch, never the original', async () => {
    download.mockResolvedValueOnce({ data: new Blob([source], { type: 'image/svg+xml' }), error: null });
    download.mockResolvedValueOnce({ data: new Blob([source.replace('20', '21')], { type: 'image/svg+xml' }), error: null });
    await expect(createMediaPresentationRevision(input())).rejects.toMatchObject({ status: 409 });
    expect(remove).toHaveBeenCalledWith([paths[0]]);
    expect(remove).not.toHaveBeenCalledWith([base.sourcePath]);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('cleans an extra concurrent copy only after resolving the existing receipt', async () => {
    receipts.push({ data: saved('another-attempt.svg'), error: null });
    await expect(createMediaPresentationRevision(input())).resolves.toMatchObject({ reused: true, cleanupPending: false });
    expect(remove).toHaveBeenCalledWith([paths[0]]);
  });
  it('reconciles a lost commit response through the receipt', async () => {
    rpc.mockImplementation(async (name: string) => {
      if (name === 'cardforge_read_media_revision_base') return { data: base, error: null };
      throw new Error('socket closed after commit');
    });
    await expect(createMediaPresentationRevision(input())).resolves.toMatchObject({ id: candidate });
    expect(remove).not.toHaveBeenCalled();
  });
  it.each([false, true])('retains the copy when a commit is uncertain and receipt is unreadable=%s', async (unreadable) => {
    rpc.mockImplementation(async (name: string) => name === 'cardforge_read_media_revision_base' ? { data: base, error: null } : { data: null, error: { message: 'timeout' } });
    receipts.push({ data: null, error: unreadable ? { message: 'offline' } : null });
    await expect(createMediaPresentationRevision(input())).rejects.toMatchObject({ status: 503 });
    expect(remove).not.toHaveBeenCalled();
  });
  it('cleans after a definitive stale rollback, and retains bytes when reference checks are unavailable', async () => {
    rpc.mockImplementation(async (name: string) => name === 'cardforge_read_media_revision_base' ? { data: base, error: null } : { data: null, error: { code: 'P0001', message: 'pipeline_media_conflict' } });
    receipts.push({ data: null, error: null });
    await expect(createMediaPresentationRevision(input())).rejects.toMatchObject({ status: 409 });
    expect(remove).toHaveBeenCalledWith([paths[0]]);
    remove.mockClear(); references = { data: null, error: { message: 'offline' } }; receipts = [{ data: null, error: null }, { data: null, error: null }];
    await expect(createMediaPresentationRevision(input())).rejects.toMatchObject({ status: 409 });
    expect(remove).not.toHaveBeenCalled();
  });
  it('rejects URLs, creator/rights/status edits, unknown fields and no-op presentations', async () => {
    expect(mediaRevisionInputSchema.safeParse({ ...input(), sourceUrl: 'https://attacker.invalid' }).success).toBe(false);
    for (const extra of [{ creator: 'owner' }, { rights: 'approved' }, { status: 'published' }]) {
      await expect(createMediaPresentationRevision({ ...input(), ...extra })).rejects.toMatchObject({ status: 400 });
    }
    await expect(createMediaPresentationRevision({ ...input(), presentation: { ...presentation(), proposed: base.baseline } })).rejects.toMatchObject({ status: 400 });
    expect(copy).not.toHaveBeenCalled();
  });
  it('renders the exact candidate URL and fit at two scales on light and dark without registry data', () => {
    const html = renderToStaticMarkup(createElement(MediaPresentationPreview, { sourceUrl: 'https://example.invalid/candidate.svg', presentation: presentation() }));
    expect(html).toContain('candidate.svg'); expect(html).not.toContain('original.svg');
    expect(html.match(/background-size:contain/g)).toHaveLength(4);
    expect(html).toContain('width:160px'); expect(html).toContain('width:240px');
  });
});
