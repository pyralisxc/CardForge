import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Pipeline reactions', () => {
  const library = source('src/features/storage-management/components/UnifiedAccountLibrary.tsx');
  const route = source('src/app/api/pipeline/hearts/route.ts');
  const migration = source('supabase/migrations/20260829052228_pipeline_lineages_hearts_and_durable_votes.sql');
  const voteRoute = source('src/app/api/pipeline/[submissionId]/vote/route.ts');

  it('exposes hearts on every visible shared object and contributor votes on every exact revision', () => {
    expect(library).toContain('pipelineLineageFor(item)');
    expect(library).toContain('Heart this Pipeline object');
    expect(library).toContain('pipelineItem && experience.contributor.canReview');
    expect(library).toContain('onVoteRevision(revision.id');
    expect(library).toContain('Vote up on this exact revision');
    expect(library).toContain('activeFailure && !scopeItems.length ? null');
    expect(library).not.toContain("reviewState === 'available' || pipelineItem.pipeline.reviewState === 'already-voted'");
    expect(voteRoute).not.toContain('Voting is closed for this Pipeline revision.');
  });

  it('keeps account hearts on stable lineages and separate from review math', () => {
    expect(migration).toContain('cardforge_pipeline_asset_lineages');
    expect(migration).toContain('cardforge_pipeline_asset_hearts');
    expect(migration).toContain('primary key (lineage_id, account_id)');
    expect(migration).toContain('cardforge_get_pipeline_heart_metrics');
    expect(migration).toContain("if submission_status in ('submitted', 'voting', 'publish_candidate')");
    expect(route).toContain('setPipelineHeart');
    expect(route).toContain('getViewerVisiblePipelineLineageIds');
    expect(route).toContain('parsePipelineLineageIds');
    expect(route).toContain("createApiErrorResponse(401, 'sign_in_required'");
    expect(route).toContain("action: 'pipeline-heart'");
  });

  it('authorizes reactions and permanent deletion through the stable lineage owner', () => {
    expect(voteRoute).toContain('visibleToViewer');
    expect(voteRoute).toContain("'pipeline_not_permitted'");
    expect(migration).toContain("purge_state text check (purge_state in ('pending'))");
    expect(migration).toContain("raise exception 'developer_asset_lineage_purge_pending'");
    expect(migration).toContain('where lineage_submission.lineage_id = lineage_uuid');
    expect(migration).toContain("'lineageId', lineage_uuid");
    expect(migration).toContain('where lineage_id = lineage_uuid');
    expect(migration).toContain('cardforge_set_pipeline_heart');
    expect(migration).toContain("raise exception 'pipeline_reaction_not_permitted'");
    expect(migration).toContain('cardforge_reject_pending_pipeline_submission_update');
    expect(migration).toContain("raise exception 'developer_asset_vote_not_permitted'");
    expect(migration).toContain("raise exception 'developer_asset_self_vote_not_permitted'");
  });
});
