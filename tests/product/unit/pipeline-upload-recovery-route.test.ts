import { beforeEach, describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ access: vi.fn(), submit: vi.fn(), summary: vi.fn(), limit: vi.fn(), invalidate: vi.fn() }));
vi.mock('@/features/pipeline/server', () => ({
  getCurrentPipelineRequestAccess: f.access, requirePipelineRequestScope: vi.fn(), createUploadedPipelineSubmission: f.submit,
  getPipelineContributorSummary: f.summary, PIPELINE_UPLOAD_HARD_MAX_MB: 50,
  PipelineStoreError: class extends Error {}, PipelineRegistryCommandError: class extends Error {},
}));
vi.mock('@/features/owner/server', () => ({ getCurrentOwnerAccess: vi.fn(), saveOwnerPipelineProgramSettings: vi.fn() }));
vi.mock('@/features/account/server', () => ({ AccountToolAccessError: class extends Error {} }));
vi.mock('@/infrastructure/security/abuseProtection', () => ({ consumeRateLimit: f.limit, RateLimitUnavailableError: class extends Error {} }));
vi.mock('@/features/pipeline/server/catalogCache', () => ({ revalidateCardForgeCatalog: f.invalidate }));
import { POST } from '@/app/api/pipeline/route';

const request = (lookup: boolean, actor = 'actor') => new Request(`http://localhost/api/pipeline${lookup ? '?lookup=1' : ''}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Pipeline-Contributor': actor },
  body: JSON.stringify({ uploadedFile: { storagePath: 'path', fileName: 'file.png', fileSizeBytes: 4, mimeType: 'image/png' }, name: 'Example' }),
});
describe('Pipeline upload recovery HTTP entry', () => {
  beforeEach(() => {
    vi.resetAllMocks(); f.access.mockResolvedValue({ user: { id: 'actor' }, email: null });
    f.summary.mockResolvedValue({ maxSubmissionFileSizeMb: 25 }); f.limit.mockResolvedValue({ allowed: true });
  });
  it('inspects through the native owner without claiming, consuming a submission allowance or invalidating the catalog', async () => {
    f.submit.mockResolvedValue({ state: 'owned', submissionId: '11111111-1111-4111-8111-111111111111' });
    const response = await POST(request(true));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ receipt: { state: 'owned' } });
    expect(f.submit).toHaveBeenCalledWith(expect.objectContaining({ contributorId: 'actor', inspectOnly: true, maxFileSizeMb: 50 }));
    expect(f.limit).not.toHaveBeenCalled(); expect(f.summary).not.toHaveBeenCalled(); expect(f.invalidate).not.toHaveBeenCalled();
  });
  it('rejects a switched account before reading or submitting', async () => {
    expect((await POST(request(true, 'other-actor'))).status).toBe(403);
    expect(f.submit).not.toHaveBeenCalled();
  });
  it('retains the existing submission behavior', async () => {
    const response = await POST(request(false));
    expect(response.status).toBe(201); expect(await response.json()).toEqual({ submitted: true });
    expect(f.submit).toHaveBeenCalledWith(expect.objectContaining({ inspectOnly: false, maxFileSizeMb: 25 }));
    expect(f.limit).toHaveBeenCalledOnce(); expect(f.invalidate).toHaveBeenCalledOnce();
  });
});
