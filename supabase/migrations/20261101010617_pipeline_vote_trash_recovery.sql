begin;
set local lock_timeout='5s';
-- Operational provenance belongs to the existing exact revision, not a new queue.
alter table public.cardforge_contributor_asset_submissions
 drop constraint cardforge_contributor_asset_sub_revision_trash_actor_role_check,
 add constraint cardforge_revision_trash_actor_role_check
 check (revision_trash_actor_role in ('owner','contributor','voting')),
 add column revision_trash_previous_status text check (revision_trash_previous_status in ('draft','submitted','voting','publish_candidate','published','archived','rejected')),
 add column revision_vote_trash_fingerprint text;

create function public.cardforge_revision_vote_decision_fingerprint(p_id uuid)
returns text language sql stable security invoker set search_path='' as $$
 select md5(jsonb_build_array(
   (select jsonb_agg(jsonb_build_array(v.contributor_id,v.vote_value) order by v.contributor_id)
     from public.cardforge_contributor_asset_votes v where v.submission_id=p_id),
   s.minimum_votes_for_grading,s.free_asset_minimum_positive_vote_percent,
   s.review_minimum_age_days,
   (select r.submitted_at<=now()-make_interval(days=>s.review_minimum_age_days) from public.cardforge_contributor_asset_submissions r where r.id=p_id))::text)
 from public.cardforge_contributor_program_settings s where s.id='default';
$$;
revoke all on function public.cardforge_revision_vote_decision_fingerprint(uuid) from public,anon,authenticated;
grant execute on function public.cardforge_revision_vote_decision_fingerprint(uuid) to service_role;
create or replace function public.cardforge_guard_revision_recovery_provenance()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 -- Existing updated_at triggers use transaction time; a retained monotonic
 -- row generation prevents restore-to-same-state replay even in one transaction.
 new.revision_recovery_version:=old.revision_recovery_version+1;
 -- Preserve real retained publication evidence before Trash changes status.
 -- This certifies no historical date, event, source bytes or render authority.
 new.revision_publication_retained:=old.revision_publication_retained
   or old.published_at is not null or old.status='published'
   or coalesce(old.contributor_lifecycle_state='retired',false)
   or exists(select 1 from public.cardforge_asset_registry r where r.contributor_submission_id=old.id)
   or exists(select 1 from public.cardforge_pipeline_publication_events e where e.published_submission_id=old.id);
 if new.purge_state='pending' and new.revision_publication_retained
   and not exists(select 1 from public.cardforge_pipeline_asset_lineages l
     where l.id=new.lineage_id and l.purge_state='pending'
       and (l.registry_asset_id is null or exists(
         select 1 from public.cardforge_pipeline_asset_tombstones t
         where t.lineage_id=l.id and t.asset_id=l.registry_asset_id
           and t.identity_captured_at is not null and t.deletion_reason='owner_permanent_deletion'))) then
   -- A single-revision claim cannot erase retained publication. The separate
   -- already-prepared Owner lineage transaction retains its existing authority.
   raise exception 'pipeline_revision_publication_retained'; end if;
 -- Ordinary rebalance may project archived never-published rows back into
 -- Trash. A recovered contributor lifecycle remains outside Trash unless an
 -- explicit new recovery command supplies its durable actor provenance.
 if old.contributor_lifecycle_state is not null
   and new.contributor_lifecycle_state is not distinct from old.contributor_lifecycle_state
   and new.owner_status_override is not distinct from old.owner_status_override
   and old.trashed_at is null and new.trashed_at is not null
   and new.revision_trash_actor_role is null then
   new.trashed_at:=old.trashed_at; new.purge_after:=old.purge_after; new.trash_reason:=old.trash_reason;
 end if;
 if new.trashed_at is null then
   new.revision_trash_actor_id:=null; new.revision_trash_actor_role:=null;
 elsif old.trashed_at is not null and (
   new.owner_status_override is distinct from old.owner_status_override
   or new.editorial_review_status is distinct from old.editorial_review_status
   or new.editorial_reviewed_at is distinct from old.editorial_reviewed_at) then
   -- Subsequent Owner moderation supersedes any contributor recovery authority,
   -- even when the old Trash epoch/reason survives the existing override command.
   new.revision_trash_actor_id:=null; new.revision_trash_actor_role:='owner';
 end if;
 if old.status='draft' and old.trashed_at is null and new.trashed_at is null and new.status in ('submitted','voting','publish_candidate') then new.revision_trash_previous_status:=null; end if;
 if old.trashed_at is null and new.trashed_at is not null then
   new.revision_trash_previous_status:=old.status;
   if new.revision_trash_actor_role is null and new.decision_reason='below_free_threshold'
      and new.owner_status_override is null then
     new.revision_trash_actor_role:='voting';
     new.revision_vote_trash_fingerprint:=public.cardforge_revision_vote_decision_fingerprint(new.id);
   end if;
 end if;
 return new;
end $$;
create or replace function public.cardforge_read_revision_recovery(p_submission_id uuid,p_actor_user_id text,p_is_owner boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.cardforge_contributor_asset_submissions%rowtype;
 l public.cardforge_pipeline_asset_lineages%rowtype; r public.cardforge_asset_registry%rowtype;
 days integer; blocked text[]:='{}'; entry text[]:='{}'; recovery text[]:='{}'; published boolean;
begin
 if nullif(btrim(p_actor_user_id),'') is null or p_is_owner is null then raise exception 'revision_recovery_not_permitted'; end if;
 select * into s from public.cardforge_contributor_asset_submissions where id=p_submission_id;
 -- A contributor cannot distinguish another account's private UUID from absence.
 if not found then
   if not p_is_owner then raise exception 'revision_recovery_not_permitted'; end if;
   raise exception 'revision_recovery_not_found';
 end if;
 if not p_is_owner and s.contributor_id is distinct from p_actor_user_id then raise exception 'revision_recovery_not_permitted'; end if;
 select * into l from public.cardforge_pipeline_asset_lineages where id=s.lineage_id;
 if not found then raise exception 'revision_recovery_inventory_unavailable'; end if;
 select * into r from public.cardforge_asset_registry where asset_id=l.registry_asset_id;
 select trash_retention_days into days from public.cardforge_contributor_program_settings where id='default';
 if days is null or days<1 then raise exception 'revision_recovery_inventory_unavailable'; end if;
 if l.catalog_trashed_at is not null then blocked:=array_append(blocked,'catalog_recovery_active'); end if;
 if l.purge_state is not null or l.catalog_claim_token is not null or l.catalog_claimed_at is not null
   or s.purge_state is not null or s.purge_claim_token is not null or s.purge_claimed_at is not null or s.owner_purge_requested_at is not null
 then blocked:=array_append(blocked,'destructive_attempt_requires_reconciliation'); end if;
 -- Only exact-current removal changes runtime discovery. Reuse its proven native
 -- inventory; historical recovery never claims that it can clear catalog holds.
 if r.contributor_submission_id=s.id and s.trashed_at is null then
   entry:=public.cardforge_catalog_trash_entry_reasons(l.id);
 end if;
 entry:=blocked||entry;
 if s.trashed_at is not null then entry:=array_append(entry,'revision_already_trashed'); end if;
 recovery:=blocked;
 if s.retention_hold then recovery:=array_append(recovery,'retention_hold'); end if;
 if s.trashed_at is null then recovery:=array_append(recovery,'revision_not_trashed'); end if;
 if not p_is_owner and (s.revision_trash_actor_role is distinct from 'voting' and (s.revision_trash_actor_role is distinct from 'contributor'
   or s.revision_trash_actor_id is distinct from p_actor_user_id)) then
   recovery:=array_append(recovery,'owner_recovery_required'); end if;
 -- Retention evidence is deliberately broader than render/adoption authority.
 published:=s.revision_publication_retained or s.published_at is not null or s.status='published' or coalesce(s.contributor_lifecycle_state='retired',false)
   or exists(select 1 from public.cardforge_asset_registry registry where registry.contributor_submission_id=s.id)
   or exists(select 1 from public.cardforge_pipeline_publication_events e where e.published_submission_id=s.id);
 if s.trashed_at is not null and (s.revision_trash_previous_status is null or s.revision_trash_previous_status='archived') and not published and s.revision_trash_actor_role is distinct from 'voting' then recovery:=array_append(recovery,'prior_visibility_unavailable'); end if;
 return jsonb_build_object('name',s.name,'retentionDays',days,'trashActor',s.revision_trash_actor_role,
 'trashReasons',to_jsonb(entry),'restoreReasons',to_jsonb(recovery),'canHold',p_is_owner and s.trashed_at is not null and cardinality(blocked)=0,
 'publicationRetained',published,'sourceUncertainty',l.catalog_destructive_uncertainty,
 'state',jsonb_build_object('scope','revision','submissionId',s.id,'lineageId',s.lineage_id,'revisionNumber',s.revision_number,
   'registrySubmissionId',r.contributor_submission_id,'revisionHighWater',l.revision_high_water,
   'recoveryVersion',s.revision_recovery_version::text,'status',s.status,'updatedAt',s.updated_at,'trashedAt',s.trashed_at,'purgeAfter',s.purge_after,'held',s.retention_hold));
end $$;

create or replace function public.cardforge_change_revision_recovery(p_actor_user_id text,p_is_owner boolean,p_action text,p_expected jsonb,p_held boolean default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare snapshot jsonb; result jsonb; target uuid; days integer; epoch timestamptz;
 s public.cardforge_contributor_asset_submissions%rowtype; l public.cardforge_pipeline_asset_lineages%rowtype;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'revision_recovery_state_changed'; end if;
 if p_action is null or p_action not in ('trash','restore','hold') or p_is_owner is null
   or nullif(btrim(p_actor_user_id),'') is null then raise exception 'revision_recovery_not_permitted'; end if;
 if p_action='hold' and not p_is_owner then raise exception 'revision_recovery_not_permitted'; end if;
 target:=(p_expected->>'submissionId')::uuid;
 -- Authorize before returning inventory, locking private targets or comparing CAS.
 perform public.cardforge_read_revision_recovery(target,p_actor_user_id,p_is_owner);
 perform pg_advisory_xact_lock(hashtextextended('cardforge-contributor-pipeline',0));
 lock table public.cardforge_contributor_asset_submissions, public.cardforge_asset_registry,
   public.cardforge_studio_documents in share mode nowait;
 select lineage.* into l from public.cardforge_pipeline_asset_lineages lineage
   where lineage.id=(select revision.lineage_id from public.cardforge_contributor_asset_submissions revision where revision.id=target)
   for update nowait;
 if not found then raise exception 'revision_recovery_state_changed'; end if;
 select * into s from public.cardforge_contributor_asset_submissions where id=target for update nowait;
 snapshot:=public.cardforge_read_revision_recovery(target,p_actor_user_id,p_is_owner);
 if snapshot->'state' is distinct from p_expected then raise exception 'revision_recovery_state_changed'; end if;
 if p_action='trash' then
   if jsonb_array_length(snapshot->'trashReasons')>0 then raise exception 'revision_recovery_blocked'; end if;
   days:=(snapshot->>'retentionDays')::integer; epoch:=clock_timestamp();
   update public.cardforge_contributor_asset_submissions set
     status='archived',automated_status='archived',calculated_access_tier='hidden',automated_access_tier='hidden',
     contributor_lifecycle_state=case when (snapshot->>'publicationRetained')::boolean then 'retired' else 'withdrawn' end,
     trashed_at=epoch,purge_after=epoch+make_interval(days=>days),
     trash_reason=case when p_is_owner then 'declined' else 'withdrawn' end,
     revision_trash_actor_id=p_actor_user_id,revision_trash_actor_role=case when p_is_owner then 'owner' else 'contributor' end,
     decision_reason='revision_trashed',updated_at=clock_timestamp() where id=target;
   update public.cardforge_asset_registry set status='archived',access_tier='hidden',updated_at=clock_timestamp()
     where contributor_submission_id=target;
 elsif p_action='restore' then
   if jsonb_array_length(snapshot->'restoreReasons')>0 then raise exception 'revision_recovery_blocked'; end if;
   -- Re-enter ordinary policy with the same immutable payload. Existing scoring
   -- and registry publication locks decide eligibility; a newer live pointer wins.
   update public.cardforge_contributor_asset_submissions set
     status=case when revision_trash_previous_status='draft' then 'draft' else 'voting' end,
     automated_status='voting',calculated_access_tier='contributor',automated_access_tier='contributor',
     contributor_lifecycle_state=null,
     owner_status_override=case when p_is_owner and owner_status_override in ('archived','rejected') then null else owner_status_override end,
     revision_vote_trash_fingerprint=public.cardforge_revision_vote_decision_fingerprint(target),
     trashed_at=null,purge_after=null,trash_reason=null,updated_at=clock_timestamp() where id=target;
   perform public.cardforge_rebalance_contributor_asset_pipeline(case when p_is_owner then p_actor_user_id else null end);
 else
   if not (snapshot->>'canHold')::boolean or p_held is null then raise exception 'revision_recovery_blocked'; end if;
   update public.cardforge_contributor_asset_submissions set retention_hold=p_held,updated_at=clock_timestamp() where id=target;
 end if;
 result:=public.cardforge_read_revision_recovery(target,p_actor_user_id,p_is_owner);
 if p_is_owner then
   insert into public.cardforge_owner_activity(actor_user_id,action,target_type,target_id,summary,outcome,metadata)
    values(p_actor_user_id,'library.revision.'||p_action,'contributor_asset_revision',target::text,
      'Owner revision recovery: '||p_action,'succeeded',jsonb_build_object('before',p_expected,'after',result->'state'));
 end if;
 return result;
end $$;

CREATE OR REPLACE FUNCTION public.cardforge_rebalance_contributor_asset_pipeline(p_owner_contributor_id text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  changed_count integer := 0;
  entry_clock timestamptz;
  submission_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cardforge-contributor-pipeline', 0));
  entry_clock := clock_timestamp();

  with totals as (
    select submission.id,
      count(*) filter (where vote.vote_value = 'positive')::integer as positive_votes,
      count(*) filter (where vote.vote_value = 'negative')::integer as negative_votes,
      case when count(vote.submission_id) = 0 then 0 else
        pg_catalog.round((count(*) filter (where vote.vote_value = 'positive')::numeric /
          count(vote.submission_id)::numeric) * 100)::integer end as quality_score
    from public.cardforge_contributor_asset_submissions as submission
    left join public.cardforge_contributor_asset_votes as vote on vote.submission_id = submission.id
    where not exists(select 1 from public.cardforge_pipeline_asset_lineages l where l.id=submission.lineage_id and l.catalog_trashed_at is not null)
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

  -- Only vote-driven current-publication removal needs retained-consumer
  -- admission. Stabilize the same native owners used by explicit recovery.
  if exists(select 1 from public.cardforge_contributor_asset_submissions v
    join public.cardforge_asset_registry live on live.contributor_submission_id=v.id and live.status='published'
    cross join public.cardforge_contributor_program_settings cfg
    where cfg.id='default' and v.trashed_at is null and v.purge_state is null
      and v.positive_votes+v.negative_votes>=cfg.minimum_votes_for_grading
      and v.quality_score<cfg.free_asset_minimum_positive_vote_percent
      and v.submitted_at<=now()-make_interval(days=>cfg.review_minimum_age_days)) then
    if current_setting('transaction_isolation')<>'read committed' then raise exception 'revision_recovery_state_changed'; end if;
    lock table public.cardforge_contributor_asset_submissions,public.cardforge_asset_registry,
      public.cardforge_studio_documents in share mode nowait;
  end if;

  with settings as (
    select * from public.cardforge_contributor_program_settings where id = 'default'
  ), scored as (
    select submission.id, submission.lineage_id, submission.asset_type, submission.base_revision_number, submission.submitted_at,
      submission.revision_vote_trash_fingerprint, public.cardforge_revision_vote_decision_fingerprint(submission.id) as decision_fingerprint,
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
      case when registry.asset_id is not null
        and submission.positive_votes+submission.negative_votes>=settings.minimum_votes_for_grading
        and submission.quality_score<settings.free_asset_minimum_positive_vote_percent
        and submission.submitted_at<=now()-make_interval(days=>settings.review_minimum_age_days)
        then cardinality(public.cardforge_catalog_trash_entry_reasons(submission.lineage_id))=0
        else true end as can_vote_trash,
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
    where submission.purge_state is null and submission.purge_claim_token is null and submission.purge_claimed_at is null and submission.owner_purge_requested_at is null and (submission.trashed_at is null or (submission.revision_trash_actor_role='voting' and not submission.retention_hold))
      and not exists(select 1 from public.cardforge_pipeline_asset_lineages l where l.id=submission.lineage_id and l.catalog_trashed_at is not null)
      and (submission.revision_trash_actor_role='voting' or submission.status in ('submitted', 'voting', 'publish_candidate')
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
        when ranked.is_current_publication and (ranked.total_votes<ranked.minimum_votes or not ranked.review_age_met or ranked.quality_score>=ranked.free_threshold or not ranked.can_vote_trash) then 'published'
        when (ranked.asset_type = 'templates' and ranked.base_revision_number = 0 or ranked.lineage_already_live) then 'publish_candidate'
        when ranked.total_votes < ranked.minimum_votes then 'voting'
        when not ranked.review_age_met then 'publish_candidate'
        when ranked.quality_score < ranked.free_threshold and ranked.revision_vote_trash_fingerprint is not distinct from ranked.decision_fingerprint and not exists(select 1 from public.cardforge_contributor_asset_submissions t where t.id=ranked.id and t.trashed_at is not null) then 'publish_candidate'
        when ranked.quality_score < ranked.free_threshold then 'archived'
        when (ranked.asset_type = 'templates' and ranked.base_revision_number = 0 or ranked.lineage_already_live) then 'publish_candidate'
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
        when ranked.is_current_publication and not ranked.can_vote_trash then 'vote_trash_blocked'
        when ranked.is_current_publication and (ranked.total_votes<ranked.minimum_votes or not ranked.review_age_met or ranked.quality_score>=ranked.free_threshold or not ranked.can_vote_trash) then 'current_publication_protected'
        when (ranked.asset_type = 'templates' and ranked.base_revision_number = 0 or ranked.lineage_already_live) then 'revision_ready_for_owner'
        when ranked.total_votes < ranked.minimum_votes then 'needs_more_votes'
        when not ranked.review_age_met then 'minimum_review_age'
        when ranked.quality_score < ranked.free_threshold then 'below_free_threshold'
        when (ranked.asset_type = 'templates' and ranked.base_revision_number = 0 or ranked.lineage_already_live) then 'revision_ready_for_owner'
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
      contributor_lifecycle_state=case when submission.revision_trash_actor_role='voting' and effective.effective_status not in ('archived','rejected') then null else submission.contributor_lifecycle_state end,
      published_at = case when effective.effective_status = 'published' and submission.status <> 'published'
        then coalesce(submission.published_at,pg_catalog.now()) else submission.published_at end,
      trashed_at = case when effective.effective_status = 'archived' and effective.automatic_reason='below_free_threshold'
        then coalesce(submission.trashed_at, entry_clock)
        when effective.effective_status not in ('archived', 'rejected') then null else submission.trashed_at end,
      trash_reason = case when effective.effective_status = 'archived' and effective.automatic_reason='below_free_threshold'
        then coalesce(submission.trash_reason, 'declined')
        when effective.effective_status not in ('archived', 'rejected') then null else submission.trash_reason end,
      purge_after = case when effective.effective_status = 'archived' and effective.automatic_reason='below_free_threshold'
        then coalesce(submission.purge_after, entry_clock + pg_catalog.make_interval(days => effective.trash_retention_days))
        when effective.effective_status not in ('archived', 'rejected') then null else submission.purge_after end
  from effective where effective.id = submission.id;

  get diagnostics changed_count = row_count;
  -- Retain the pointer and source bytes as history; remove only discoverability.
  update public.cardforge_asset_registry registry set status='archived',access_tier='hidden',updated_at=now()
    from public.cardforge_contributor_asset_submissions revision
    where registry.contributor_submission_id=revision.id and revision.trashed_at is not null
      and revision.revision_trash_actor_role='voting' and registry.status='published';
  for submission_id in
    select submission.id from public.cardforge_contributor_asset_submissions as submission
    where submission.purge_state is null and submission.trashed_at is null
      and not exists(select 1 from public.cardforge_pipeline_asset_lineages l where l.id=submission.lineage_id and l.catalog_trashed_at is not null)
    order by case when submission.status = 'published' then 0 else 1 end,
      submission.revision_number asc nulls first, submission.submitted_at asc, submission.id asc
  loop
    perform public.cardforge_sync_contributor_asset_registry(submission_id);
  end loop;
  return changed_count;
end;
$function$
;
create or replace function public.cardforge_cast_contributor_asset_vote(
  p_submission_id uuid,
  p_contributor_id text,
  p_vote_value text,
  p_owner_contributor_id text default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare submission public.cardforge_contributor_asset_submissions%rowtype; target_lineage uuid;
begin
  if nullif(pg_catalog.btrim(p_contributor_id), '') is null
    or p_vote_value not in ('positive', 'negative')
  then raise exception 'invalid_contributor_asset_vote'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cardforge-contributor-pipeline',0));
  select lineage_id into target_lineage from public.cardforge_contributor_asset_submissions where id=p_submission_id;
  perform 1 from public.cardforge_pipeline_asset_lineages where id=target_lineage for update;
  select * into submission
  from public.cardforge_contributor_asset_submissions
  where id = p_submission_id and lineage_id=target_lineage and purge_state is null
  for update;
  if not found then raise exception 'contributor_asset_not_found'; end if;

  if exists(select 1 from public.cardforge_pipeline_asset_lineages l where l.id=target_lineage and (l.purge_state is not null or l.catalog_claim_token is not null or l.catalog_claimed_at is not null)) then raise exception 'contributor_asset_vote_not_permitted'; end if;

  if submission.purge_claim_token is not null or submission.purge_claimed_at is not null or submission.owner_purge_requested_at is not null then raise exception 'contributor_asset_vote_not_permitted'; end if;
  if submission.trashed_at is not null and (not coalesce((submission.revision_publication_retained or submission.published_at is not null or submission.revision_trash_actor_role='voting' or submission.revision_trash_previous_status in ('submitted','voting','publish_candidate','published')),false) or submission.purge_claim_token is not null or submission.purge_claimed_at is not null or submission.owner_purge_requested_at is not null) then raise exception 'contributor_asset_vote_not_permitted'; end if;
  if submission.status = 'draft' then
    raise exception 'contributor_asset_vote_not_permitted';
  end if;

  if p_vote_value = 'positive' then
    delete from public.cardforge_contributor_asset_votes
    where lineage_id = submission.lineage_id
      and contributor_id = p_contributor_id
      and vote_value = 'positive'
      and submission_id <> submission.id;
  end if;

  insert into public.cardforge_contributor_asset_votes (
    submission_id, lineage_id, contributor_id, vote_value, vote_weight
  ) values (
    submission.id, submission.lineage_id, p_contributor_id, p_vote_value, 1
  )
  on conflict (submission_id, contributor_id) do update
  set lineage_id = excluded.lineage_id,
      vote_value = excluded.vote_value,
      vote_weight = 1,
      updated_at = pg_catalog.now();

  return public.cardforge_rebalance_contributor_asset_pipeline(p_owner_contributor_id);
end;
$$;

create or replace function public.cardforge_media_parent_content_version(p_submission_id uuid)
returns text language sql stable security invoker set search_path = '' as $$
  select pg_catalog.md5((pg_catalog.to_jsonb(submission) - array[
    'updated_at','positive_votes','negative_votes','quality_score','status','contributor_lifecycle_state',
    'automated_status','owner_status_override','calculated_access_tier','automated_access_tier','owner_access_tier_override',
    'tier_decision_reason','owner_note','decision_reason','editorial_review_status','editorial_review_note',
    'editorial_reviewed_by','editorial_reviewed_at','published_at','purge_state','trashed_at','purge_after',
    'trash_reason','retention_hold','purge_claimed_at','template_review_context','source_review_evidence','owner_purge_requested_at','purge_claim_token','catalog_dependencies','source_content_sha256','revision_recovery_version','revision_trash_actor_id','revision_trash_actor_role','revision_publication_retained','revision_trash_previous_status','revision_vote_trash_fingerprint'])::text)
  from public.cardforge_contributor_asset_submissions as submission where id=p_submission_id;
$$;

drop function public.cardforge_list_contributor_asset_submission_ids(text,text,text,text,text,text,text,boolean,integer,integer);
create or replace function public.cardforge_list_contributor_asset_submission_ids(
  p_current_user_id text,
  p_scope text default 'all',
  p_query text default '',
  p_asset_type text default null,
  p_status text default null,
  p_tier text default null,
  p_vote_filter text default 'all',
  p_allow_self_voting boolean default false,
  p_page integer default 1,
  p_page_size integer default 12,
  p_trash_state text default 'active'
)
returns table (submission_id uuid, total_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with filtered as (
    select submission.id, submission.submitted_at
    from public.cardforge_contributor_asset_submissions as submission
    left join public.cardforge_contributor_asset_votes as current_vote
      on current_vote.submission_id = submission.id
      and current_vote.contributor_id = p_current_user_id
    where coalesce(p_scope, 'all') in ('all', 'own', 'review', 'shared')
      and (
        coalesce(p_scope, 'all') = 'all'
        or (p_scope='shared' and submission.status not in ('draft','rejected') and submission.trashed_at is not null and coalesce(
          submission.revision_publication_retained or submission.published_at is not null
          or submission.revision_trash_actor_role='voting'
          or submission.revision_trash_previous_status in ('submitted','voting','publish_candidate','published'),false))
        or (p_scope = 'own' and submission.contributor_id = p_current_user_id)
        or (
          p_scope = 'review'
          and submission.status not in ('draft', 'rejected')
          and (coalesce(p_allow_self_voting, false) or submission.contributor_id <> p_current_user_id)
        )
      )
      and coalesce(p_trash_state,'active') in ('all','active','trashed')
      and (p_trash_state='all' or p_trash_state='active' and submission.trashed_at is null or p_trash_state='trashed' and submission.trashed_at is not null)
      and submission.purge_state is null
      and (p_scope<>'review' or coalesce((submission.trashed_at is null or submission.revision_publication_retained or submission.published_at is not null or submission.revision_trash_actor_role='voting' or submission.revision_trash_previous_status in ('submitted','voting','publish_candidate','published')),false))
      and (p_asset_type is null or submission.asset_type = p_asset_type)
      and (p_status is null or submission.status = p_status)
      and (p_tier is null or submission.calculated_access_tier = p_tier)
      and (
        coalesce(nullif(pg_catalog.btrim(p_query), ''), '') = ''
        or pg_catalog.lower(pg_catalog.concat_ws(
          ' ', submission.name, submission.description, case when p_scope='shared' then null else submission.contributor_email end,
          submission.registry_asset_id, submission.target_registry_asset_id
        )) like '%' || pg_catalog.lower(pg_catalog.btrim(p_query)) || '%'
      )
      and (
        coalesce(p_vote_filter, 'all') = 'all'
        or (p_vote_filter = 'unvoted' and current_vote.submission_id is null)
        or (p_vote_filter = 'upvoted' and current_vote.vote_value = 'positive')
        or (p_vote_filter = 'downvoted' and current_vote.vote_value = 'negative')
      )
  ), totals as (
    select count(*)::bigint as total_count from filtered
  )
  select slice.id, totals.total_count
  from totals left join lateral (
    select filtered.id, filtered.submitted_at from filtered
    order by filtered.submitted_at desc, filtered.id desc
    offset (greatest(coalesce(p_page, 1), 1)::bigint - 1)
      * least(greatest(coalesce(p_page_size, 12), 1), 50)
    limit least(greatest(coalesce(p_page_size, 12), 1), 50)
  ) slice on true
  order by slice.submitted_at desc, slice.id desc;
$$;

revoke all on function public.cardforge_list_contributor_asset_submission_ids(text,text,text,text,text,text,text,boolean,integer,integer,text) from public,anon,authenticated;
grant execute on function public.cardforge_list_contributor_asset_submission_ids(text,text,text,text,text,text,text,boolean,integer,integer,text) to service_role;

create or replace function public.cardforge_set_pipeline_heart(
  p_lineage_id uuid,
  p_account_id text,
  p_hearted boolean,
  p_viewer_access text,
  p_contributor boolean,
  p_owner boolean
)
returns table (
  lineage_id uuid,
  heart_count integer,
  viewer_hearted boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  lineage_registry_asset_id text;
  lineage_purge_state text;
  visible_to_viewer boolean := false;
  changed_count integer := 0;
begin
  if nullif(pg_catalog.btrim(p_account_id), '') is null
    or p_hearted is null
    or p_viewer_access not in ('free', 'paid', 'contributor')
    or p_contributor is null
    or p_owner is null
  then
    raise exception 'invalid_pipeline_reaction';
  end if;

  select lineage.registry_asset_id, lineage.purge_state
  into lineage_registry_asset_id, lineage_purge_state
  from public.cardforge_pipeline_asset_lineages as lineage
  where lineage.id = p_lineage_id
  for update;

  if not found then
    raise exception 'pipeline_lineage_not_found';
  end if;
  if lineage_purge_state = 'pending' then
    raise exception 'pipeline_reaction_not_permitted';
  end if;

  if p_hearted then
    with authorized as materialized (
      select true as allowed
      where exists (
        select 1
        from public.cardforge_asset_registry as registry
        where registry.asset_id = lineage_registry_asset_id
          and registry.status = 'published'
          and (
            registry.access_tier = 'free'
            or (p_viewer_access in ('paid', 'contributor') and registry.access_tier = 'paid')
            or (p_viewer_access = 'contributor' and registry.access_tier = 'contributor')
          )
      ) or (
        (p_contributor or p_owner)
        and exists (
          select 1
          from public.cardforge_contributor_asset_submissions as submission
          where submission.lineage_id = p_lineage_id
            and submission.purge_state is null
            and (
              p_owner
              or submission.contributor_id = p_account_id
              or (submission.status not in ('draft', 'rejected') and coalesce((submission.trashed_at is null or submission.revision_publication_retained or submission.published_at is not null or submission.revision_trash_actor_role='voting' or submission.revision_trash_previous_status in ('submitted','voting','publish_candidate','published')),false))
            )
        )
      )
    ), changed as (
      insert into public.cardforge_pipeline_asset_hearts (lineage_id, account_id)
      select p_lineage_id, p_account_id from authorized
      on conflict (lineage_id, account_id) do update
      set updated_at = pg_catalog.now()
      returning 1
    )
    select
      exists (select 1 from authorized),
      (select count(*)::integer from changed)
    into visible_to_viewer, changed_count;
  else
    with authorized as materialized (
      select true as allowed
      where exists (
        select 1
        from public.cardforge_asset_registry as registry
        where registry.asset_id = lineage_registry_asset_id
          and registry.status = 'published'
          and (
            registry.access_tier = 'free'
            or (p_viewer_access in ('paid', 'contributor') and registry.access_tier = 'paid')
            or (p_viewer_access = 'contributor' and registry.access_tier = 'contributor')
          )
      ) or (
        (p_contributor or p_owner)
        and exists (
          select 1
          from public.cardforge_contributor_asset_submissions as submission
          where submission.lineage_id = p_lineage_id
            and submission.purge_state is null
            and (
              p_owner
              or submission.contributor_id = p_account_id
              or (submission.status not in ('draft', 'rejected') and coalesce((submission.trashed_at is null or submission.revision_publication_retained or submission.published_at is not null or submission.revision_trash_actor_role='voting' or submission.revision_trash_previous_status in ('submitted','voting','publish_candidate','published')),false))
            )
        )
      )
    ), changed as (
      delete from public.cardforge_pipeline_asset_hearts as heart
      where heart.lineage_id = p_lineage_id
        and heart.account_id = p_account_id
        and exists (select 1 from authorized)
      returning 1
    )
    select
      exists (select 1 from authorized),
      (select count(*)::integer from changed)
    into visible_to_viewer, changed_count;
  end if;

  if not visible_to_viewer then
    raise exception 'pipeline_reaction_not_permitted';
  end if;

  return query
  select
    p_lineage_id,
    count(heart.account_id)::integer,
    coalesce(pg_catalog.bool_or(heart.account_id = p_account_id), false)
  from public.cardforge_pipeline_asset_hearts as heart
  where heart.lineage_id = p_lineage_id;
end;
$$;

revoke execute on function public.cardforge_set_pipeline_heart(uuid, text, boolean, text, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.cardforge_set_pipeline_heart(uuid, text, boolean, text, boolean, boolean)
  to service_role;


commit;
