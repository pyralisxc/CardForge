begin;
set local lock_timeout='5s';
-- October25 purge bookkeeping is not authored parent content. Preserve the
-- original candidate pins; exclude only these two additive operational columns.
create or replace function public.cardforge_media_parent_content_version(p_submission_id uuid)
returns text language sql stable security invoker set search_path = '' as $$
  select pg_catalog.md5((pg_catalog.to_jsonb(submission) - array[
    'updated_at','positive_votes','negative_votes','quality_score','status','contributor_lifecycle_state',
    'automated_status','owner_status_override','calculated_access_tier','automated_access_tier','owner_access_tier_override',
    'tier_decision_reason','owner_note','decision_reason','editorial_review_status','editorial_review_note',
    'editorial_reviewed_by','editorial_reviewed_at','published_at','purge_state','trashed_at','purge_after',
    'trash_reason','retention_hold','purge_claimed_at','template_review_context','source_review_evidence','owner_purge_requested_at','purge_claim_token'])::text)
  from public.cardforge_contributor_asset_submissions as submission where id=p_submission_id;
$$;
commit;
