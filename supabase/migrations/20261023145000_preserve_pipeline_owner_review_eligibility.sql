begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- The existing owner-review eligibility for a replacement is independent of
-- zero community votes; never auto-publish a replacement of a live lineage.
CREATE OR REPLACE FUNCTION public.cardforge_rebalance_contributor_asset_pipeline(p_owner_contributor_id text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  changed_count integer := 0;
  submission_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cardforge-contributor-pipeline', 0));

  with totals as (
    select submission.id,
      count(*) filter (where vote.vote_value = 'positive')::integer as positive_votes,
      count(*) filter (where vote.vote_value = 'negative')::integer as negative_votes,
      case when count(vote.submission_id) = 0 then 0 else
        pg_catalog.round((count(*) filter (where vote.vote_value = 'positive')::numeric /
          count(vote.submission_id)::numeric) * 100)::integer end as quality_score
    from public.cardforge_contributor_asset_submissions as submission
    left join public.cardforge_contributor_asset_votes as vote on vote.submission_id = submission.id
    group by submission.id
  )
  update public.cardforge_contributor_asset_submissions as submission
  set positive_votes = totals.positive_votes, negative_votes = totals.negative_votes,
      quality_score = totals.quality_score
  from totals
  where totals.id = submission.id and (
    submission.positive_votes <> totals.positive_votes or submission.negative_votes <> totals.negative_votes
    or submission.quality_score <> totals.quality_score
  );

  with settings as (
    select * from public.cardforge_contributor_program_settings where id = 'default'
  ), scored as (
    select submission.id, submission.lineage_id, submission.asset_type, submission.submitted_at,
      submission.positive_votes, submission.negative_votes,
      submission.positive_votes + submission.negative_votes as total_votes,
      case when submission.positive_votes + submission.negative_votes = 0 then 0 else
        pg_catalog.round((submission.positive_votes::numeric /
          (submission.positive_votes + submission.negative_votes)::numeric) * 100)::integer end as quality_score,
      settings.minimum_votes_for_grading as minimum_votes,
      settings.free_asset_minimum_positive_vote_percent as free_threshold,
      settings.paid_asset_minimum_positive_vote_percent as paid_threshold,
      settings.trash_retention_days,
      coalesce((settings.tier_caps_by_type -> submission.asset_type ->> 'free')::integer, 0) as free_cap,
      coalesce((settings.tier_caps_by_type -> submission.asset_type ->> 'paid')::integer, 0) as paid_cap,
      submission.submitted_at <= pg_catalog.now() - pg_catalog.make_interval(days => settings.review_minimum_age_days) as review_age_met,
      registry.asset_id is not null as is_current_publication,
      registry.access_tier as current_access_tier,
      exists (select 1 from public.cardforge_asset_registry as live
        where live.status = 'published' and live.contributor_submission_id is not null
          and live.contributor_submission_id <> submission.id
          and exists (select 1 from public.cardforge_contributor_asset_submissions as current_submission
            where current_submission.id = live.contributor_submission_id
              and current_submission.lineage_id = submission.lineage_id)) as lineage_already_live
    from public.cardforge_contributor_asset_submissions as submission
    cross join settings
    left join public.cardforge_asset_registry as registry
      on registry.status = 'published' and registry.contributor_submission_id = submission.id
    where submission.purge_state is null and submission.trashed_at is null
      and (submission.status in ('submitted', 'voting', 'publish_candidate')
        or registry.asset_id is not null)
  ), occupied as (
    select asset_type,
      count(*) filter (where is_current_publication and current_access_tier = 'free')::integer as free_used,
      count(*) filter (where is_current_publication and current_access_tier = 'paid')::integer as paid_used
    from scored group by asset_type
  ), ranked as (
    select scored.*,
      count(*) filter (where not is_current_publication and not lineage_already_live
        and review_age_met and total_votes >= minimum_votes and quality_score >= paid_threshold)
        over (partition by asset_type order by quality_score desc, total_votes desc, submitted_at asc, id asc) as paid_rank,
      count(*) filter (where not is_current_publication and not lineage_already_live
        and review_age_met and total_votes >= minimum_votes
        and quality_score >= free_threshold and quality_score < paid_threshold)
        over (partition by asset_type order by quality_score desc, total_votes desc, submitted_at asc, id asc) as free_rank
    from scored
  ), decisions as (
    select ranked.id, ranked.quality_score, ranked.trash_retention_days,
      case
        when ranked.is_current_publication then 'published'
        when ranked.lineage_already_live then 'publish_candidate'
        when ranked.total_votes < ranked.minimum_votes then 'voting'
        when not ranked.review_age_met then 'publish_candidate'
        when ranked.quality_score < ranked.free_threshold then 'archived'
        when ranked.lineage_already_live then 'publish_candidate'
        when ranked.quality_score >= ranked.paid_threshold
          and ranked.paid_rank <= greatest(ranked.paid_cap - coalesce(occupied.paid_used, 0), 0) then 'published'
        when ranked.quality_score >= ranked.free_threshold
          and ranked.free_rank <= greatest(ranked.free_cap - coalesce(occupied.free_used, 0), 0) then 'published'
        else 'publish_candidate'
      end as automated_status,
      case
        when ranked.is_current_publication then ranked.current_access_tier
        when ranked.lineage_already_live then 'contributor'
        when ranked.total_votes < ranked.minimum_votes then 'contributor'
        when not ranked.review_age_met then 'contributor'
        when ranked.quality_score < ranked.free_threshold then 'hidden'
        when ranked.lineage_already_live then 'contributor'
        when ranked.quality_score >= ranked.paid_threshold
          and ranked.paid_rank <= greatest(ranked.paid_cap - coalesce(occupied.paid_used, 0), 0) then 'paid'
        when ranked.quality_score >= ranked.free_threshold
          and ranked.free_rank <= greatest(ranked.free_cap - coalesce(occupied.free_used, 0), 0) then 'free'
        else 'contributor'
      end as automated_access_tier,
      case
        when ranked.is_current_publication then 'current_publication_protected'
        when ranked.lineage_already_live then 'revision_ready_for_owner'
        when ranked.total_votes < ranked.minimum_votes then 'needs_more_votes'
        when not ranked.review_age_met then 'minimum_review_age'
        when ranked.quality_score < ranked.free_threshold then 'below_free_threshold'
        when ranked.lineage_already_live then 'revision_ready_for_owner'
        when ranked.quality_score >= ranked.paid_threshold
          and ranked.paid_rank <= greatest(ranked.paid_cap - coalesce(occupied.paid_used, 0), 0) then 'paid_candidate'
        when ranked.quality_score >= ranked.free_threshold
          and ranked.free_rank <= greatest(ranked.free_cap - coalesce(occupied.free_used, 0), 0) then 'free_candidate'
        else 'tier_cap_full'
      end as automatic_reason
    from ranked left join occupied using (asset_type)
  ), effective as (
    select submission.id, decisions.quality_score, decisions.trash_retention_days,
      decisions.automated_status, decisions.automated_access_tier, decisions.automatic_reason,
      coalesce(submission.owner_status_override, decisions.automated_status) as effective_status,
      case
        when coalesce(submission.owner_status_override, decisions.automated_status) = 'published' then
          coalesce(submission.owner_access_tier_override,
            case when decisions.automated_access_tier in ('free', 'paid') then decisions.automated_access_tier else null end, 'free')
        when coalesce(submission.owner_status_override, decisions.automated_status) in ('archived', 'rejected') then 'hidden'
        else 'contributor'
      end as effective_access_tier
    from public.cardforge_contributor_asset_submissions as submission
    join decisions on decisions.id = submission.id
  )
  update public.cardforge_contributor_asset_submissions as submission
  set automated_status = effective.automated_status,
      automated_access_tier = effective.automated_access_tier,
      status = effective.effective_status,
      calculated_access_tier = effective.effective_access_tier,
      quality_score = effective.quality_score,
      decision_reason = case when submission.owner_status_override is not null then 'owner_status_override' else effective.automatic_reason end,
      tier_decision_reason = case
        when effective.effective_status <> 'published' and effective.effective_access_tier = 'hidden' then 'hidden_status'
        when submission.owner_access_tier_override is not null then 'owner_forced_' || submission.owner_access_tier_override
        else effective.automatic_reason end,
      published_at = case when effective.effective_status = 'published' and submission.status <> 'published'
        then pg_catalog.now() else submission.published_at end,
      trashed_at = case when effective.effective_status = 'archived' and submission.published_at is null
        then coalesce(submission.trashed_at, pg_catalog.now())
        when effective.effective_status not in ('archived', 'rejected') then null else submission.trashed_at end,
      trash_reason = case when effective.effective_status = 'archived' and submission.published_at is null
        then coalesce(submission.trash_reason, 'declined')
        when effective.effective_status not in ('archived', 'rejected') then null else submission.trash_reason end,
      purge_after = case when effective.effective_status = 'archived' and submission.published_at is null
        then coalesce(submission.purge_after, pg_catalog.now() + pg_catalog.make_interval(days => effective.trash_retention_days))
        when effective.effective_status not in ('archived', 'rejected') then null else submission.purge_after end
  from effective where effective.id = submission.id;

  get diagnostics changed_count = row_count;
  for submission_id in
    select submission.id from public.cardforge_contributor_asset_submissions as submission
    where submission.purge_state is null and submission.trashed_at is null
    order by case when submission.status = 'published' then 0 else 1 end,
      submission.revision_number asc nulls first, submission.submitted_at asc, submission.id asc
  loop
    perform public.cardforge_sync_contributor_asset_registry(submission_id);
  end loop;
  return changed_count;
end;
$function$
;

-- Editorial save is not a voting/settings mutation: do not rewrite unrelated
-- submission lifecycle state while persisting source-review decisions.
CREATE OR REPLACE FUNCTION public.cardforge_set_contributor_asset_editorial_review(p_submission_id uuid, p_review_status text, p_review_note text, p_reviewer_contributor_id text, p_expected_evidence_version integer)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  submission public.cardforge_contributor_asset_submissions%rowtype;
  normalized_note text := pg_catalog.btrim(coalesce(p_review_note, ''));
  normalized_reviewer text := pg_catalog.btrim(coalesce(p_reviewer_contributor_id, ''));
  changed_count integer;
begin
  if p_review_status not in ('pending', 'approved', 'revise', 'quarantine', 'retire') then
    raise exception 'invalid_editorial_review_status';
  end if;
  if p_review_status <> 'pending'
    and (normalized_note = '' or normalized_reviewer = '')
  then
    raise exception 'editorial_review_reason_required';
  end if;

  select * into submission
  from public.cardforge_contributor_asset_submissions
  where id = p_submission_id and purge_state is null
  for update;
  if not found then raise exception 'contributor_asset_not_found'; end if;

  if p_review_status='approved' and (submission.media_presentation is not null or submission.template_review_context is not null)
    and p_expected_evidence_version is distinct from coalesce((submission.source_review_evidence->>'version')::integer,0)
  then raise exception 'editorial_review_evidence_conflict'; end if;

  if submission.status = 'published' and p_review_status = 'revise' then
    raise exception 'editorial_review_live_requires_quarantine';
  end if;

  if p_review_status = 'approved' then
    if nullif(pg_catalog.btrim(coalesce(submission.source_notes, '')), '') is null
      and (nullif(pg_catalog.btrim(submission.source_review_evidence->'facts'->>'technicalTrace'),'') is null
        or nullif(pg_catalog.btrim(submission.source_review_evidence->'facts'->>'rightsFacts'),'') is null) then
      raise exception 'editorial_review_source_notes_required';
    end if;
    if nullif(pg_catalog.btrim(coalesce(submission.preview_url, '')), '') is null then
      raise exception 'editorial_review_preview_required';
    end if;
    if coalesce(pg_catalog.array_length(submission.specialty_tags, 1), 0) = 0
      or not public.cardforge_valid_pipeline_semantic_role(submission.asset_type, submission.semantic_role)
    then
      raise exception 'editorial_review_classification_required';
    end if;
    if submission.asset_type in ('templates', 'sets')
      and coalesce(pg_catalog.array_length(submission.use_case_tags, 1), 0) = 0
    then
      raise exception 'editorial_review_classification_required';
    end if;
  end if;

  update public.cardforge_contributor_asset_submissions
  set
    editorial_review_status = p_review_status,
    editorial_review_note = case when p_review_status = 'pending' then '' else normalized_note end,
    editorial_reviewed_by = case when p_review_status = 'pending' then null else normalized_reviewer end,
    editorial_reviewed_at = case when p_review_status = 'pending' then null else pg_catalog.now() end,
    owner_status_override = case when p_review_status in ('quarantine', 'retire') then 'archived' else owner_status_override end,
    owner_access_tier_override = case when p_review_status in ('quarantine', 'retire') then 'hidden' else owner_access_tier_override end,
    owner_note = case when p_review_status in ('quarantine', 'retire') then normalized_note else owner_note end
  where id = p_submission_id;

  -- Editorial decisions are target-local. Voting/settings commands own global rebalancing.
  changed_count := 1;
  perform public.cardforge_sync_contributor_asset_registry(p_submission_id);
  return changed_count;
end;
$function$
;
commit;
