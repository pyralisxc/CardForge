import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261023145000_preserve_pipeline_owner_review_eligibility.sql'), 'utf8');
const rebalance = sql.split('-- Editorial save is not a voting/settings mutation:')[0];
const editorial = sql.split('-- Editorial save is not a voting/settings mutation:')[1];

describe('replacement review and editorial isolation', () => {
  it('keeps live-lineage replacements eligible for owner review before the vote threshold', () => {
    expect(rebalance).toMatch(/when ranked\.is_current_publication then 'published'\s+when ranked\.lineage_already_live then 'publish_candidate'\s+when ranked\.total_votes < ranked\.minimum_votes then 'voting'/);
    expect(rebalance).toMatch(/when ranked\.is_current_publication then 'current_publication_protected'\s+when ranked\.lineage_already_live then 'revision_ready_for_owner'\s+when ranked\.total_votes < ranked\.minimum_votes then 'needs_more_votes'/);
    expect(rebalance).not.toContain("when ranked.lineage_already_live then 'published'");
  });
  it('keeps editorial saves local and retains native registry sync', () => {
    expect(editorial).not.toContain('changed_count := public.cardforge_rebalance_contributor_asset_pipeline');
    expect(editorial).toContain('perform public.cardforge_sync_contributor_asset_registry(p_submission_id)');
    expect(editorial).toContain("owner_status_override = case when p_review_status in ('quarantine', 'retire') then 'archived'");
    expect(editorial).toContain('editorial_review_evidence_conflict');
    expect(editorial).toContain("status = case when p_review_status in ('quarantine', 'retire') then 'archived'");
    expect(editorial).toContain("calculated_access_tier = case when p_review_status in ('quarantine', 'retire') then 'hidden'");
  });
});

