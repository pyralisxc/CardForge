import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PipelineRegistryCommandError } from '@/features/pipeline/lib/pipelineRegistryCommandsError';
const boundary = vi.hoisted(() => ({ owner: vi.fn(), activity: vi.fn(), create: vi.fn(), read: vi.fn(), receipt: vi.fn(), sourceRead: vi.fn(), sourceRecord: vi.fn() }));
vi.mock('@/features/owner/server', () => ({ getCurrentOwnerAccess: boundary.owner, recordOwnerActivity: boundary.activity }));
vi.mock('@/features/pipeline/server', () => ({ createTemplateReviewRevision: boundary.create, readTemplateReviewBase: boundary.read, readTemplateReviewReceipt: boundary.receipt, readSourceReviewEvidence: boundary.sourceRead, recordSourceReviewEvidence: boundary.sourceRecord, PipelineRegistryCommandError }));
import { GET, POST } from '@/app/api/owner/pipeline/template-revisions/route';
import { GET as readEvidence, PUT as writeEvidence } from '@/app/api/pipeline/[submissionId]/route';
beforeEach(() => {
  vi.clearAllMocks(); boundary.owner.mockResolvedValue({ isOwner: true, userId: 'acting-owner', email: 'owner@example.invalid' });
  boundary.activity.mockResolvedValue(true); boundary.create.mockResolvedValue({ id: 'candidate', status: 'submitted', editorialReviewStatus: 'pending', revisionNumber: 2 });
});
describe('Owner Template review action', () => {
  it.each([{ isOwner: false, userId: null }, { isOwner: false, userId: 'contributor' }])('denies reads and writes before protected source access', async (access) => {
    boundary.owner.mockResolvedValue(access);
    expect((await GET(new Request('https://example.invalid?assetId=template'))).status).toBe(access.userId ? 403 : 401);
    expect((await POST(new Request('https://example.invalid', { method: 'POST', body: '{}' }))).status).toBe(access.userId ? 403 : 401);
    expect(boundary.read).not.toHaveBeenCalled(); expect(boundary.create).not.toHaveBeenCalled();
  });
  it('records the acting Owner without approving or publishing the inherited creator work', async () => {
    const response = await POST(new Request('https://example.invalid', { method: 'POST', body: '{}' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'submitted', editorialReviewStatus: 'pending' });
    expect(boundary.create).toHaveBeenCalledWith({}, 'acting-owner');
    expect(boundary.activity).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: 'acting-owner', targetId: 'candidate', action: 'library.template.review_revision' }));
  });
  it('distinguishes absent receipts, conflicts and unavailable reads without rewriting a draft', async () => {
    boundary.receipt.mockResolvedValueOnce(null);
    expect(await (await GET(new Request('https://example.invalid?assetId=template&submissionKey=known-key'))).json()).toEqual({ receipt: null });
    boundary.create.mockRejectedValueOnce(new PipelineRegistryCommandError('Reload exact base', 409));
    const conflict = await POST(new Request('https://example.invalid', { method: 'POST', body: '{}' }));
    expect(conflict.status).toBe(409); expect((await conflict.json()).error.kind).toBe('conflict');
    boundary.read.mockRejectedValueOnce(new Error('transport'));
    const unavailable = await GET(new Request('https://example.invalid?assetId=template'));
    expect(unavailable.status).toBe(503); expect((await unavailable.json()).error.kind).toBe('unavailable');
    expect(boundary.activity).not.toHaveBeenCalled();
  });
});


describe('Owner correction source-evidence action', () => {
  const params = { params: Promise.resolve({ submissionId: 'candidate' }) };
  it('authenticates source evidence before protected reads or writes', async () => {
    boundary.owner.mockResolvedValue({ userId: null, isOwner: false });
    expect((await readEvidence(new Request('https://example.invalid'), params)).status).toBe(401);
    expect((await writeEvidence(new Request('https://example.invalid', { method: 'PUT', body: '{}' }), params)).status).toBe(401);
    expect(boundary.sourceRead).not.toHaveBeenCalled(); expect(boundary.sourceRecord).not.toHaveBeenCalled();
  });
  it('records evidence separately from approval/publication with the authenticated recorder', async () => {
    boundary.sourceRecord.mockResolvedValueOnce({ evidence: { version: 1 } });
    const evidence = { facts: { technicalTrace: 'Exact parent', rightsFacts: null }, expectedEvidenceVersion: 0 };
    const response = await writeEvidence(new Request('https://example.invalid', { method: 'PUT', body: JSON.stringify({ sourceReviewEvidence: evidence }) }), params);
    expect(response.status).toBe(200);
    expect(boundary.sourceRecord).toHaveBeenCalledWith('candidate', evidence, 'acting-owner');
    expect(boundary.activity).toHaveBeenCalledWith(expect.objectContaining({ action: 'library.asset.source_evidence' }));
    const mixed = await writeEvidence(new Request('https://example.invalid', { method: 'PUT', body: JSON.stringify({ sourceReviewEvidence: evidence, editorialReviewStatus: 'approved' }) }), params);
    expect(mixed.status).toBe(400); expect(boundary.sourceRecord).toHaveBeenCalledTimes(1);
  });
});
