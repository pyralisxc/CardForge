import { describe, expect, it, vi } from 'vitest';
import { projectPipelineProgramForViewer } from '@/features/pipeline/lib/pipelineProgramView';
import type { PipelineProgramView } from '@/features/pipeline/lib/pipelineProgram';

const boundary = vi.hoisted(() => ({ program: null as unknown, isOwner: false }));
vi.mock('@/features/pipeline/server', async () => ({
  PipelineStoreError: class extends Error {},
  getCurrentPipelineRequestAccess: async () => ({ user: { id: 'author' }, isOwner: boundary.isOwner, isContributor: true, ownerAccess: {} }),
  getPipelineLibraryProgramView: async () => boundary.program,
  getPipelineContributorIds: (id: string) => [id],
  projectPipelineProgramForViewer: (await import('@/features/pipeline/lib/pipelineProgramView')).projectPipelineProgramForViewer,
  requirePipelineRequestScope: () => {},
}));
import { GET } from '@/app/api/pipeline/library/route';

describe('Pipeline review privacy', () => {
  it('keeps reviewer notes private through the Library response and preserves Owner readback', async () => {
    const row = (id: string, contributorId: string) => ({ id, contributorId,
      editorialReviewStatus: 'revise', editorialReviewNote: 'private editorial reason',
      editorialReviewedBy: 'reviewer', sourceReviewEvidenceVersion: 4, ownerNote: 'private owner note',
      contributorEmail: `${id}@example.test`, sourceUrl: 'private', sourceStorageBucket: 'private',
      sourceStoragePath: 'private', trashActorId: 'reviewer' });
    const own = row('own', 'author'), peer = row('peer', 'other');
    const full = { submissions: [own, peer], votingQueue: [peer], contributions: [] } as unknown as PipelineProgramView;
    boundary.program = full; boundary.isOwner = false;
    const response = await GET(new Request('https://example.test/api/pipeline/library'));
    expect(response.status).toBe(200);
    const visible = (await response.json()).program as PipelineProgramView;
    for (const item of [...visible.submissions, ...visible.votingQueue]) {
      expect(item).toMatchObject({ editorialReviewStatus: 'revise', editorialReviewNote: '',
        editorialReviewedBy: null, sourceReviewEvidenceVersion: null, ownerNote: null });
    }
    expect(visible.submissions[0].sourceUrl).toBe('private');
    expect(visible.submissions[1].sourceUrl).toBeNull();
    expect(projectPipelineProgramForViewer(full, { currentUserId: 'owner', isOwner: true })).toBe(full);
  });
});
